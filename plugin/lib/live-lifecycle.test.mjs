import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createLiveMode,parseReply} from './live-mode.js'
import {LIVE_STATES,planLiveTurn} from './live-state.js'

const ownerId='owner-1234567890123456'
const turn=()=>new Promise(resolve=>setTimeout(resolve,160))

function fixture() {
  process.env.VOICE_LIVE_INGEST_TOKEN='ingest-test-secret'
  const dir=mkdtempSync(join(tmpdir(),'dsh-live-lifecycle-'))
  const listeners=new Map(),events=[],prompts=[]
  const agent={session:{id:'voice-live-main'},status:'idle',followup(input){prompts.push(input.content[0].text);this.status='running'},cancel(){this.status='idle'}}
  const mode=createLiveMode({on(name,callback){listeners.set(name,callback)},effect(){},get(){}},{
    agents:{get(){return agent},async create(){throw new Error('Fixture uses the existing agent')}},
    rootDir:dir,pushEvent(event){events.push(event)},textOf(content){return content?.[0]?.text||''},resolveAgentOptions(){},
  })
  mode.configure({systemPrompt:'你是小云，分享云端 Agent。',sourceText:'# 云端 Agent\n随时在线。\n---\n# 总结\n用 Agent 完成任务。'})
  mode.ingest({browserOpen:true,events:[]})
  const reply=value=>{listeners.get('session/event')({id:'voice-live-main'},{type:'assistant/message',data:{message:{content:[{type:'text',text:JSON.stringify({navigation:'stay',...value})}]}}});agent.status='idle'}
  const ack=()=>mode.acknowledge({ownerId,turnId:mode.status().currentSpeech.turnId})
  const opening=async()=>{await mode.start(ownerId);await new Promise(resolve=>setImmediate(resolve));reply({speech:'欢迎大家，我是小云。'});ack();await turn()}
  const dispose=()=>{mode.stop();rmSync(dir,{recursive:true,force:true})}
  return {mode,agent,events,prompts,reply,ack,opening,dispose,listeners}
}

test('state decisions show priorities and never schedule comments before a full source turn',()=>{
  assert.equal(LIVE_STATES.length,15)
  const s={openingPending:false,closingRequested:false,bridgeReady:true,pageReady:true,frequency:80,unreadCount:100,sourceSinceComment:0,commentElapsedMs:100000,sourceFinished:false,engagementPending:true,navigationPending:true}
  assert.equal(planLiveTurn(s).next.id,'engagement')
  assert.equal(planLiveTurn({...s,sourceSinceComment:1}).next.id,'comment')
  assert.equal(planLiveTurn({...s,closingRequested:true,openingPending:true,bridgeReady:false}).next.id,'closing')
  assert.equal(planLiveTurn({...s,openingPending:true}).next.id,'opening')
  assert.equal(planLiveTurn({...s,bridgeReady:false}).next.id,'waiting')
  const manual=planLiveTurn({...s,sourceFinished:true,unreadCount:0,engagementPending:false,navigationPending:false})
  assert.equal(manual.next.id,'waiting')
  assert.ok(manual.next.condition.includes('关闭'))
})

test('one start welcomes once, playback ownership takeover keeps the same opening turn',async()=>{
  const f=fixture()
  try {
    await f.mode.start(ownerId);await new Promise(resolve=>setImmediate(resolve))
    assert.equal(f.mode.status().stateMachine.current.id,'opening')
    assert.match(f.prompts[0],/开场欢迎/)
    f.reply({speech:'欢迎大家，我是小云。'})
    const first=f.mode.status().currentSpeech.turnId
    await f.mode.start('owner-9876543210987654',{takeover:true})
    assert.equal(f.mode.status().currentSpeech.turnId,first)
    assert.equal(f.prompts.length,1)
    f.mode.acknowledge({ownerId:'owner-9876543210987654',turnId:first});await turn()
    assert.equal(f.mode.status().stateMachine.current.id,'source')
    assert.doesNotMatch(f.prompts[1],/本次直播的开场欢迎/)
  }finally{f.dispose()}
})

test('each recorded narration request includes the newest live counters and their observation time',async()=>{
  const f=fixture(),at=Date.now()
  try {
    f.mode.ingest({browserOpen:true,liveId:'room',metricsSnapshots:[{at,liveId:'room',platformState:'live',fields:{onlineUsers:{value:42,raw:'42',at,source:'api'}},extra:{}}],events:[]})
    await f.opening()
    assert.match(f.prompts.at(-1),/当前直播数据/)
    assert.match(f.prompts.at(-1),/"在线人数":\{"value":42/)
    assert.match(f.prompts.at(-1),/observedAt/)
    assert.equal(f.mode.status().analytics.current.snapshotCount,1)
  }finally{f.dispose()}
})

test('finish waits for every audio segment, generates goodbye, and stops only after its acknowledgement',async()=>{
  const f=fixture()
  try {
    await f.opening()
    f.reply({speech:'甲'.repeat(175)+'。'+'乙'.repeat(172)})
    const first=f.mode.status().currentSpeech.turnId
    assert.equal(f.mode.status().speechSegmentCount,2)
    f.mode.finish();await turn()
    assert.equal(f.mode.status().running,true)
    assert.equal(f.mode.status().stateMachine.current.id,'source')
    assert.equal(f.mode.status().stateMachine.metrics.closingRequested,true)
    assert.equal(f.mode.status().currentSpeech.turnId,first)
    assert.equal(f.prompts.length,2)
    f.ack();await turn()
    assert.equal(f.mode.status().stateMachine.current.id,'closing')
    assert.match(f.prompts.at(-1),/场控请求结束直播/)
    f.reply({speech:'谢谢大家陪我分享，祝大家玩得开心，再见！'})
    assert.equal(f.mode.status().running,true)
    f.ack()
    assert.equal(f.mode.status().running,false)
    assert.equal(f.mode.status().stateMachine.current.id,'ended')
    assert.deepEqual(f.mode.status().stateMachine.history.map(entry=>entry.to),['opening','scheduling','source','scheduling','closing','ended'])
    assert.equal(f.events.at(-1).kind,'live-stopped')
  }finally{f.dispose()}
})

test('a stop while the initial agent is loading prevents a late start from opening the show',async()=>{
  process.env.VOICE_LIVE_INGEST_TOKEN='ingest-test-secret'
  const dir=mkdtempSync(join(tmpdir(),'dsh-live-loading-'))
  let release
  const created=new Promise(resolve=>{release=resolve})
  const agent={session:{id:'voice-live-main'},status:'idle',followup(){throw new Error('Canceled start must not send a prompt')},cancel(){}}
  const mode=createLiveMode({on(){},effect(){},get(){}},{agents:{get(){},create(){return created}},rootDir:dir,pushEvent(){},textOf(){},resolveAgentOptions(){}})
  try {
    mode.configure({systemPrompt:'主持',sourceText:'主题'})
    mode.ingest({browserOpen:true,events:[]})
    const start=mode.start(ownerId)
    mode.stop();release({agent});await start
    assert.equal(mode.status().running,false)
    assert.equal(mode.status().stateMachine.current.id,'ended')
  }finally{mode.stop();rmSync(dir,{recursive:true,force:true})}
})

test('an immediate stop cancels narration and a late model message cannot restart output',async()=>{
  const f=fixture()
  try {
    await f.opening();f.mode.stop()
    const count=f.events.length
    f.reply({speech:'这个迟到的回复不能播放。'})
    await turn()
    assert.equal(f.events.length,count)
    assert.equal(f.mode.status().stateMachine.current.id,'ended')
    assert.equal(f.mode.status().currentSpeech,null)
  }finally{f.dispose()}
})

test('a playback failure moves to error, while a stale audio owner cannot interrupt another turn',async()=>{
  const f=fixture()
  try {
    await f.opening();f.reply({speech:'继续分享。'})
    const turnId=f.mode.status().currentSpeech.turnId
    assert.throws(()=>f.mode.playbackError({ownerId:'stale-owner',turnId,error:'音频失败'}),/不匹配/)
    assert.equal(f.mode.status().running,true)
    f.mode.playbackError({ownerId,turnId,error:'音频无法解码'})
    assert.equal(f.mode.status().running,false)
    assert.equal(f.mode.status().stateMachine.current.id,'error')
    assert.match(f.mode.status().error,/音频无法解码/)
    assert.equal(f.events.at(-1).kind,'live-error')
  }finally{f.dispose()}
})

test('a source-completion signal on the last HTML page goes to goodbye without asking Chrome to advance',async()=>{
  const f=fixture()
  try {
    f.mode.configure({systemPrompt:'你是小云。',sourceText:'',presentationUrl:'https://example.com/deck/'})
    f.mode.ingest({browserOpen:true,presentation:{open:true,url:'https://example.com/deck/#slide-26',visibleText:'产品价值总结',pageKey:'last-page',pageNumber:26,pageCount:26},events:[]})
    await f.opening()
    assert.match(f.prompts.at(-1),/当前是最后一页/)
    f.reply({speech:'这些能力可以让 Agent 持续帮大家完成实际工作。',navigation:'next'})
    f.ack();await turn()
    assert.equal(f.mode.status().stateMachine.current.id,'closing')
    assert.match(f.prompts.at(-1),/全部素材已经讲解完成/)
    assert.equal(f.mode.ingest({browserOpen:true,events:[]}).presentationCommand,null)
  }finally{f.dispose()}
})

test('interaction is a separate short turn; all fresh comments come first and the lecture resumes afterward',async t=>{
  let now=Date.now()
  t.mock.method(Date,'now',()=>now)
  const f=fixture()
  try {
    f.mode.configure({systemPrompt:'你是小云。',sourceText:'# 主题\n云端的价值。',engagementMinTurns:2,engagementCooldownSeconds:30})
    await f.opening()
    for(let i=0;i<2;i++){f.reply({speech:'继续讲一个主题要点。'});f.ack();await turn()}
    now+=31000
    f.reply({speech:'云端适合持续运行的任务。',interaction:{type:'question',speech:'你最想让 Agent 帮你做什么？'}})
    f.mode.ingest({browserOpen:true,events:[{type:'comment',msgId:'q1',nickname:'观众甲',content:'想让它帮忙整理日报'}]})
    f.ack();await turn()
    assert.equal(f.mode.status().stateMachine.current.id,'comment')
    f.reply({speech:'整理日报就是一个很适合持续运行的场景。',selectedId:'1'});f.ack();await turn()
    assert.equal(f.mode.status().stateMachine.current.id,'engagement')
    assert.equal(f.mode.status().currentSpeech.text,'你最想让 Agent 帮你做什么？')
    f.ack();await turn()
    assert.equal(f.mode.status().stateMachine.current.id,'source')
    assert.equal(f.mode.status().stateMachine.metrics.engagementTurns,0)
  }finally{f.dispose()}
})

test('interaction during cooldown is ignored and malformed interaction fields fail at model JSON parsing',async()=>{
  const f=fixture()
  try {
    await f.opening();f.reply({speech:'先认真讲解。',interaction:{type:'like',speech:'点个赞吧。'}});f.ack();await turn()
    assert.equal(f.mode.status().stateMachine.current.id,'source')
    assert.throws(()=>parseReply(JSON.stringify({speech:'内容',interaction:{type:'unknown',speech:'邀请'}}),[]),/互动引导/)
    assert.throws(()=>f.mode.configure({systemPrompt:'主持',sourceText:'素材',engagementMinTurns:1}),/停止直播/)
    f.mode.stop()
    assert.throws(()=>f.mode.configure({systemPrompt:'主持',sourceText:'素材',engagementMinTurns:1}),/互动间隔/)
    assert.throws(()=>f.mode.configure({systemPrompt:'主持',sourceText:'素材',welcomeGuidance:''}),/开场和告别/)
  }finally{f.dispose()}
})
