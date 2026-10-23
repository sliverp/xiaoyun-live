import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {runInNewContext} from 'node:vm'
import {createLiveMode} from './live-mode.js'

const ownerId='controls-owner-1234567890'
const flush=()=>new Promise(resolve=>setImmediate(resolve))
async function fixture(t,{html=false,opening=false}={}){
  process.env.VOICE_LIVE_INGEST_TOKEN='test-ingest'
  t.mock.timers.enable({apis:['setTimeout','Date'],now:1790000000000})
  const rootDir=mkdtempSync(join(tmpdir(),'xiaoyun-controls-')),listeners=new Map(),prompts=[],events=[],agents=new Map()
  const makeAgent=id=>({session:{id},status:'idle',followup(message){prompts.push(message.content[0].text);this.status='running'},cancel(){this.status='idle'}})
  agents.set('voice-live-main',makeAgent('voice-live-main'))
  const mode=createLiveMode({on(n,h){listeners.set(n,h)},get(){},effect(){}},{agents:{get:id=>agents.get(id),async create({sessionId}){const agent=makeAgent(sessionId);agents.set(sessionId,agent);return {agent}}},pushEvent:e=>events.push(e),textOf:c=>c[0].text,resolveAgentOptions(){},rootDir,synthesize:async()=>({ok:true,audio:'SUQzBA=='})})
  t.after(()=>{mode.stop();rmSync(rootDir,{recursive:true,force:true})})
  const tick=async(ms=110)=>{t.mock.timers.tick(ms);await flush()}
  const reply=(speech='完整讲解内容。')=>{const id=mode.status().sessionId;listeners.get('session/event')({id},{type:'assistant/message',data:{message:{content:[{type:'text',text:JSON.stringify({speech,navigation:'stay'})}]}}});agents.get(id).status='idle'}
  const ack=()=>mode.acknowledge({ownerId,turnId:mode.status().currentSpeech.turnId})
  const ingest=body=>mode.ingest({browserOpen:true,liveId:'room-a',events:[],...body})
  const page=n=>({open:true,url:'https://example.test/deck/#slide-'+n,title:'主题'+n,visibleText:'第'+n+'页内容',pageKey:'page-'+n,pageNumber:n,pageCount:8})
  mode.configure({systemPrompt:'你是小云。',sourceText:'# 第一页\n内容一。\n---\n# 第二页\n内容二。',presentationUrl:html?'https://example.test/deck/#slide-7':''})
  ingest(html?{presentation:page(7)}:{})
  await mode.start(ownerId);await tick(0)
  if(!opening){reply('开场欢迎。');ack();await tick();reply()}
  return {mode,prompts,events,reply,ack,tick,ingest,page}
}

test('pause retains the current turn and progress, with no model watchdog or automatic advance',async t=>{
  const f=await fixture(t),before=f.mode.status().currentSpeech.turnId,count=f.prompts.length
  f.mode.pause();await f.tick(60000)
  assert.equal(f.mode.status().running,true);assert.equal(f.mode.status().paused,true)
  assert.equal(f.mode.status().currentSpeech.turnId,before);assert.equal(f.mode.status().pageSourceTurns,0)
  assert.equal(f.prompts.length,count);assert.match(f.mode.status().stateMachine.current.execution,/已暂停/)
  f.ingest({});f.mode.resume();assert.equal(f.mode.status().currentSpeech.turnId,before)
  f.ack();await f.tick();assert.equal(f.mode.status().pageSourceTurns,1)
  assert.equal(f.mode.status().stateMachine.current.id,'source')
})

test('pause during text generation cancels the request and resumes the same unplayed stage',async t=>{
  const f=await fixture(t,{opening:true})
  f.mode.pause();f.reply('暂停之后迟到的开场。');await f.tick(60000)
  assert.equal(f.mode.status().currentSpeech,null);assert.equal(f.mode.status().paused,true)
  f.ingest({});f.mode.resume();await f.tick()
  assert.match(f.prompts.at(-1),/开场欢迎/)
  f.reply('继续生成的开场。');assert.equal(f.mode.status().currentSpeech.text,'继续生成的开场。')
})

test('an audio acknowledgement racing with pause records completion without starting another turn',async t=>{
  const f=await fixture(t),count=f.prompts.length
  f.mode.pause();f.ack();await f.tick()
  assert.equal(f.mode.status().pageSourceTurns,1);assert.equal(f.prompts.length,count)
  f.mode.resume();await f.tick();assert.equal(f.prompts.length,count+1)
})

test('the giveaway countdown remains frozen while paused and resumes with the same remaining time',async t=>{
  const f=await fixture(t)
  f.mode.requestLottery({keyword:'参与',waitSeconds:10});f.ack();await f.tick();f.ack()
  await f.tick(3000);f.mode.pause();assert.equal(f.mode.status().lottery.remainingSeconds,7)
  await f.tick(60000);assert.equal(f.mode.status().lottery.remainingSeconds,7)
  assert.equal(f.mode.status().lottery.current.state,'waiting')
  f.ingest({events:[{type:'comment',msgId:'winner',nickname:'幸运观众',content:'参与'}]})
  f.mode.resume();await f.tick(6999);assert.equal(f.mode.status().lottery.current.state,'waiting')
  f.ingest({});await f.tick(1);assert.equal(f.mode.status().lottery.current.state,'result')
  f.ack();await f.tick();assert.match(f.mode.status().currentSpeech.text,/幸运观众/)
})

test('restart clears text-slide progress, comments, draft audio, and the previous conversation',async t=>{
  const f=await fixture(t)
  f.mode.setSlide({index:1});await f.tick(200);f.reply('旧的第二页。')
  f.mode.prepareNext({ownerId,turnId:f.mode.status().currentSpeech.turnId,speed:1});await f.tick(0);f.reply('旧的预生成稿。');await f.tick(0)
  f.ingest({events:[{type:'comment',msgId:'old',nickname:'旧观众',content:'旧问题'}]})
  f.mode.pause();const sessionId=f.mode.status().sessionId
  await f.mode.restart(ownerId);await f.tick(0)
  const state=f.mode.status()
  assert.notEqual(state.sessionId,sessionId);assert.equal(state.slideIndex,0)
  assert.equal(state.pageSourceTurns,0);assert.equal(state.commentCount,0);assert.equal(state.paused,false)
  assert.equal(state.preparation,null);assert.equal(state.lottery.current,null)
  assert.equal(state.stateMachine.current.id,'opening');assert.match(f.prompts.at(-1),/开场欢迎/)
  assert.equal(f.events.some(e=>e.kind==='live-restarted'),true)
})

test('HTML restart reopens without the old page anchor and waits for the first page before the welcome',async t=>{
  const f=await fixture(t,{html:true}),count=f.prompts.length
  await f.mode.restart(ownerId);await f.tick(0)
  let state=f.mode.status()
  assert.equal(state.resetting,true);assert.equal(state.presentation.pageNumber,0)
  assert.equal(f.prompts.length,count);assert.equal(state.currentSpeech,null)
  const command=f.ingest({}).presentationCommand
  assert.equal(command.action,'open');assert.equal(command.url,'https://example.test/deck/')
  f.ingest({presentationAck:command.id,presentation:f.page(7)});await f.tick()
  assert.equal(f.prompts.length,count);assert.equal(f.mode.status().resetting,true)
  f.ingest({presentation:f.page(1)});await f.tick()
  state=f.mode.status();assert.equal(state.resetting,false);assert.equal(state.presentation.pageNumber,1)
  assert.equal(state.stateMachine.current.id,'opening');assert.match(f.prompts.at(-1),/第1页内容/)
  assert.doesNotMatch(f.prompts.at(-1),/第7页内容/)
})

test('invalid restart requests do not interrupt a valid current turn',async t=>{
  const f=await fixture(t),id=f.mode.status().currentSpeech.turnId
  await assert.rejects(f.mode.restart('invalid'),/标识/)
  assert.equal(f.mode.status().currentSpeech.turnId,id)
  f.ingest({browserOpen:false})
  await assert.rejects(f.mode.restart(ownerId),/连接/)
  assert.equal(f.mode.status().currentSpeech.turnId,id)
})

test('browser pause preserves the media position and queues, then resumes audio and BGM',async()=>{
  const source=readFileSync(new URL('./client.js',import.meta.url),'utf8'),a=source.indexOf('const applyLivePause = '),b=source.indexOf('\nconst exportLiveData = ',a)
  let plays=0,pauses=0,bgmStarts=0,bgmPauses=0,prepares=0
  const audio={currentTime:9.8,pause(){pauses++},async play(){plays++}}
  const queue=[{text:'未播片段'}],r={liveActive:true,outputAllowed:true,activeAudio:audio,audioQueue:queue,liveTurnId:'current-turn',liveOwnerId:ownerId,settings:{bgmEnabled:true},bgm:{state(){return {phase:'playing'}},setSpeaking(){}}}
  const apply=runInNewContext(source.slice(a,b)+'\napplyLivePause',{refs:{current:r},pauseBgm(){bgmPauses++},startBgm(){bgmStarts++},ensureOutputContext(){return {async resume(){}}},liveCall:async()=>{prepares++},API:{livePrepare:'prepare'},speechSpeed(){return 1},nextAudio(){},pumpSynthesis(){},setPlayback(){},setStatus(){}})
  apply(true);assert.equal(pauses,1);assert.equal(audio.currentTime,9.8);assert.equal(r.audioQueue,queue)
  apply(true);assert.equal(pauses,1);assert.equal(bgmPauses,1)
  apply(false);await flush();assert.equal(plays,1);assert.equal(bgmStarts,1);assert.equal(prepares,1)
  assert.equal(audio.currentTime,9.8);assert.equal(r.audioQueue.length,1)
})
