import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createLiveMode} from './live-mode.js'

const ownerId='owner-1234567890123456'
async function fixture(t,sourceText='# 内容\n讲解。\n---\n# 下一页\n继续。'){
  process.env.VOICE_LIVE_INGEST_TOKEN='test-ingest-key'
  t.mock.timers.enable({apis:['setTimeout','Date'],now:1790000000000})
  const rootDir=mkdtempSync(join(tmpdir(),'xiaoyun-lottery-flow-')),listeners=new Map(),prompts=[],events=[]
  const agent={session:{id:'voice-live-main'},status:'idle',followup(message){prompts.push(message.content[0].text);this.status='running'},cancel(){this.status='idle'}}
  const mode=createLiveMode({on(name,handler){listeners.set(name,handler)},effect(){},get(){}},{agents:{get(){return agent}},pushEvent:event=>events.push(event),textOf:content=>content[0].text,resolveAgentOptions(){},rootDir})
  t.after(()=>{mode.stop();rmSync(rootDir,{recursive:true,force:true})})
  const tick=async(ms=110)=>{t.mock.timers.tick(ms);await new Promise(resolve=>setImmediate(resolve))}
  const ingest=events=>mode.ingest({liveId:'room-a',browserOpen:true,captureAt:Date.now(),events})
  const reply=value=>{listeners.get('session/event')({id:'voice-live-main'},{type:'assistant/message',data:{message:{content:[{type:'text',text:JSON.stringify({navigation:'stay',...value})}]}}});agent.status='idle'}
  const ack=()=>mode.acknowledge({ownerId,turnId:mode.status().currentSpeech.turnId})
  mode.configure({systemPrompt:'你是小云',sourceText,commentFrequency:100})
  ingest([]);await mode.start(ownerId);await tick(0)
  reply({speech:'欢迎观众。'});ack();await tick()
  return {mode,prompts,events,ingest,reply,ack,tick}
}

test('giveaway waits for the complete source, freezes the first match at deadline, and never splits wait audio',async t=>{
  const f=await fixture(t)
  f.reply({speech:'甲'.repeat(180)+'。'+'乙'.repeat(180)})
  const sourceTurn=f.mode.status().currentSpeech.turnId
  assert.equal(f.mode.status().speechSegmentCount,2)
  f.mode.requestLottery({keyword:'小云送大礼',waitSeconds:10})
  assert.equal(f.mode.status().currentSpeech.turnId,sourceTurn)
  assert.equal(f.mode.status().lottery.current.state,'queued')
  assert.throws(()=>f.mode.requestLottery(),/已有一轮/)
  f.ingest([{type:'comment',msgId:'old',nickname:'旧弹幕',content:'小云送大礼'}])
  f.ack();await f.tick()
  assert.equal(f.mode.status().stateMachine.current.id,'lottery-announcement')
  assert.match(f.mode.status().currentSpeech.text,/一件文化衫/)
  assert.equal(f.mode.status().lottery.current.startedAt,null)
  f.ack()
  assert.equal(f.mode.status().stateMachine.current.id,'lottery-wait')
  await f.tick(3000)
  f.ingest([
    {type:'comment',msgId:'winner',viewerId:'first-platform-id',nickname:'中奖者完整ID',content:'小云送大礼'},
    {type:'comment',msgId:'second',nickname:'第二位',content:'小云送大礼'},
    {type:'comment',msgId:'question',nickname:'观众问题',content:'这个怎么部署？'},
  ])
  const waitTurn=f.mode.status().currentSpeech.turnId
  await f.tick(7000)
  assert.equal(f.mode.status().lottery.current.winner.nickname,'中奖者完整ID')
  assert.equal(f.mode.status().currentSpeech.turnId,waitTurn)
  assert.equal(f.mode.status().stateMachine.current.id,'lottery-wait')
  f.ingest([{type:'comment',msgId:'late',nickname:'超时用户',content:'小云送大礼'}])
  f.ack();await f.tick()
  assert.equal(f.mode.status().stateMachine.current.id,'lottery-result')
  assert.match(f.mode.status().currentSpeech.text,/恭喜中奖者完整ID/)
  f.ack();await f.tick()
  assert.equal(f.mode.status().lottery.current.state,'completed')
  assert.equal(f.mode.status().stateMachine.current.id,'comment')
  assert.match(f.prompts.at(-1),/观众问题/)
  assert.doesNotMatch(f.prompts.at(-1),/第二位/)
  assert.equal(f.mode.status().pageSourceTurns,1)
})

test('ending the show cancels a pending giveaway; immediate stop clears its timer and late output',async t=>{
  const f=await fixture(t)
  f.reply({speech:'继续分享。'});f.mode.requestLottery()
  f.mode.finish()
  assert.equal(f.mode.status().lottery.current.state,'cancelled')
  f.ack();await f.tick()
  assert.equal(f.mode.status().stateMachine.current.id,'closing')
  f.reply({speech:'谢谢大家，再见。'});f.ack()
  const count=f.events.length;await f.tick(10000)
  assert.equal(f.events.length,count)
  assert.equal(f.mode.status().running,false)
})

test('a queued giveaway completes before automatic final-page goodbye, including an empty result',async t=>{
  const f=await fixture(t,'本场总结。')
  f.reply({speech:'内容讲完了。',navigation:'next'});f.mode.requestLottery({keyword:'中奖口令',waitSeconds:5})
  f.ack();await f.tick()
  assert.equal(f.mode.status().stateMachine.current.id,'lottery-announcement')
  f.ack();f.ack();await f.tick(5000);await f.tick()
  assert.equal(f.mode.status().stateMachine.current.id,'lottery-result')
  assert.equal(f.mode.status().lottery.current.winner,null)
  assert.match(f.mode.status().currentSpeech.text,/没有中奖者/)
  f.ack();await f.tick()
  assert.equal(f.mode.status().stateMachine.current.id,'closing')
})

test('a manual page change cannot strand an announcement without an audio acknowledgement',async t=>{
  const f=await fixture(t)
  f.reply({speech:'原来的讲解。'});f.mode.requestLottery();f.ack();await f.tick()
  assert.throws(()=>f.mode.setSlide({index:1}),/抽奖正在进行/)
  f.ack();f.mode.stop();await f.tick(10000)
  assert.equal(f.mode.status().lottery.current.state,'cancelled')
  assert.equal(f.mode.status().currentSpeech,null)
})

test('a quiet comment feed does not reject queuing and the draw starts at the next complete audio boundary',async t=>{
  const f=await fixture(t)
  f.reply({speech:'正在播放的一段完整讲解。'})
  const turnId=f.mode.status().currentSpeech.turnId
  await f.tick(31000)
  f.mode.ingest({browserOpen:true,events:[]})
  assert.ok(Date.now()-f.mode.status().captureAt>30000)
  f.mode.requestLottery({keyword:'小云送大礼',waitSeconds:10})
  assert.equal(f.mode.status().lottery.current.state,'queued')
  assert.equal(f.mode.status().currentSpeech.turnId,turnId)
  f.ack();await f.tick()
  assert.equal(f.mode.status().stateMachine.current.id,'lottery-announcement')
  assert.match(f.mode.status().currentSpeech.text,/送出一件文化衫/)
})

test('a draw can queue while the bridge is disconnected and begins only after reconnection',async t=>{
  const f=await fixture(t)
  f.reply({speech:'这一整段先播完。'})
  await f.tick(16000)
  f.mode.requestLottery()
  f.ack();await f.tick()
  assert.equal(f.mode.status().lottery.current.state,'queued')
  assert.equal(f.mode.status().phase,'waiting-bridge')
  assert.equal(f.mode.status().currentSpeech,null)
  f.ingest([]);await f.tick()
  assert.equal(f.mode.status().lottery.current.state,'announcing')
  assert.equal(f.mode.status().stateMachine.current.id,'lottery-announcement')
})

test('a first matching viewer survives more than a thousand subsequent comments while ordinary AI intake stays at 100',async t=>{
  const f=await fixture(t)
  f.reply({speech:'先讲完这一段。'});f.mode.requestLottery();f.ack();await f.tick();f.ack()
  f.ingest(Array.from({length:1200},(_,i)=>({type:'comment',msgId:'volume-'+i,nickname:i===0?'最早参与者':'后来的观众'+i,content:i===0?'小云送大礼':'一个普通问题'+i})))
  assert.equal(f.mode.status().commentCount,100)
  assert.equal(f.mode.status().commentQueue.limit,100)
  await f.tick(10000)
  assert.equal(f.mode.status().lottery.current.winner.nickname,'最早参与者')
  f.ack();await f.tick()
  assert.match(f.mode.status().currentSpeech.text,/最早参与者.*文化衫.*屏幕右下方/)
  f.ack();await f.tick()
  const candidates=JSON.parse(f.prompts.at(-1).match(/弹幕 JSON：(\[.*\])\n群体回应/s)[1])
  assert.equal(candidates.length,100)
  assert.equal(candidates[0].nickname,'后来的观众1100')
  assert.equal(candidates.at(-1).nickname,'后来的观众1199')
})
