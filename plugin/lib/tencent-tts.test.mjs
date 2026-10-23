import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {runInNewContext} from 'node:vm'
import {spawn} from 'node:child_process'
import {createTencentTts,tencentSpeed,TENCENT_TTS_SCRIPT} from './tencent-tts.js'

const source=readFileSync(new URL('./client.js',import.meta.url),'utf8')
const marked=source.split('// BEGIN TENCENT SPEECH SEGMENTS')[1].split('// END TENCENT SPEECH SEGMENTS')[0]
const split=runInNewContext(marked+'\nsplitTencentSpeech',{TextEncoder})
const fixture=(t,runNode)=>{
  const dir=mkdtempSync(join(tmpdir(),'xiaoyun-tencent-tts-'))
  t.after(()=>rmSync(dir,{recursive:true,force:true}))
  const credentialsFile=join(dir,'credentials.json')
  writeFileSync(credentialsFile,JSON.stringify({secretId:'private-id',secretKey:'private-key'}),{mode:0o600})
  return {dir,credentialsFile,synthesize:createTencentTts({credentialsFile,runNode})}
}

test('browser segments retain every character and fit both Tencent limits, including emoji',()=>{
  for(const text of ['讲解内容。'.repeat(110),'a'.repeat(680),'🐳'.repeat(330),'第一句话。'+('甲'.repeat(115))+'，第二句继续。'+('乙'.repeat(170))]){
    const parts=Array.from(split(text))
    assert.equal(parts.join(''),text)
    assert.ok(parts.every(part=>Array.from(part).length<=150&&Buffer.byteLength(part)<=450))
    assert.ok(parts.length>1)
  }
  const parts=Array.from(split('第一句。'+('甲'.repeat(160))))
  assert.equal(parts[0],'第一句。')
})

test('the complete turn is acknowledged only after its final Tencent audio piece',async()=>{
  const start=source.indexOf('const requestTts = '),end=source.indexOf('\nconst previewVoice = ',start)
  const refs={current:{outputAllowed:true,disposed:false,ttsQueue:[],audioEpoch:4}}
  let pumps=0,ended=0,done=false
  const request=runInNewContext(source.slice(start,end)+'\nrequestTts',{refs,splitTencentSpeech:split,AbortController,pumpSynthesis(){pumps++}})
  const text='甲'.repeat(340),meta={onEnd(){ended++}}
  const promise=request(text,{speed:.9},18000,meta).then(()=>{done=true})
  const jobs=refs.current.ttsQueue
  assert.equal(jobs.length,3);assert.equal(pumps,3)
  assert.equal(jobs.map(job=>job.text).join(''),text)
  assert.equal(jobs[0].meta,undefined);assert.equal(jobs[1].meta,undefined)
  assert.equal(jobs[2].meta.onEnd,meta.onEnd)
  jobs[0].resolve();jobs[1].resolve();await Promise.resolve()
  assert.equal(done,false);assert.equal(ended,0)
  jobs[2].resolve();await promise;assert.equal(done,true)
  jobs[2].meta.onEnd();assert.equal(ended,1)
})

test('lookahead starts on the first audio piece while the final piece owns the acknowledgement',async()=>{
  const start=source.indexOf('const requestTts = '),end=source.indexOf('\nconst previewVoice = ',start)
  const refs={current:{outputAllowed:true,disposed:false,ttsQueue:[],audioEpoch:1}}
  let starts=0,ends=0
  const request=runInNewContext(source.slice(start,end)+'\nrequestTts',{refs,splitTencentSpeech:split,AbortController,pumpSynthesis(){}})
  const result=request('甲'.repeat(340),{speed:1},30000,{onStart(){starts++},onEnd(){ends++}})
  const jobs=refs.current.ttsQueue
  jobs[0].meta.onStart();assert.equal(starts,1);assert.equal(ends,0)
  assert.equal(jobs[1].meta,undefined);assert.equal(jobs[2].meta.onStart,undefined)
  jobs[2].meta.onEnd();assert.equal(ends,1)
  for(const job of jobs)job.resolve()
  await result
})

test('speed multipliers match Tencent documented values and interpolate UI choices',()=>{
  for(const [rate,speed] of [[.6,-2],[.8,-1],[1,0],[1.2,1],[1.5,2],[2.5,6],[.9,-.5],[1.3,1.33]])assert.equal(tencentSpeed(rate),speed)
  for(const rate of [0,.5,2.6,NaN])assert.throws(()=>tencentSpeed(rate),/语音速度/)
})

test('server pins the chosen voice and passes credentials only in subprocess stdin',async t=>{
  let payload
  const f=fixture(t,async(script,data)=>{assert.equal(script,TENCENT_TTS_SCRIPT);payload=data;return {ok:true,audio:'SUQzBA==',requestId:'req-test'}})
  assert.deepEqual(await f.synthesize('你好，小云。',.9),{ok:true,audio:'SUQzBA==',mime:'audio/mpeg',provider:'tencent',voiceType:602003,requestId:'req-test',truncated:false})
  assert.equal(payload.voiceType,602003);assert.equal(payload.speed,-.5);assert.equal(payload.sampleRate,24000)
  assert.equal(payload.secretKey,'private-key');assert.equal(payload.timeoutSeconds,30)
  assert.doesNotMatch(TENCENT_TTS_SCRIPT,/private-key/)
})

test('overlong, empty, or invalid-speed requests fail before billing without truncating text',async t=>{
  let calls=0
  const f=fixture(t,async()=>{calls++;return {ok:true,audio:'SUQzBA=='}})
  for(const [text,speed] of [['甲'.repeat(151),1],['🐳'.repeat(114),1],['',1],['你好',4]])assert.equal((await f.synthesize(text,speed)).status,400)
  assert.equal(calls,0)
})

test('missing credentials and upstream invalid audio fail visibly',async t=>{
  assert.throws(()=>createTencentTts({runNode(){}}),/配置/)
  const f=fixture(t,async()=>({ok:true,audio:'not base64'}))
  assert.equal((await f.synthesize('你好')).status,502)
  const g=fixture(t,async()=>({ok:false,error:'AccountArrears'}))
  assert.match((await g.synthesize('你好')).error,/AccountArrears/)
  writeFileSync(g.credentialsFile,'{}')
  assert.throws(()=>createTencentTts({credentialsFile:g.credentialsFile}),/凭据不完整/)
})

test('SDK failures redact both credentials before returning an error to the browser',async t=>{
  const f=fixture(t,async()=>({}))
  const fake=join(f.dir,'sdk.cjs')
  writeFileSync(fake,"exports.tts={v20190823:{Client:class{TextToVoice(){return Promise.reject(new Error('private-id private-key invalid'))}}}}")
  const child=spawn(process.execPath,['-e',"let input='';process.stdin.on('data',c=>input+=c);process.stdin.on('end',()=>{const cfg=JSON.parse(input);"+TENCENT_TTS_SCRIPT+'});'],{stdio:['pipe','pipe','pipe']})
  const chunks=[];child.stdout.on('data',part=>chunks.push(part))
  child.stdin.end(JSON.stringify({sdkModule:fake,secretId:'private-id',secretKey:'private-key',text:'你好',voiceType:602003}))
  await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>code===0?resolve():reject(new Error('SDK child failed')))})
  const result=JSON.parse(Buffer.concat(chunks))
  assert.equal(result.ok,false);assert.match(result.error,/\[redacted\]/)
  assert.doesNotMatch(result.error,/private-id|private-key/)
})
