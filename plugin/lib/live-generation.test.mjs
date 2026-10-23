import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createLiveMode} from './live-mode.js'

const ownerId='owner-1234567890123456'
async function fixture(t,generation={timeoutMs:1000}){
  process.env.VOICE_LIVE_INGEST_TOKEN='test-ingest'
  t.mock.timers.enable({apis:['setTimeout','Date'],now:1790000000000})
  const rootDir=mkdtempSync(join(tmpdir(),'xiaoyun-generation-'))
  const listeners=new Map(),events=[],prompts=[],effects=[]
  const agent={session:{id:'voice-live-main'},status:'idle',cancels:0,followup(message){prompts.push(message);this.status='running'},cancel(){this.cancels++;this.status='idle'}}
  const mode=createLiveMode({on(name,handler){listeners.set(name,handler)},effect(effect){effects.push(effect())},get(){}},{agents:{get(){return agent}},pushEvent:event=>events.push(event),textOf:content=>content?.[0]?.text||'',resolveAgentOptions(){},rootDir,generation})
  t.after(()=>{mode.stop();for(const effect of effects)effect();rmSync(rootDir,{recursive:true,force:true})})
  const tick=async ms=>{t.mock.timers.tick(ms);await new Promise(resolve=>setImmediate(resolve))}
  const event=(type,data)=>listeners.get('session/event')({id:'voice-live-main'},{type,data})
  const reply=(speech='欢迎大家。',turn)=>{event('assistant/message',{...(turn===undefined?{}:{turn}),message:{content:[{type:'text',text:JSON.stringify({speech,navigation:'stay'})}]}});agent.status='idle'}
  mode.configure({systemPrompt:'你是小云。',sourceText:'直播内容。'});mode.ingest({browserOpen:true,events:[]});await mode.start(ownerId);await tick(0)
  return {mode,agent,listeners,events,prompts,tick,event,reply,effects}
}

test('a silent model is cancelled at the deadline and late output cannot restart audio',async t=>{
  const f=await fixture(t)
  assert.match(f.mode.status().stateMachine.current.execution,/0秒.*最多1秒/)
  await f.tick(999);assert.equal(f.mode.status().running,true)
  await f.tick(1)
  assert.equal(f.mode.status().running,false);assert.equal(f.mode.status().phase,'error')
  assert.match(f.mode.status().error,/超过1秒/);assert.equal(f.agent.cancels,1)
  const count=f.events.length;f.reply();assert.equal(f.events.length,count)
})

test('successful generation removes its watchdog while audio waits for its full acknowledgement',async t=>{
  const f=await fixture(t);f.reply();await f.tick(10000)
  assert.equal(f.mode.status().phase,'awaiting-audio');assert.equal(f.agent.cancels,0)
  assert.equal(f.mode.status().currentSpeech.text,'欢迎大家。')
})

test('live requests override persisted high reasoning and huge output caps without changing other agents',async t=>{
  const f=await fixture(t),request={provider:'deepseek-official',model:'chosen-model',reasoningEffort:'high',maxTokens:256000}
  const hook=f.listeners.get('agent/request')
  assert.deepEqual(await hook({agent:f.agent},async()=>request),{...request,reasoningEffort:'off',maxTokens:1600})
  assert.equal(await hook({agent:{session:{id:'voice-call-main'}}},async()=>request),request)
  assert.equal(request.reasoningEffort,'high')
})

test('provider busy errors surface immediately instead of waiting through offline retries',async t=>{
  const f=await fixture(t);let delegated=0
  const hook=f.listeners.get('agent/request-error')
  assert.equal(await hook({agent:f.agent,failure:{code:'SERVICE_UNAVAILABLE',message:'503 Service is too busy'}},()=>{delegated++}),undefined)
  assert.equal(delegated,0);assert.match(f.mode.status().error,/503 Service is too busy/)
  assert.equal(f.mode.status().running,false);assert.equal(f.agent.cancels,1)
  await hook({agent:{session:{id:'other'}},failure:{}},()=>{delegated++})
  assert.equal(delegated,1)
})

test('ending during cancellation waits for idle, then generates goodbye with a fresh deadline',async t=>{
  const f=await fixture(t)
  f.agent.cancel=function(){this.cancels++}
  f.mode.finish();await f.tick(110)
  assert.equal(f.mode.status().phase,'waiting-model')
  f.agent.status='idle';f.listeners.get('agent/status')({agent:f.agent,status:'idle'});await f.tick(110)
  assert.equal(f.mode.status().stateMachine.current.id,'closing');assert.equal(f.prompts.length,2)
  f.reply('谢谢大家，再见。');await f.tick(1500)
  assert.equal(f.mode.status().phase,'awaiting-audio')
  f.mode.acknowledge({ownerId,turnId:f.mode.status().currentSpeech.turnId})
  assert.equal(f.mode.status().running,false);assert.equal(f.mode.status().stateMachine.current.id,'ended')
})

test('a response from the cancelled turn cannot replace a newly generated goodbye',async t=>{
  const f=await fixture(t);f.event('turn/start',{turn:1});f.mode.finish();await f.tick(110)
  f.event('turn/start',{turn:2});f.reply('迟到的旧开场。',1)
  assert.equal(f.mode.status().currentSpeech,null)
  f.reply('谢谢大家，再见。',2)
  assert.equal(f.mode.status().currentSpeech.text,'谢谢大家，再见。')
})

test('immediate stop and disposal clear the generation deadline',async t=>{
  const f=await fixture(t);f.mode.stop();const count=f.events.length
  await f.tick(5000);assert.equal(f.events.length,count);assert.equal(f.mode.status().phase,'stopped')
})

const backups=[{provider:'tokenhub',model:'hy4-preview',label:'TokenHub 混元'},{provider:'tokenhub',model:'deepseek/deepseek-flash',label:'TokenHub DeepSeek'}]

test('a silent primary switches to the backup and keeps the exact pending prompt without moving the page',async t=>{
  const f=await fixture(t,{timeoutMs:5000,primaryTimeoutMs:1000,fallbacks:backups})
  f.event('turn/start',{turn:1});const prompt=f.prompts[0].content[0].text
  await f.tick(1000)
  assert.equal(f.mode.status().running,true);assert.equal(f.mode.status().generation.label,'TokenHub 混元')
  assert.equal(f.prompts.length,2);assert.equal(f.prompts[1].content[0].text,prompt)
  assert.equal(f.mode.status().pageSourceTurns,0);assert.equal(f.agent.cancels,1)
  f.event('turn/start',{turn:2});f.reply('迟到的开场。',1);assert.equal(f.mode.status().currentSpeech,null)
  f.reply('备用通道生成的欢迎。',2)
  const speech=f.mode.status().currentSpeech
  assert.equal(speech.text,'备用通道生成的欢迎。')
  f.mode.acknowledge({ownerId,turnId:speech.turnId});await f.tick(110)
  assert.equal(f.mode.status().generation.label,'TokenHub 混元')
  assert.equal(f.prompts.length,3)
})

test('provider failures try each backup once and preserve the registered request retry protocol',async t=>{
  const f=await fixture(t,{timeoutMs:5000,primaryTimeoutMs:1000,fallbacks:backups})
  const failure=f.listeners.get('agent/request-error'),request=f.listeners.get('agent/request')
  assert.deepEqual(await failure({agent:f.agent,failure:{message:'503 busy'}},()=>{}),{kind:'retry'})
  assert.equal((await request({agent:f.agent},async()=>({provider:'deepseek-official',model:'original'}))).model,'hy4-preview')
  assert.deepEqual(await failure({agent:f.agent,failure:{message:'429 rate limited'}},()=>{}),{kind:'retry'})
  assert.equal((await request({agent:f.agent},async()=>({}))).model,'deepseek/deepseek-flash')
  assert.equal(await failure({agent:f.agent,failure:{message:'upstream unavailable'}},()=>{}),undefined)
  assert.equal(f.mode.status().phase,'error');assert.match(f.mode.status().error,/upstream unavailable/)
  assert.equal(f.mode.status().generation.routeCount,3)
})

test('stopping while the primary is being cancelled prevents a late idle event from submitting the backup',async t=>{
  const f=await fixture(t,{timeoutMs:5000,primaryTimeoutMs:1000,fallbacks:backups})
  f.agent.cancel=function(){this.cancels++}
  await f.tick(1000);assert.equal(f.mode.status().phase,'waiting-model')
  f.mode.stop();f.agent.status='idle';f.listeners.get('agent/status')({agent:f.agent,status:'idle'})
  await f.tick(10000);assert.equal(f.prompts.length,1);assert.equal(f.mode.status().running,false)
})

test('a new show can use a fresh conversation while ownership takeover preserves the current show',async t=>{
  process.env.VOICE_LIVE_INGEST_TOKEN='test-ingest'
  const rootDir=mkdtempSync(join(tmpdir(),'xiaoyun-fresh-show-')),agents=new Map(),ids=[]
  const mode=createLiveMode({on(){},effect(){},get(){}},{agents:{get:id=>agents.get(id),async create({sessionId}){ids.push(sessionId);const agent={session:{id:sessionId},status:'idle',followup(){this.status='running'},cancel(){this.status='idle'}};agents.set(sessionId,agent);return {agent}}},pushEvent(){},textOf(){return ''},resolveAgentOptions(){},rootDir,generation:{freshSession:true}})
  t.after(()=>{mode.stop();rmSync(rootDir,{recursive:true,force:true})})
  mode.configure({systemPrompt:'你是小云。',sourceText:'今天的主题。'});mode.ingest({browserOpen:true,events:[]})
  await mode.start(ownerId);await new Promise(resolve=>setImmediate(resolve));const first=mode.status().sessionId
  await mode.start('another-owner-1234567890');assert.equal(mode.status().sessionId,first);assert.equal(ids.length,1)
  mode.stop();await mode.start(ownerId);await new Promise(resolve=>setImmediate(resolve))
  assert.notEqual(mode.status().sessionId,first);assert.equal(ids.length,2);assert.equal(agents.has(first),true)
})
