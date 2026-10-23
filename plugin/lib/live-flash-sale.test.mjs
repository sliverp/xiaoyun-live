import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createFlashSale,validateFlashSale} from './live-flash-sale.js'
import {createLiveMode} from './live-mode.js'

function store(t){const root=mkdtempSync(join(tmpdir(),'dsh-flash-'));t.after(()=>rmSync(root,{recursive:true,force:true}));return root}
test('hourly sale persists each wall-clock claim and expires without a prize pool',t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.UTC(2026,9,23,1,40)})
 const root=store(t),sale=createFlashSale(root);sale.configure({enabled:true});sale.start()
 assert.equal(sale.evaluate(),false)
 t.mock.timers.tick(20*60*1000);assert.equal(sale.evaluate(),true);assert.equal(sale.status().queued,true)
 assert.match(sale.begin(),/右上角.*5分钟/);const expires=sale.status().current.expiresAt
 t.mock.timers.tick(290000);const restored=createFlashSale(root);assert.equal(restored.status().current.expiresAt,expires);assert.equal(restored.status().remainingSeconds,10)
 t.mock.timers.tick(10000);assert.equal(restored.active(),false);assert.equal(restored.expire(),true);assert.equal(restored.evaluate(),false)
 t.mock.timers.tick(55*60*1000);assert.equal(restored.evaluate(),true)
})
test('sale settings reject unsafe links and out-of-range durations',()=>{
 assert.throws(()=>validateFlashSale({durationSeconds:30}));assert.throws(()=>validateFlashSale({link:'javascript:alert(1)'}));assert.throws(()=>validateFlashSale({qrUrl:'https://elsewhere.test/code.png'}))
 assert.equal(validateFlashSale({durationSeconds:600}).durationSeconds,600)
 assert.equal(validateFlashSale({}).intervalMinutes,60)
 for(const intervalMinutes of [0,7,15.5,120,'15',null])assert.throws(()=>validateFlashSale({intervalMinutes}),/秒杀间隔/)
})

test('quarter-hour sales align to the clock, survive reload and leave the five-minute display independent',t=>{
 const startAt=Date.parse('2026-10-23T12:37:00+08:00'),endAt=Date.parse('2026-10-23T14:00:00+08:00')
 t.mock.timers.enable({apis:['Date'],now:startAt})
 const root=store(t);let sale=createFlashSale(root)
 sale.configure({enabled:true,intervalMinutes:15,startAt,endAt});sale.start()
 assert.equal(sale.evaluate(),false);assert.equal(sale.status().nextAt,Date.parse('2026-10-23T12:45:00+08:00'))
 for(const time of ['12:45','13:00','13:15','13:30','13:45']){
  const at=Date.parse('2026-10-23T'+time+':00+08:00');t.mock.timers.setTime(at)
  assert.equal(sale.evaluate(),true);assert.equal(sale.status().current.automatic,true)
  assert.match(sale.status().current.reason,/每15分钟/);assert.match(sale.begin(),/^秒杀时间/)
  const expires=sale.status().current.expiresAt;assert.equal(expires,at+300000)
  sale=createFlashSale(root);assert.equal(sale.status().current.expiresAt,expires)
  t.mock.timers.tick(300000);assert.equal(sale.expire(),true);assert.equal(sale.evaluate(),false)
 }
 t.mock.timers.setTime(endAt);assert.equal(sale.evaluate(),false);assert.equal(sale.status().scheduleState,'ended')
})

test('changing the interval preserves claims for the same scheduled instant',t=>{
 const at=Date.parse('2026-10-23T13:00:00+08:00')
 t.mock.timers.enable({apis:['Date'],now:at})
 const root=store(t),sale=createFlashSale(root)
 sale.configure({enabled:true});sale.start();assert.equal(sale.evaluate(),true);sale.cancel()
 sale.configure({enabled:true,intervalMinutes:15});sale.start();assert.equal(sale.evaluate(),false)
 assert.equal(sale.status().nextAt,at+900000)
 const file=join(root,'live-flash-sale.json'),record=JSON.parse(readFileSync(file,'utf8'))
 record.claims=['hour:'+at];writeFileSync(file,JSON.stringify(record))
 const restored=createFlashSale(root);assert.equal(restored.evaluate(),false);assert.equal(restored.status().nextAt,at+900000)
})
const ownerId='flash-sale-owner-123456789';
async function fixture(t,{loopEnabled=false}={}){
 process.env.VOICE_LIVE_INGEST_TOKEN='test-flash-ingest'
 t.mock.timers.enable({apis:['Date','setTimeout'],now:Date.UTC(2026,9,23,1,30)})
 const rootDir=mkdtempSync(join(tmpdir(),'dsh-flash-flow-')),listeners=new Map(),prompts=[],events=[];
 const agent={session:{id:'voice-live-main'},status:'idle',followup(m){prompts.push(m.content[0].text);this.status='running'},cancel(){this.status='idle'}}
 const mode=createLiveMode({on(n,h){listeners.set(n,h)},get(){},effect(){}},{agents:{get(){return agent}},pushEvent:e=>events.push(e),textOf:c=>c[0].text,resolveAgentOptions(){},rootDir})
 t.after(()=>{mode.stop();rmSync(rootDir,{recursive:true,force:true})})
 const page={open:true,url:'https://example.test/deck/#slide-1',title:'产品主题',visibleText:'完整的产品内容与演示背景',pageKey:'page-1',pageNumber:1,pageCount:3,flashSaleSupported:true,flashSaleId:''}
 const ingest=body=>mode.ingest({browserOpen:true,events:[],presentation:page,...body})
 const tick=async(ms=110)=>{t.mock.timers.tick(ms);await new Promise(resolve=>setImmediate(resolve))}
 const reply=(speech,navigation='stay')=>{listeners.get('session/event')({id:'voice-live-main'},{type:'assistant/message',data:{message:{content:[{type:'text',text:JSON.stringify({speech,navigation})}]}}});agent.status='idle'}
 const ack=()=>mode.acknowledge({ownerId,turnId:mode.status().currentSpeech.turnId})
 mode.configure({systemPrompt:'你是小云',presentationUrl:'https://example.test/deck/',welcomeScript:'欢迎大家。',commentFrequency:100,autoAdvance:true,autoRecover:false})
 mode.configureAutomation({autoRecover:false,loopEnabled});mode.configureFlashSale({enabled:true});ingest({});await mode.start(ownerId);await tick(0);ack();await tick()
 return {mode,events,prompts,page,ingest,tick,reply,ack}
}
test('sale queues at a complete utterance, stays visible across automatic page turns and expires without interrupting speech',async t=>{
 const f=await fixture(t),pool=JSON.stringify(f.mode.status().lottery)
 f.reply('当前主题已经讲完。','next');const turn=f.mode.status().currentSpeech.turnId
 f.mode.requestFlashSale({action:'show'});assert.equal(f.mode.status().currentSpeech.turnId,turn);assert.equal(f.mode.status().flashSale.queued,true)
 f.ack();await f.tick();assert.equal(f.mode.status().stateMachine.current.id,'flash-sale');assert.match(f.mode.status().currentSpeech.text,/右上角/)
 const show=f.ingest({}).presentationCommand;assert.equal(show.action,'flash-sale');assert.equal(show.active,true)
 const saleId=f.mode.status().flashSale.current.id,expires=f.mode.status().flashSale.current.expiresAt
 f.page.flashSaleId=saleId;f.ingest({presentationAck:show.id});f.ack();await f.tick()
 const advance=f.ingest({}).presentationCommand;assert.equal(advance.action,'next');assert.equal(f.mode.status().flashSale.active,true)
 Object.assign(f.page,{pageNumber:2,url:'https://example.test/deck/#slide-2',pageKey:'page-2',visibleText:'第二页产品内容'});f.ingest({presentationAck:advance.id});await f.tick(1100)
 assert.match(f.prompts.at(-1),/第二页产品内容/);assert.equal(f.mode.status().flashSale.current.expiresAt,expires)
 f.reply('第二页的讲解。');f.ingest({events:[{type:'comment',msgId:'q1',nickname:'观众甲',content:'这个可以干什么？'}]});f.ack();await f.tick()
 assert.match(f.prompts.at(-1),/观众甲/);assert.doesNotMatch(f.prompts.at(-1),/抽奖池持续记录/)
 f.reply('可以在云端帮你处理任务。');const commentTurn=f.mode.status().currentSpeech.turnId
 await f.tick(300000);f.mode.supervise();const hide=f.ingest({}).presentationCommand
 assert.equal(hide.action,'flash-sale');assert.equal(hide.active,false);assert.notEqual(hide.id,show.id)
 assert.equal(f.mode.status().currentSpeech.turnId,commentTurn);assert.equal(f.mode.status().presentation.pageNumber,2)
 assert.equal(JSON.stringify(f.mode.status().lottery),pool)
})
test('manual page turns and restarting at the first page preserve the active overlay deadline',async t=>{
 const f=await fixture(t);f.reply('继续讲解。');f.mode.requestFlashSale({action:'show'});f.ack();await f.tick()
 const show=f.ingest({}).presentationCommand;f.page.flashSaleId=f.mode.status().flashSale.current.id;f.ingest({presentationAck:show.id});f.ack();await f.tick()
 const expires=f.mode.status().flashSale.current.expiresAt
 f.mode.navigatePresentation({direction:'next'});assert.equal(f.ingest({}).presentationCommand.action,'next');assert.equal(f.mode.status().flashSale.current.expiresAt,expires)
 await f.mode.restart(ownerId);const reset=f.ingest({}).presentationCommand
 assert.equal(reset.action,'first');assert.equal(f.mode.status().flashSale.active,true);assert.equal(f.mode.status().flashSale.current.expiresAt,expires)
})

test('finishing the last HTML page loops to the first page with the same broadcaster, sale deadline and prize ledger',async t=>{
 const f=await fixture(t,{loopEnabled:true}),pool=JSON.stringify(f.mode.status().lottery)
 f.reply('这一段先讲完。');f.mode.requestFlashSale({action:'show'});f.ack();await f.tick()
 const show=f.ingest({}).presentationCommand,sale=f.mode.status().flashSale.current
 f.page.flashSaleId=sale.id;f.ingest({presentationAck:show.id});f.ack();await f.tick()
 Object.assign(f.page,{pageNumber:3,pageKey:'page-3',url:'https://example.test/deck/#slide-3',visibleText:'最后一页的完整内容'});f.ingest({});await f.tick()
 const eventCount=f.events.length
 f.reply('最后一页已经讲完。','next');f.ack();await f.tick();await f.tick()
 assert.equal(f.mode.status().running,true);assert.equal(f.mode.status().continuity.cycle,2)
 assert.equal(f.mode.status().ownerId,ownerId);assert.equal(JSON.stringify(f.mode.status().lottery),pool)
 assert.equal(f.mode.status().flashSale.current.expiresAt,sale.expiresAt);assert.equal(f.mode.status().flashSale.active,true)
 assert.ok(f.events.slice(eventCount).every(event=>event.stage!=='closing'))
 const first=f.ingest({}).presentationCommand;assert.equal(first.action,'first')
 Object.assign(f.page,{pageNumber:1,pageKey:'page-1',url:'https://example.test/deck/#slide-1',visibleText:'第一页重新讲解的内容'});f.ingest({presentationAck:first.id});await f.tick(1100)
 assert.equal(f.mode.status().stateMachine.current.id,'source');assert.match(f.prompts.at(-1),/第一页重新讲解的内容/)
})
test('pause does not extend wall-clock display; reconnect reapplies only the remaining time',async t=>{
 const f=await fixture(t);f.reply('继续分享。');f.mode.requestFlashSale({action:'show'});f.ack();await f.tick()
 const show=f.ingest({}).presentationCommand;f.ingest({presentationAck:show.id});const expires=f.mode.status().flashSale.current.expiresAt
 f.mode.pause();await f.tick(60000);const replay=f.ingest({}).presentationCommand;assert.equal(replay.expiresAt,expires)
 f.ingest({presentationAck:replay.id});await f.tick(240000);f.mode.supervise();assert.equal(f.mode.status().flashSale.active,false)
})

test('a 20:00 broadcast waits until midnight and schedules exactly 24 hourly sales before the exclusive end',t=>{
 const startAt=Date.parse('2026-10-24T00:00:00+08:00'),endAt=Date.parse('2026-10-25T00:00:00+08:00')
 t.mock.timers.enable({apis:['Date'],now:startAt-4*3600000})
 const root=store(t),sale=createFlashSale(root);sale.configure({enabled:true,startAt,endAt});sale.start()
 for(let hour=4;hour>0;hour--){t.mock.timers.setTime(startAt-hour*3600000);assert.equal(sale.evaluate(),false);assert.equal(sale.status().scheduleState,'waiting');assert.equal(sale.status().nextAt,startAt)}
 for(let hour=0;hour<24;hour++){
  t.mock.timers.setTime(startAt+hour*3600000)
  assert.equal(sale.evaluate(),true);assert.equal(sale.status().current.automatic,true);sale.begin()
  t.mock.timers.tick(300000);sale.expire();assert.equal(sale.evaluate(),false)
  assert.equal(sale.status().nextAt,hour<23?startAt+(hour+1)*3600000:null)
 }
 t.mock.timers.setTime(endAt);assert.equal(sale.evaluate(),false);assert.equal(sale.status().scheduleState,'ended');assert.equal(sale.status().nextAt,null)
 const restored=createFlashSale(root);assert.deepEqual(restored.status().config,sale.status().config);assert.equal(restored.evaluate(),false)
 restored.request();assert.match(restored.begin(),/右上角/)
})

test('a non-hour start chooses the following hour and invalid date ranges are rejected',t=>{
 const startAt=Date.parse('2026-10-24T00:30:00+08:00'),endAt=Date.parse('2026-10-24T02:00:00+08:00')
 t.mock.timers.enable({apis:['Date'],now:startAt})
 const sale=createFlashSale(store(t));sale.configure({enabled:true,startAt,endAt});sale.start()
 assert.equal(sale.evaluate(),false);assert.equal(sale.status().nextAt,Date.parse('2026-10-24T01:00:00+08:00'))
 assert.throws(()=>validateFlashSale({startAt,endAt:startAt}),/结束时间/)
 assert.throws(()=>validateFlashSale({startAt,endAt:startAt-1}),/结束时间/)
 for(const invalid of ['2026-10-24',NaN,Infinity,8.65e15])assert.throws(()=>validateFlashSale({startAt:invalid}),/时间无效/)
 assert.equal(validateFlashSale({}).startAt,null);assert.equal(validateFlashSale({}).endAt,null)
})

test('an automatic sale still queued when the window ends cannot begin a late announcement',t=>{
 const startAt=Date.parse('2026-10-24T00:00:00+08:00'),endAt=startAt+1000
 t.mock.timers.enable({apis:['Date'],now:startAt})
 const sale=createFlashSale(store(t));sale.configure({enabled:true,startAt,endAt});sale.start();assert.equal(sale.evaluate(),true)
 t.mock.timers.tick(1000);assert.equal(sale.begin(),null);assert.equal(sale.status().current.state,'cancelled');assert.equal(sale.status().active,false)
})

test('the automatic time window can be changed on air without cancelling current speech',async t=>{
 const f=await fixture(t);f.reply('这一段继续完整播出。');const turn=f.mode.status().currentSpeech.turnId
 const startAt=(Math.floor(Date.now()/3600000)+1)*3600000,endAt=startAt+1000
 f.mode.configureFlashSale({enabled:true,startAt,endAt})
 assert.equal(f.mode.status().currentSpeech.turnId,turn);assert.equal(f.mode.status().flashSale.scheduleState,'waiting')
 await f.tick(startAt-Date.now());f.mode.supervise();assert.equal(f.mode.status().flashSale.queued,true)
 await f.tick(1000);f.mode.supervise();assert.equal(f.mode.status().flashSale.queued,false);assert.equal(f.mode.status().currentSpeech.turnId,turn)
 assert.ok(f.events.every(event=>event.stage!=='flash-sale'))
})

test('an automatic quarter-hour sale waits for the full current speech and preserves the prize ledger',async t=>{
 const f=await fixture(t);f.reply('这一整轮内容先说完。');const turn=f.mode.status().currentSpeech.turnId,pool=JSON.stringify(f.mode.status().lottery)
 const startAt=(Math.floor(Date.now()/900000)+1)*900000
 f.mode.configureFlashSale({enabled:true,intervalMinutes:15,startAt,endAt:startAt+3600000})
 await f.tick(startAt-Date.now());f.ingest({});f.mode.supervise()
 assert.equal(f.mode.status().flashSale.queued,true);assert.equal(f.mode.status().flashSale.current.automatic,true)
 assert.equal(f.mode.status().currentSpeech.turnId,turn)
 f.ack();await f.tick();assert.equal(f.mode.status().stateMachine.current.id,'flash-sale')
 assert.equal(f.mode.status().flashSale.active,true);assert.equal(f.ingest({}).presentationCommand.active,true)
 assert.equal(JSON.stringify(f.mode.status().lottery),pool)
})
