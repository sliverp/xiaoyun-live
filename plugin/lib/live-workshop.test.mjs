import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createLiveMode} from './live-mode.js'
import {loadStageAudioAssets,createStageRecordingResolver} from './stage-audio-assets.js'

const ownerId='workshop-owner-1234567890'
async function fixture(t,config={}){
  process.env.VOICE_LIVE_INGEST_TOKEN='test-ingest'
  t.mock.timers.enable({apis:['setTimeout','Date'],now:1790000000000})
  const rootDir=mkdtempSync(join(tmpdir(),'xiaoyun-workshop-')),listeners=new Map(),prompts=[],events=[]
  const agent={session:{id:'voice-live-main'},status:'idle',followup(m){prompts.push(m.content[0].text);this.status='running'},cancel(){this.status='idle'}}
  const mode=createLiveMode({on(n,h){listeners.set(n,h)},get(){},effect(){}},{agents:{get(){return agent}},pushEvent:e=>events.push(e),textOf:c=>c[0].text,resolveAgentOptions(){},rootDir,recordingForText:createStageRecordingResolver(loadStageAudioAssets())})
  t.after(()=>{mode.stop();rmSync(rootDir,{recursive:true,force:true})})
  const tick=async(ms=110)=>{t.mock.timers.tick(ms);await new Promise(resolve=>setImmediate(resolve))}
  const reply=(speech,navigation='stay')=>{listeners.get('session/event')({id:'voice-live-main'},{type:'assistant/message',data:{message:{content:[{type:'text',text:JSON.stringify({speech,navigation})}]}}});agent.status='idle'}
  const ack=()=>mode.acknowledge({ownerId,turnId:mode.status().currentSpeech.turnId})
  const ingest=body=>mode.ingest({browserOpen:true,events:[],...body})
  const page=n=>({open:true,url:'https://example.test/deck/#slide-'+n,title:'主题'+n,visibleText:'第'+n+'页内容',pageKey:'page-'+n,pageNumber:n,pageCount:3})
  mode.configure({systemPrompt:'你是小云。',sourceText:'讲解素材。',...config})
  ingest(config.presentationUrl?{presentation:page(1)}:{})
  await mode.start(ownerId);await tick(0)
  return {mode,prompts,events,reply,ack,tick,ingest,page}
}

test('approved opening and closing play the full original recordings without model rewriting or clipping',async t=>{
  const scripts=JSON.parse(readFileSync(new URL('../../materials/live-1024-scripts.json',import.meta.url),'utf8'))
  const f=await fixture(t,{welcomeScript:scripts.welcomeScript,closingScript:scripts.closingScript})
  assert.equal(f.prompts.length,0)
  assert.equal(f.events.at(-1).text,scripts.welcomeScript)
  assert.equal(f.events.at(-1).audioSpeed,1)
  assert.ok(Buffer.from(f.events.at(-1).audioSegments[0].audio,'base64').length>1000)
  assert.match(f.events.at(-1).text,/云上AI工坊第38期/)
  assert.match(f.events.at(-1).text,/前面37期的回放/)
  assert.doesNotMatch(f.events.at(-1).text,/第\s*36\s*期/)
  f.ack();await f.tick();f.reply('继续讲解。')
  f.mode.finish();f.ack();await f.tick()
  assert.equal(f.events.at(-1).text,scripts.closingScript)
  assert.match(f.events.at(-1).text,/特别感谢一直守在直播间的朋友/)
  assert.match(f.events.at(-1).text,/今天的回放稍后也会上传/)
  assert.doesNotMatch(f.events.at(-1).text,/一零二四，码上开播|ClawPro|第\s*36\s*期/)
  assert.equal(f.events.at(-1).audioSpeed,1)
  assert.ok(Buffer.from(f.events.at(-1).audioSegments[0].audio,'base64').length>1000)
  assert.equal(f.prompts.length,1)
  f.ack();assert.equal(f.mode.status().running,false)
})

test('same-page animations cannot erase a queued advance or confirm a page turn; only the target page resumes narration',async t=>{
  const f=await fixture(t,{presentationUrl:'https://example.test/deck/'})
  f.reply('欢迎大家。');f.ack();await f.tick()
  f.reply('当前主题已讲完。','next')
  const key=f.mode.status().presentation.pageKey
  f.ingest({presentation:{...f.page(1),pageKey:'text-animation-a',visibleText:'动画出现的新文字'}})
  assert.equal(f.mode.status().presentation.pageKey,key)
  f.ack();await f.tick()
  const command=f.ingest({}).presentationCommand
  assert.equal(command.action,'next')
  assert.equal(f.mode.status().pageSourceTurns,1)
  f.ingest({presentationAck:command.id,presentation:{...f.page(1),pageKey:'text-animation-b'}});await f.tick()
  assert.equal(f.mode.status().stateMachine.current.id,'advancing')
  assert.equal(f.prompts.length,2)
  f.ingest({presentation:f.page(3)});await f.tick()
  assert.equal(f.prompts.length,2)
  f.ingest({presentation:f.page(2)});await f.tick()
  assert.equal(f.mode.status().pageSourceTurns,0)
  assert.equal(f.prompts.length,3)
  assert.match(f.prompts.at(-1),/第2页内容/)
})

test('manual deck-edge errors do not cancel current speech, and duplicate page commands are rejected',async t=>{
  const f=await fixture(t,{presentationUrl:'https://example.test/deck/'})
  f.reply('欢迎大家。')
  const turnId=f.mode.status().currentSpeech.turnId
  assert.throws(()=>f.mode.navigatePresentation({direction:'prev'}),/边界/)
  assert.equal(f.mode.status().currentSpeech.turnId,turnId)
  f.mode.navigatePresentation({direction:'next'})
  assert.throws(()=>f.mode.navigatePresentation({direction:'next'}),/正在翻页/)
  const command=f.ingest({}).presentationCommand
  f.ingest({presentationAck:command.id,presentation:f.page(1)})
  assert.throws(()=>f.mode.navigatePresentation({direction:'next'}),/正在翻页/)
  f.ingest({presentation:f.page(2)})
  assert.doesNotThrow(()=>f.mode.navigatePresentation({direction:'prev'}))
})
