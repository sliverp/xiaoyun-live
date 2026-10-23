import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {splitTencentSpeech} from './tencent-tts.js'

const client=readFileSync(new URL('./client.js',import.meta.url),'utf8')
const snippet=client.slice(client.indexOf('const handleLiveSpeech = '),client.indexOf('\nReact.useEffect(()=>{',client.indexOf('const handleLiveSpeech = ')))
const fixture=(speed=1)=>{
  const refs={current:{liveActive:true,liveOwnerId:'owner-a',settings:{speed}}},played=[],requests=[],calls=[]
  const handle=runInNewContext(snippet+'\nhandleLiveSpeech',{
    refs,applyLivePause(){},API:{livePrepare:'prepare',liveAck:'ack'},setLiveStatus(){},updateLiveStatus(){},setLiveError(message){throw new Error(message)},
    ttsConfig:settings=>({speed:settings.speed}),requestTts(...args){requests.push(args)},playAudio(...args){played.push(args)},
    liveCall:async(path,body)=>{calls.push({path,body});return {ok:true,status:{}}},
  })
  return {refs,played,requests,calls,handle}
}

test('prepared audio plays directly, starts one lookahead, and acknowledges only the last piece',async()=>{
  const f=fixture(),event={ownerId:'owner-a',turnId:'turn-2',text:'甲。乙。',audioSpeed:1,audioSegments:[{text:'甲。',audio:'AAA=',mime:'audio/mpeg'},{text:'乙。',audio:'BBB=',mime:'audio/mpeg'}]}
  f.handle(event)
  assert.equal(f.requests.length,0);assert.equal(f.played.length,2)
  assert.equal(f.played[0][4].onEnd,undefined);assert.equal(typeof f.played[1][4].onStart,'function')
  f.played[0][4].onStart();f.played[0][4].onStart();await Promise.resolve()
  assert.equal(f.calls.length,1);assert.equal(f.calls[0].path,'prepare')
  assert.equal(f.calls[0].body.turnId,'turn-2')
  f.played[1][4].onStart();assert.equal(f.refs.current.liveProgressPiece,1);
  f.played[1][4].onEnd();await Promise.resolve()
  assert.equal(f.calls[1].path,'ack')
  f.handle(event);assert.equal(f.played.length,2)
})

test('changing speed discards incompatible prepared audio and synthesizes the same text at the new speed',()=>{
  const f=fixture(.9)
  f.handle({ownerId:'owner-a',turnId:'turn-3',text:'下一段。',segments:['下一段。'],audioSpeed:1,audioSegments:[{text:'下一段。',audio:'AAA='}]})
  assert.equal(f.played.length,0);assert.equal(f.requests.length,1)
  assert.equal(f.requests[0][0],'下一段。');assert.equal(f.requests[0][1].speed,.9)
  assert.equal(typeof f.requests[0][3].onStart,'function');assert.equal(typeof f.requests[0][3].onEnd,'function')
})

test('server and bundled browser use the same provider byte and punctuation segmentation',()=>{
  const marked=client.split('// BEGIN TENCENT SPEECH SEGMENTS')[1].split('// END TENCENT SPEECH SEGMENTS')[0]
  const split=runInNewContext(marked+'\nsplitTencentSpeech',{TextEncoder})
  for(const text of ['甲。'.repeat(300),'🐳'.repeat(250),'a'.repeat(900),'第一句。'+'甲'.repeat(140)+'，继续说。'+'乙'.repeat(160)])assert.deepEqual(Array.from(split(text)),splitTencentSpeech(text))
})

test('event retention keeps prepared audio only for the current speech',()=>{
  const host=readFileSync(new URL('./index.js',import.meta.url),'utf8'),a=host.indexOf('  const pushEvent = '),b=host.indexOf('  const streamSpeech = ',a)
  const events=[],push=runInNewContext('let eventSeq=0;'+host.slice(a,b)+'\npushEvent',{events,Date})
  push({kind:'live-speech',turnId:'one',audioSegments:[{audio:'first'}]})
  push({kind:'message',text:'ordinary event'})
  assert.ok(events[0].audioSegments)
  push({kind:'live-speech',turnId:'two',audioSegments:[{audio:'second'}]})
  assert.equal(events[0].audioSegments,undefined);assert.ok(events[2].audioSegments)
  push({kind:'live-stopped'})
  assert.equal(events[2].audioSegments,undefined)
})
