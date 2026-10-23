import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,readFileSync,cpSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createLiveMode} from './live-mode.js'
const owner='broadcast-owner-123456789',remote='monitor-owner-987654321'
const flush=()=>new Promise(resolve=>setImmediate(resolve))
async function fixture(t,{rootDir,config={},start=true,clock=true}={}){
  process.env.VOICE_LIVE_INGEST_TOKEN='test-ingest'
  if(clock)t.mock.timers.enable({apis:['setTimeout','Date'],now:Date.parse('2026-10-21T10:00:00+08:00')})
  const dir=rootDir||mkdtempSync(join(tmpdir(),'live-long-run-')),listeners=new Map(),events=[],requests=[],agents=new Map(),cleanups=[]
  let disposed=0
  const mode=createLiveMode({on(n,h){listeners.set(n,h)},get(){},effect(fn){cleanups.push(fn())}},{rootDir:dir,pushEvent:e=>events.push(e),textOf:c=>c[0].text,resolveAgentOptions(){},generation:{freshSession:true},agents:{get:id=>agents.get(id),async create({sessionId,setup}){
    const sections=[];setup({systemPrompt:{section(section){sections.push(section)}},tools:{restrict(){}}})
    const agent={session:{id:sessionId},status:'idle',followup(message){this.status='running';requests.push({id:sessionId,prompt:message.content[0].text,system:sections.map(s=>s.text()).join('\n')})},cancel(){this.status='idle'}}
    agents.set(sessionId,agent)
    return {agent,async dispose(){disposed++;agents.delete(sessionId)}}
  }}})
  t.after(async()=>{mode.stop();for(const cleanup of cleanups)await cleanup();rmSync(dir,{recursive:true,force:true})})
  const tick=async(ms=110)=>{t.mock.timers.tick(ms);await flush();await flush()}
  const ingest=body=>mode.ingest({browserOpen:true,liveId:'room',events:[],...body})
  const reply=(speech='这一段完整讲解。',navigation='stay')=>{const id=mode.status().sessionId;listeners.get('session/event')({id},{type:'assistant/message',data:{message:{content:[{type:'text',text:JSON.stringify({speech,navigation})}]}}});agents.get(id).status='idle'}
  const ack=()=>mode.acknowledge({ownerId:owner,turnId:mode.status().currentSpeech.turnId})
  if(!rootDir){mode.configure({systemPrompt:'你是小云，始终保留身份和知识库。',sourceText:'# 第一页\n唯一当前页材料。\n---\n# 第二页\n新的主题。',welcomeScript:'欢迎大家。',...config});mode.configureAutomation({contextMaxTurns:1,autoRecover:true,loopEnabled:true})}
  ingest({});mode.heartbeat({clientId:owner,name:'OBS电脑'});mode.heartbeat({clientId:remote,name:'监控电脑'})
  if(start){await mode.start(owner);await tick(0);ack();await tick()}
  const award=async()=>{
    reply();mode.requestLottery({keyword:'参与',waitSeconds:5});ack();await tick();ack()
    ingest({events:[{type:'comment',msgId:'winning',nickname:'幸运观众',content:'参与'}]});await tick(5000);ack();await tick();ack();await tick()
  }
  return {mode,dir,requests,events,agents,reply,ack,ingest,tick,award,get disposed(){return disposed}}
}

test('a monitor can restart the global show while the OBS machine keeps playback ownership and the awarded pool',async t=>{
  const f=await fixture(t);await f.award()
  assert.equal(f.mode.status().lottery.drawsUsed,1)
  const id=f.mode.status().lottery.current.id
  await f.mode.restart(remote);await f.tick(0)
  assert.equal(f.mode.status().ownerId,owner)
  assert.equal(f.mode.status().lottery.drawsUsed,1);assert.equal(f.mode.status().lottery.current.id,id)
  assert.equal(f.mode.status().slideIndex,0)
  await f.mode.start(remote);assert.equal(f.mode.status().ownerId,owner)
  await f.mode.start(remote,{takeover:true});assert.equal(f.mode.status().ownerId,remote)
  assert.deepEqual(f.mode.status().playback.clients.map(c=>c.role).sort(),['monitor','playback'])
})

test('automatic final-page looping resets only the content flow and retains the prize ledger',async t=>{
  const f=await fixture(t,{config:{sourceText:'唯一一页的内容。'}});await f.award()
  f.reply('本轮已经讲完。','next');f.ack();await f.tick();await f.tick()
  assert.equal(f.mode.status().continuity.cycle,2)
  assert.equal(f.mode.status().lottery.drawsUsed,1)
  assert.equal(f.mode.status().ownerId,owner)
  assert.equal(f.mode.status().stateMachine.current.id,'source')
  assert.doesNotMatch(f.requests.at(-1).prompt,/收尾告别/)
})

test('ending the whole show plays goodbye and revokes automatic restart even when looping is enabled',async t=>{
  const f=await fixture(t,{config:{closingScript:'感谢大家，本场直播结束，拜拜。'}})
  f.reply('先完整讲完这一段。');const turn=f.mode.status().currentSpeech.turnId
  f.mode.finish();assert.equal(f.mode.status().currentSpeech.turnId,turn)
  f.ack();await f.tick();assert.equal(f.mode.status().stateMachine.current.id,'closing')
  assert.equal(f.mode.status().currentSpeech.text,'感谢大家，本场直播结束，拜拜。')
  f.ack();assert.equal(f.mode.status().running,false);assert.equal(f.mode.status().continuity.wanted,false)
  await f.tick(120000);f.ingest({});f.mode.supervise();await f.tick()
  assert.equal(f.mode.status().running,false);assert.equal(f.mode.status().continuity.cycle,1)
})

test('two minutes without advancing audio recovers a stuck turn; a monitor heartbeat and repeated timestamps cannot conceal silence',async t=>{
  const f=await fixture(t);f.reply();const stale=f.mode.status().currentSpeech.turnId
  await f.tick(119999-(Date.now()-f.mode.status().playback.lastSoundAt));f.ingest({});f.mode.heartbeat({clientId:remote,progress:{turnId:stale,piece:0,seconds:20}});f.mode.supervise();await f.tick(0)
  assert.equal(f.mode.status().continuity.recoveries,0)
  await f.tick(1);f.mode.supervise();await f.tick(0);await f.tick()
  assert.equal(f.mode.status().continuity.recoveries,1)
  assert.notEqual(f.mode.status().currentSpeech?.turnId,stale)
  assert.equal(f.mode.status().ownerId,owner)
  assert.equal(f.mode.status().lottery.drawsUsed,0)
  assert.throws(()=>f.mode.acknowledge({ownerId:owner,turnId:stale}))
})

test('real progress postpones recovery; manual pause and stop never automatically unpause or restart',async t=>{
  const f=await fixture(t);f.reply();const turnId=f.mode.status().currentSpeech.turnId
  await f.tick(110000);f.ingest({});f.mode.heartbeat({clientId:owner,progress:{turnId,piece:0,seconds:2}})
  await f.tick(119000);f.mode.heartbeat({clientId:owner,progress:{turnId,piece:0,seconds:2}});f.mode.supervise();await f.tick(0)
  assert.equal(f.mode.status().continuity.recoveries,0)
  f.mode.pause();await f.tick(240000);f.mode.supervise();await f.tick(0)
  assert.equal(f.mode.status().paused,true);assert.equal(f.mode.status().continuity.recoveries,0)
  f.mode.stop();await f.tick(240000);f.mode.supervise();await f.tick(0)
  assert.equal(f.mode.status().running,false)
})

test('playback errors remain eligible for recovery while an explicit stop revokes the recovery intent',async t=>{
  const f=await fixture(t);f.reply();f.mode.playbackError({ownerId:owner,turnId:f.mode.status().currentSpeech.turnId,error:'模拟播放失败'})
  assert.equal(f.mode.status().running,false);assert.equal(f.mode.status().continuity.wanted,true)
  await f.tick(120000);f.ingest({});f.mode.supervise();await f.tick(0);await f.tick()
  assert.equal(f.mode.status().running,true);assert.equal(f.mode.status().continuity.recoveries,1)
})

test('48 virtual hours of half-minute turns keep one active agent, bounded inputs, identity, and recent page notes',async t=>{
  const f=await fixture(t);let max=0
  const started=Date.now()
  for(let step=0;step<5760;step++){
    t.mock.timers.setTime(started+step*30000);f.ingest({})
    f.reply('当前页要点编号'+step+'。这是已经播出的说明，不需要重复。');f.ack()
    await f.tick()
    max=Math.max(max,f.requests.at(-1).prompt.length)
    assert.equal(f.agents.size,1)
    assert.match(f.requests.at(-1).system,/始终保留身份和知识库/)
  }
  assert.ok(f.disposed>=5760)
  assert.ok(max<9000)
  assert.ok(f.mode.status().context.memory.characters<=2800)
  assert.equal(f.mode.status().context.sessionTurns,1)
  assert.doesNotMatch(f.requests.at(-1).prompt,/当前页要点编号0。/)
})

test('expired comments and the previously completed page are omitted from the next request; long floods fit the input budget',async t=>{
  const f=await fixture(t)
  f.reply('旧页面已经讲过的独特细节。');f.ack();await f.tick()
  f.mode.setSlide({index:1});await f.tick(200)
  assert.match(f.requests.at(-1).prompt,/新的主题/)
  assert.doesNotMatch(f.requests.at(-1).prompt,/旧页面已经讲过的独特细节/)
  f.reply('当前这一页继续讲。')
  f.ingest({events:[{type:'comment',msgId:'expired',nickname:'旧观众',content:'已经过期的问题'}]})
  t.mock.timers.setTime(Date.now()+121000)
  f.ingest({events:Array.from({length:100},(_,i)=>({type:'comment',msgId:'long-'+i,nickname:'观众'+i,content:'很长的当前问题'.repeat(80)}))})
  f.ack();await f.tick()
  const prompt=f.requests.at(-1).prompt,candidates=JSON.parse(prompt.match(/弹幕 JSON：(\[.*\])\n群体回应/s)[1])
  assert.doesNotMatch(prompt,/已经过期的问题/)
  assert.ok(candidates.length>0&&candidates.length<100)
  assert.ok(Buffer.byteLength(JSON.stringify(candidates),'utf8')<=24000)
  assert.equal(candidates.at(-1).nickname,'观众99')
})

test('an automatic rule queues at the next audio boundary and its claim survives a global restart',async t=>{
  const f=await fixture(t);f.mode.stop()
  f.mode.configureAutomation({lotterySchedule:{enabled:true,intervalMinutes:1},contextMaxTurns:1})
  f.ingest({});await f.mode.start(owner);await f.tick(0);f.ack();await f.tick();f.reply('先完整播出这一段。')
  const turnId=f.mode.status().currentSpeech.turnId
  await f.tick(60000);f.ingest({});f.mode.supervise()
  assert.equal(f.mode.status().lottery.current.state,'queued')
  assert.equal(f.mode.status().currentSpeech.turnId,turnId)
  f.ack();await f.tick()
  assert.equal(f.mode.status().stateMachine.current.id,'lottery-announcement')
  await f.mode.restart(remote);await f.tick(0);f.mode.supervise()
  assert.equal(f.mode.status().lotterySchedule.claimedCount,1)
  assert.notEqual(f.mode.status().lottery.current.state,'queued')
  assert.equal(f.mode.status().ownerId,owner)
})

test('awarded prizes cannot be edited or removed; appending new prizes preserves the used count',async t=>{
  const f=await fixture(t);await f.award();f.mode.stop()
  assert.throws(()=>f.mode.configureAutomation({prizes:['另一份礼物']}),/已发出的奖品/)
  f.mode.configureAutomation({prizes:['一件文化衫','一个马年公仔','一张代金券']})
  assert.equal(f.mode.status().lottery.drawsUsed,1)
  assert.equal(f.mode.status().lottery.drawsTotal,3)
})

test('an awarded winner is replayed after an audio fault without another draw or another prize debit',async t=>{
  const f=await fixture(t)
  f.reply();f.mode.requestLottery({keyword:'参与',waitSeconds:5});f.ack();await f.tick();f.ack()
  f.ingest({events:[{type:'comment',msgId:'selected',nickname:'已确定的中奖者',content:'参与'}]});await f.tick(5000);f.ack();await f.tick()
  assert.equal(f.mode.status().lottery.drawsUsed,1)
  f.mode.playbackError({ownerId:owner,turnId:f.mode.status().currentSpeech.turnId,error:'开奖音频失败'})
  await f.tick(120000);f.ingest({});f.mode.supervise();await f.tick(0);await f.tick()
  assert.equal(f.mode.status().lottery.drawsUsed,1)
  assert.match(f.mode.status().currentSpeech.text,/已确定的中奖者.*文化衫/)
})

test('a service restart restores broadcast intent and the prize ledger after the original player reconnects',async t=>{
  const first=await fixture(t);await first.award()
  const dir=mkdtempSync(join(tmpdir(),'live-restored-'));cpSync(first.dir,dir,{recursive:true})
  const second=await fixture(t,{rootDir:dir,start:false,clock:false})
  assert.equal(second.mode.status().running,false);assert.equal(second.mode.status().continuity.wanted,true)
  second.mode.supervise();await second.tick(0);await second.tick()
  assert.equal(second.mode.status().running,true)
  assert.equal(second.mode.status().lottery.drawsUsed,1)
  assert.equal(second.mode.status().ownerId,owner)
  assert.match(second.requests.at(-1).system,/始终保留身份/)
})

test('an intentionally paused show stays paused across a service restart until a remote operator resumes it',async t=>{
  const first=await fixture(t);first.mode.pause()
  const dir=mkdtempSync(join(tmpdir(),'live-paused-restored-'));cpSync(first.dir,dir,{recursive:true})
  const second=await fixture(t,{rootDir:dir,start:false,clock:false})
  second.mode.supervise();await second.tick(240000)
  assert.equal(second.mode.status().running,false);assert.equal(second.mode.status().paused,true)
  second.mode.resume();await second.tick(0);await second.tick()
  assert.equal(second.mode.status().running,true);assert.equal(second.mode.status().paused,false)
  assert.equal(second.mode.status().ownerId,owner)
})

test('a remote start request during a recoverable failure restores the original broadcaster instead of stealing playback',async t=>{
  const f=await fixture(t);f.reply()
  f.mode.playbackError({ownerId:owner,turnId:f.mode.status().currentSpeech.turnId,error:'暂时故障'})
  await f.mode.start(remote);await f.tick()
  assert.equal(f.mode.status().running,true)
  assert.equal(f.mode.status().ownerId,owner)
})

test('owner heartbeats without audio progress remain valid between spoken turns and do not postpone silence recovery',async t=>{
  const f=await fixture(t)
  assert.equal(f.mode.status().currentSpeech,null)
  const lastSoundAt=f.mode.status().playback.lastSoundAt
  await f.tick(1000)
  for(const progress of [null,undefined,{}, {piece:0,seconds:10}]){
    const state=f.mode.heartbeat({clientId:owner,name:'OBS电脑',progress})
    assert.equal(state.playback.lastSoundAt,lastSoundAt)
    assert.equal(state.running,true)
  }
  f.reply('现在开始完整播出。')
  const turnId=f.mode.status().currentSpeech.turnId
  f.mode.heartbeat({clientId:owner,progress:null})
  f.mode.heartbeat({clientId:owner,progress:{turnId:'old-turn',piece:0,seconds:10}})
  assert.equal(f.mode.status().playback.lastSoundAt,lastSoundAt)
  f.mode.heartbeat({clientId:owner,progress:{turnId,piece:0,seconds:1}})
  assert.equal(f.mode.status().playback.lastSoundAt,Date.now())
})
