import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createLiveMode, parseReply, parseSlides, presentationNote, splitMaterial } from './live-mode.js'

async function enterMain(mode,listeners,agent,emitted,prompts) {
  await mode.start('owner-1234567890123456')
  await new Promise(resolve=>setImmediate(resolve))
  assert.equal(mode.status().stateMachine.current.id,'opening')
  listeners.get('session/event')({id:'voice-live-main'},{type:'assistant/message',data:{message:{content:[{type:'text',text:JSON.stringify({speech:'欢迎来到直播间，我们开始分享。',navigation:'stay'})}]}}})
  agent.status='idle'
  mode.acknowledge({ownerId:'owner-1234567890123456',turnId:emitted.at(-1).turnId})
  emitted.length=0
  prompts.length=0
  await new Promise(resolve=>setTimeout(resolve,150))
}


test('material is bounded into speakable units and JSON replies select a real candidate', () => {
  assert.deepEqual(splitMaterial('甲\n\n乙'), ['甲', '乙'])
  assert.deepEqual(parseSlides('# 开场\n欢迎来到直播间\n---\n# 第二页\n看这里'), [
    {title:'开场',body:'欢迎来到直播间'},
    {title:'第二页',body:'看这里'},
  ])
  assert.deepEqual(parseSlides('第一段\n第二段').map(slide=>slide.body), ['第一段','第二段'])
  const longText = '好'.repeat(700)
  const longSlides = parseSlides(longText)
  assert.equal(longSlides.map(slide=>slide.body).join(''), longText)
  assert.ok(longSlides.every(slide=>slide.body.length <= 320))
  assert.deepEqual(parseReply('{"selectedId":"5","speech":"你好"}', [{ id:'5' }]), {selectedId:'5',speech:'你好',segments:['你好'],navigation:'stay'})
  assert.deepEqual(parseReply('{"selectedId":null,"speech":"大家都在关心这个问题"}', [{ id:'5' }]), {selectedId:null,speech:'大家都在关心这个问题',segments:['大家都在关心这个问题'],navigation:'stay'})
  assert.deepEqual(parseReply('大家都在关心这个问题', [{ id:'5' }]).selectedId,null)
  assert.throws(() => parseReply('{"selectedId":"7","speech":"你好"}', [{ id:'5' }]), /未选中/)
  assert.deepEqual(parseReply('再说第二步，回应审查并反复修改。', []), {selectedId:null,speech:'再说第二步，回应审查并反复修改。',segments:['再说第二步，回应审查并反复修改。'],navigation:'stay'})
  assert.deepEqual(parseReply('口播如下：{"selectedId":null,"speech":"继续讲当前页","navigation":"stay"}', []).speech,'继续讲当前页')
  const longSpeech = '这里是当前页。'.repeat(55)
  const longReply = parseReply(JSON.stringify({selectedId:null,speech:longSpeech,navigation:'next'}), [])
  assert.equal(longReply.speech,longSpeech)
  assert.equal(longReply.segments.join(''),longSpeech)
  assert.ok(longReply.segments.length > 1)
  assert.ok(longReply.segments.every(part=>part.length<=280))
  assert.equal(longReply.navigation,'next')
  const punctuation = parseReply(JSON.stringify({speech:'甲'.repeat(180)+'，'+'乙'.repeat(80)+'。'+'丙'.repeat(70)}), [])
  assert.ok(punctuation.segments[0].endsWith('。'))
})

test('numbered speaker notes follow the presentation page instead of rotating', () => {
  const notes = '## 幻灯片 1：开场\n\n开场背景。\n\n## 幻灯片 3：案例\n\n案例细节。'
  assert.equal(presentationNote(notes, 'https://example.com/slides'), '开场背景。')
  assert.equal(presentationNote(notes, 'https://example.com/slides#slide-3'), '案例细节。')
  assert.equal(presentationNote(notes, 'https://example.com/slides#slide-2'), '')
  assert.equal(presentationNote('普通补充资料', 'https://example.com/slides'), null)
})

test('a comment turn reads only the latest 100 unread comments and can answer the group or a newer viewer', async () => {
  process.env.VOICE_LIVE_INGEST_TOKEN = 'ingest-test-secret'
  const dir = mkdtempSync(join(tmpdir(), 'dsh-live-comment-batch-test-'))
  const listeners = new Map()
  const emitted = []
  const prompts = []
  const agent = {session:{id:'voice-live-main'},status:'idle',followup(input) {prompts.push(input.content[0].text);this.status='running'},cancel() {this.status='idle'}}
  const ctx = {on(name, callback) {listeners.set(name, callback)},effect() {},get() {return undefined}}
  const mode = createLiveMode(ctx, {agents:{get() {return null},async create({setup}) {setup({systemPrompt:{section(){}},tools:{restrict(){}}});return {agent}}},pushEvent(value) {emitted.push(value)},textOf(content) {return content?.[0]?.text || ''},resolveAgentOptions() {return undefined},rootDir:dir})
  const reply = value => {
    listeners.get('session/event')({id:'voice-live-main'}, {type:'assistant/message',data:{message:{content:[{type:'text',text:JSON.stringify(value)}]}}})
    agent.status = 'idle'
  }
  const acknowledge = () => mode.acknowledge({ownerId:'owner-1234567890123456',turnId:emitted.at(-1).turnId})
  const waitForPrompt = async count => {
    for (let attempt = 0; attempt < 30 && prompts.length < count; attempt += 1) await new Promise(resolve=>setTimeout(resolve,100))
    assert.equal(prompts.length,count)
  }
  try {
    mode.configure({systemPrompt:'友好交流',sourceText:'讲解素材',commentFrequency:100})
    mode.ingest({browserOpen:true,events:[]})
    await enterMain(mode,listeners,agent,emitted,prompts)
    await waitForPrompt(1)
    mode.ingest({browserOpen:true,events:Array.from({length:120},(_,index)=>({type:'comment',msgId:`m${index + 1}`,nickname:`观众${index + 1}`,content:`第${index + 1}条具体弹幕`}))})
    for (let start = 121; start <= 451; start += 60) {
      mode.ingest({browserOpen:true,events:Array.from({length:Math.min(60,452 - start)},(_,index)=>({type:'comment',msgId:`m${start + index}`,nickname:`观众${start + index}`,content:`第${start + index}条具体弹幕`}))})
    }
    reply({selectedId:null,speech:'先讲演示页',navigation:'stay'})
    acknowledge()
    await waitForPrompt(2)
    const candidates = JSON.parse(prompts[1].match(/弹幕 JSON：(\[.*\])\n群体回应/s)[1])
    assert.equal(candidates.length,100)
    assert.deepEqual(candidates[0],{id:'352',nickname:'观众352',content:'第352条具体弹幕'})
    assert.deepEqual(candidates[99],{id:'451',nickname:'观众451',content:'第451条具体弹幕'})
    assert.match(prompts[1],/先看整体讨论/)
    assert.equal(mode.status().lastCommentBatchCount,100)
    reply({selectedId:null,speech:'大家都在讨论演示的重点，我先回答共同关心的问题。',navigation:'stay'})
    assert.equal(emitted.at(-1).selected,null)
    mode.ingest({browserOpen:true,events:[{type:'comment',msgId:'m452',nickname:'新观众',content:'请讲最新问题'}]})
    acknowledge()
    assert.equal(mode.status().lastSelected,null)
    await waitForPrompt(3)
    reply({selectedId:null,speech:'继续讲解演示页',navigation:'stay'})
    acknowledge()
    await waitForPrompt(4)
    const nextCandidates = JSON.parse(prompts[3].match(/弹幕 JSON：(\[.*\])\n群体回应/s)[1])
    assert.deepEqual(nextCandidates,[{id:'452',nickname:'新观众',content:'请讲最新问题'}])
    reply({selectedId:'452',speech:'新观众，这个问题我来回答。',navigation:'stay'})
    assert.equal(emitted.at(-1).selected.nickname,'新观众')
    acknowledge()
    assert.equal(mode.status().lastSelected.nickname,'新观众')
  } finally {mode.stop();rmSync(dir,{recursive:true,force:true})}
})

test('malformed model JSON retries without stopping the live session', async () => {
  process.env.VOICE_LIVE_INGEST_TOKEN = 'ingest-test-secret'
  const dir = mkdtempSync(join(tmpdir(), 'dsh-live-format-test-'))
  const listeners = new Map()
  const emitted = []
  const prompts = []
  const agent = {session:{id:'voice-live-main'},status:'idle',followup(input) {prompts.push(input.content[0].text);this.status='running'},cancel() {this.status='idle'}}
  const ctx = {on(name, callback) {listeners.set(name, callback)},effect() {},get() {return undefined}}
  const mode = createLiveMode(ctx, {agents:{get() {return null},async create({setup}) {setup({systemPrompt:{section(){}},tools:{restrict(){}}});return {agent}}},pushEvent(value) {emitted.push(value)},textOf(content) {return content?.[0]?.text || ''},resolveAgentOptions() {return undefined},rootDir:dir})
  const reply = text => {
    listeners.get('session/event')({id:'voice-live-main'}, {type:'assistant/message',data:{message:{content:[{type:'text',text}]}}})
    agent.status = 'idle'
  }
  try {
    mode.configure({systemPrompt:'讲解当前页',sourceText:'直播素材'})
    mode.ingest({browserOpen:true,events:[]})
    await enterMain(mode,listeners,agent,emitted,prompts)
    await new Promise(resolve=>setImmediate(resolve))
    reply('{"speech":')
    assert.equal(mode.status().running,true)
    await new Promise(resolve=>setTimeout(resolve,250))
    assert.equal(prompts.length,2)
    reply('再说第二步，回应审查并反复修改。')
    assert.equal(emitted.at(-1).kind,'live-speech')
    assert.equal(emitted.at(-1).text,'再说第二步，回应审查并反复修改。')
  } finally {mode.stop();rmSync(dir,{recursive:true,force:true})}
})

test('HTML presentation is read from Chrome, AI navigation waits for the new page, then comments interleave', async () => {
  process.env.VOICE_LIVE_INGEST_TOKEN = 'ingest-test-secret'
  const dir = mkdtempSync(join(tmpdir(), 'dsh-live-html-test-'))
  const listeners = new Map()
  const emitted = []
  const prompts = []
  const agent = {session:{id:'voice-live-main'},status:'idle',followup(input) {prompts.push(input.content[0].text);this.status='running'},cancel() {this.status='idle'}}
  const ctx = {on(name, callback) {listeners.set(name, callback)},effect() {},get() {return undefined}}
  const mode = createLiveMode(ctx, {agents:{get() {return null},async create({setup}) {setup({systemPrompt:{section(){}},tools:{restrict(){}}});return {agent}}},pushEvent(value) {emitted.push(value)},textOf(content) {return content?.[0]?.text || ''},resolveAgentOptions() {return undefined},rootDir:dir})
  const reply = value => {
    listeners.get('session/event')({id:'voice-live-main'}, {type:'assistant/message',data:{message:{content:[{type:'text',text:JSON.stringify(value)}]}}})
    agent.status = 'idle'
  }
  try {
    mode.configure({systemPrompt:'讲解当前页面',sourceText:'## 幻灯片 1\n开场背景。\n## 幻灯片 2\n第二页补充。',presentationUrl:'http://127.0.0.1:8080/slides.html'})
    mode.ingest({browserOpen:true,events:[]})
    await enterMain(mode,listeners,agent,emitted,prompts)
    assert.equal(mode.status().phase,'waiting-presentation')
    const open = mode.ingest({browserOpen:true,events:[]}).presentationCommand
    assert.equal(open.action,'open')
    mode.ingest({browserOpen:true,presentationAck:open.id,presentation:{open:true,url:'http://127.0.0.1:8080/slides.html',title:'首页',visibleText:'欢迎来到直播间',pageKey:'slide-1',capturedAt:Date.now()},events:[]})
    await new Promise(resolve=>setTimeout(resolve, 200))
    assert.match(prompts[0],/欢迎来到直播间/)
    assert.match(prompts[0],/开场背景/)
    assert.doesNotMatch(prompts[0],/第二页补充/)
    mode.ingest({browserOpen:true,events:[{type:'comment',msgId:'c1',nickname:'观众甲',content:'你好呀'}]})
    reply({selectedId:null,speech:'欢迎大家',navigation:'stay'})
    mode.acknowledge({ownerId:'owner-1234567890123456',turnId:emitted.at(-1).turnId})
    await new Promise(resolve=>setTimeout(resolve, 1250))
    assert.match(prompts[1],/观众甲/)
    reply({selectedId:'1',speech:'你好呀',navigation:'stay'})
    mode.acknowledge({ownerId:'owner-1234567890123456',turnId:emitted.at(-1).turnId})
    await new Promise(resolve=>setTimeout(resolve, 1250))
    assert.match(prompts[2],/欢迎来到直播间/)
    reply({selectedId:null,speech:'继续讲本页的第二个要点',navigation:'stay'})
    mode.acknowledge({ownerId:'owner-1234567890123456',turnId:emitted.at(-1).turnId})
    await new Promise(resolve=>setTimeout(resolve, 1250))
    assert.match(prompts[3],/本页第 3 段/)
    assert.equal(mode.ingest({browserOpen:true,events:[]}).presentationCommand,null)
    reply({selectedId:null,speech:'本页内容讲完了',navigation:'next'})
    mode.acknowledge({ownerId:'owner-1234567890123456',turnId:emitted.at(-1).turnId})
    await new Promise(resolve=>setTimeout(resolve, 1250))
    const next = mode.ingest({browserOpen:true,events:[]}).presentationCommand
    assert.equal(next.action,'next')
    mode.ingest({browserOpen:true,presentationAck:next.id,presentation:{open:true,url:'http://127.0.0.1:8080/slides.html#slide-2',title:'第二页',visibleText:'第二页主题',pageKey:'slide-2',capturedAt:Date.now()},events:[]})
    await new Promise(resolve=>setTimeout(resolve, 1250))
    assert.match(prompts[4],/第二页主题/)
    assert.match(prompts[4],/第二页补充/)
    assert.doesNotMatch(prompts[4],/开场背景/)
    assert.equal(mode.status().commentCount,1)
    mode.setPace({commentFrequency:90,pageSeconds:20,commentSeconds:8})
    assert.equal(mode.status().commentFrequency,90)
    mode.stop()
    mode.configure({systemPrompt:'更新讲解提示',sourceText:'## 幻灯片 1\n开场背景。\n## 幻灯片 2\n第二页补充。',presentationUrl:'http://127.0.0.1:8080/slides.html'})
    assert.equal(mode.status().presentation.url,'http://127.0.0.1:8080/slides.html#slide-2')
  } finally {mode.stop();rmSync(dir,{recursive:true,force:true})}
})

test('a long source reply queues complete sentences and yields to comments only after the full reply', async () => {
  process.env.VOICE_LIVE_INGEST_TOKEN = 'ingest-test-secret'
  const dir = mkdtempSync(join(tmpdir(), 'dsh-live-queue-test-'))
  const listeners = new Map()
  const emitted = []
  const prompts = []
  const agent = {session:{id:'voice-live-main'},status:'idle',followup(input) {prompts.push(input.content[0].text);this.status='running'},cancel() {this.status='idle'}}
  const ctx = {on(name, callback) {listeners.set(name, callback)},effect() {},get() {return undefined}}
  const mode = createLiveMode(ctx, {agents:{get() {return null},async create({setup}) {setup({systemPrompt:{section(){}},tools:{restrict(){}}});return {agent}}},pushEvent(value) {emitted.push(value)},textOf(content) {return content?.[0]?.text || ''},resolveAgentOptions() {return undefined},rootDir:dir})
  const reply = value => {
    listeners.get('session/event')({id:'voice-live-main'}, {type:'assistant/message',data:{message:{content:[{type:'text',text:JSON.stringify(value)}]}}})
    agent.status = 'idle'
  }
  try {
    mode.configure({systemPrompt:'讲解当前页面',presentationUrl:'http://127.0.0.1:8080/slides.html',sourceText:''})
    mode.ingest({browserOpen:true,presentation:{open:true,url:'http://127.0.0.1:8080/slides.html',visibleText:'本页内容',pageKey:'slide-1'},events:[]})
    await enterMain(mode,listeners,agent,emitted,prompts)
    await new Promise(resolve=>setImmediate(resolve))
    const longSpeech = '甲'.repeat(175)+'。'+'乙'.repeat(172)
    assert.equal(longSpeech.length,348)
    mode.ingest({browserOpen:true,events:[{type:'comment',msgId:'c1',nickname:'观众甲',content:'有问题吗'}]})
    reply({selectedId:null,speech:longSpeech,navigation:'next'})
    const first = emitted.at(-1)
    assert.equal(first.kind,'live-speech')
    assert.equal(first.text,longSpeech)
    assert.deepEqual(first.segments,['甲'.repeat(175)+'。','乙'.repeat(172)])
    assert.equal(mode.status().speechSegmentCount,2)
    await new Promise(resolve=>setTimeout(resolve,250))
    assert.equal(prompts.length,1)
    assert.equal(mode.ingest({browserOpen:true,events:[]}).presentationCommand,null)
    mode.acknowledge({ownerId:'owner-1234567890123456',turnId:first.turnId})
    await new Promise(resolve=>setTimeout(resolve,250))
    assert.match(prompts[1],/观众甲/)
    reply({selectedId:'1',speech:'观众甲，我来回答。',navigation:'stay'})
    const comment = emitted.at(-1)
    assert.equal(comment.selected.nickname,'观众甲')
    mode.acknowledge({ownerId:'owner-1234567890123456',turnId:comment.turnId})
    await new Promise(resolve=>setTimeout(resolve,250))
    assert.equal(prompts.length,2)
    assert.equal(mode.ingest({browserOpen:true,events:[]}).presentationCommand.action,'next')
  } finally {mode.stop();rmSync(dir,{recursive:true,force:true})}
})

test('low comment frequency counts complete source replies rather than synthesis chunks', async () => {
  process.env.VOICE_LIVE_INGEST_TOKEN = 'ingest-test-secret'
  const dir = mkdtempSync(join(tmpdir(), 'dsh-live-low-frequency-test-'))
  const listeners = new Map()
  const emitted = []
  const prompts = []
  const agent = {session:{id:'voice-live-main'},status:'idle',followup(input) {prompts.push(input.content[0].text);this.status='running'},cancel() {this.status='idle'}}
  const ctx = {on(name, callback) {listeners.set(name, callback)},effect() {},get() {return undefined}}
  const mode = createLiveMode(ctx, {agents:{get() {return null},async create({setup}) {setup({systemPrompt:{section(){}},tools:{restrict(){}}});return {agent}}},pushEvent(value) {emitted.push(value)},textOf(content) {return content?.[0]?.text || ''},resolveAgentOptions() {return undefined},rootDir:dir})
  const reply = value => {
    listeners.get('session/event')({id:'voice-live-main'}, {type:'assistant/message',data:{message:{content:[{type:'text',text:JSON.stringify(value)}]}}})
    agent.status = 'idle'
  }
  try {
    mode.configure({systemPrompt:'讲解',sourceText:'一页素材'})
    mode.setAutoAdvance({enabled:false})
    mode.setPace({commentFrequency:0,pageSeconds:25,commentSeconds:12})
    mode.ingest({browserOpen:true,events:[]})
    await enterMain(mode,listeners,agent,emitted,prompts)
    await new Promise(resolve=>setImmediate(resolve))
    mode.ingest({browserOpen:true,events:[{type:'comment',msgId:'c1',nickname:'观众丙',content:'我有问题'}]})
    reply({selectedId:null,speech:('甲'.repeat(179)+'。').repeat(3)+'乙'.repeat(50),navigation:'stay'})
    assert.ok(emitted.at(-1).segments.length>1)
    for (let index=0;index<3;index+=1) {
      mode.acknowledge({ownerId:'owner-1234567890123456',turnId:emitted.at(-1).turnId})
      await new Promise(resolve=>setTimeout(resolve,250))
      if (index<2) {
        assert.equal(prompts.length,index+2)
        reply({selectedId:null,speech:'继续讲解本页要点。',navigation:'stay'})
      }
    }
    assert.match(prompts[3],/观众丙/)
    reply({selectedId:'1',speech:'我来回答。',navigation:'stay'})
    mode.acknowledge({ownerId:'owner-1234567890123456',turnId:emitted.at(-1).turnId})
    await new Promise(resolve=>setTimeout(resolve,250))
    assert.match(prompts[4],/一页素材/)
  } finally {mode.stop();rmSync(dir,{recursive:true,force:true})}
})

test('manual HTML page keeps speaking until AI finishes, then still replies to a new comment', async () => {
  process.env.VOICE_LIVE_INGEST_TOKEN = 'ingest-test-secret'
  const dir = mkdtempSync(join(tmpdir(), 'dsh-live-manual-html-test-'))
  const listeners = new Map()
  const emitted = []
  const prompts = []
  const agent = {session:{id:'voice-live-main'},status:'idle',followup(input) {prompts.push(input.content[0].text);this.status='running'},cancel() {this.status='idle'}}
  const ctx = {on(name, callback) {listeners.set(name, callback)},effect() {},get() {return undefined}}
  const mode = createLiveMode(ctx, {agents:{get() {return null},async create({setup}) {setup({systemPrompt:{section(){}},tools:{restrict(){}}});return {agent}}},pushEvent(value) {emitted.push(value)},textOf(content) {return content?.[0]?.text || ''},resolveAgentOptions() {return undefined},rootDir:dir})
  try {
    mode.configure({systemPrompt:'讲当前页',presentationUrl:'http://127.0.0.1:8080/slides.html',sourceText:''})
    mode.setAutoAdvance({enabled:false})
    mode.ingest({browserOpen:true,presentation:{open:true,url:'http://127.0.0.1:8080/slides.html',visibleText:'本页内容',pageKey:'slide-1'},events:[]})
    await enterMain(mode,listeners,agent,emitted,prompts)
    await new Promise(resolve=>setImmediate(resolve))
    listeners.get('session/event')({id:'voice-live-main'}, {type:'assistant/message',data:{message:{content:[{type:'text',text:'{"selectedId":null,"speech":"本页第一段","navigation":"stay"}'}]}}})
    agent.status='idle'
    mode.acknowledge({ownerId:'owner-1234567890123456',turnId:emitted.at(-1).turnId})
    await new Promise(resolve=>setTimeout(resolve, 1250))
    assert.match(prompts[1],/本页第 2 段/)
    listeners.get('session/event')({id:'voice-live-main'}, {type:'assistant/message',data:{message:{content:[{type:'text',text:'{"selectedId":null,"speech":"讲完本页","navigation":"next"}'}]}}})
    agent.status='idle'
    mode.acknowledge({ownerId:'owner-1234567890123456',turnId:emitted.at(-1).turnId})
    await new Promise(resolve=>setTimeout(resolve, 1250))
    assert.equal(mode.status().phase,'waiting-presentation')
    assert.equal(prompts.length,2)
    mode.ingest({browserOpen:true,events:[{type:'comment',msgId:'c1',nickname:'观众乙',content:'可以回答吗'}]})
    await new Promise(resolve=>setTimeout(resolve, 200))
    assert.match(prompts[2],/观众乙/)
  } finally {mode.stop();rmSync(dir,{recursive:true,force:true})}
})

test('manual slides wait after narration and stage link exposes only read-only slide state', async () => {
  process.env.VOICE_LIVE_INGEST_TOKEN = 'ingest-test-secret'
  const dir = mkdtempSync(join(tmpdir(), 'dsh-live-slides-test-'))
  const listeners = new Map()
  const emitted = []
  const prompts = []
  const agent = {session:{id:'voice-live-main'},status:'idle',followup(input) { prompts.push(input.content[0].text); this.status='running' },cancel() { this.status='idle' }}
  const ctx = {on(name, callback) {listeners.set(name, callback)},effect() {},get() {return undefined}}
  const mode = createLiveMode(ctx, {
    agents:{get() {return null},async create({setup}) {setup({systemPrompt:{section(){}},tools:{restrict(){}}});return {agent}}},
    pushEvent(value) {emitted.push(value)},textOf(content) {return content?.[0]?.text || ''},resolveAgentOptions() {return undefined},rootDir:dir,
  })
  try {
    mode.configure({systemPrompt:'友好交流',sourceText:'# 首页\n欢迎\n---\n# 下一页\n继续'})
    mode.setAutoAdvance({enabled:false})
    mode.ingest({browserOpen:true,events:[]})
    await enterMain(mode,listeners,agent,emitted,prompts)
    await new Promise(resolve=>setImmediate(resolve))
    assert.match(prompts[0], /首页/)
    listeners.get('session/event')({id:'voice-live-main'}, {type:'assistant/message',data:{message:{content:[{type:'text',text:'{"selectedId":null,"speech":"欢迎","navigation":"stay"}'}]}}})
    agent.status='idle'
    const first = emitted.find(item=>item.kind==='live-speech')
    mode.acknowledge({ownerId:'owner-1234567890123456',turnId:first.turnId})
    await new Promise(resolve=>setTimeout(resolve, 1250))
    assert.match(prompts[1], /首页/)
    listeners.get('session/event')({id:'voice-live-main'}, {type:'assistant/message',data:{message:{content:[{type:'text',text:'{"selectedId":null,"speech":"讲完","navigation":"next"}'}]}}})
    agent.status='idle'
    mode.acknowledge({ownerId:'owner-1234567890123456',turnId:emitted.at(-1).turnId})
    await new Promise(resolve=>setTimeout(resolve, 1250))
    assert.equal(mode.status().phase, 'waiting-slide')
    assert.equal(prompts.length, 2)
    mode.setSlide({index:1})
    await new Promise(resolve=>setTimeout(resolve, 250))
    assert.match(prompts[2], /下一页/)
    const token = new URL(mode.status().stagePath,'http://localhost').searchParams.get('token')
    const response = () => ({status:0,body:'',writeHead(status) {this.status=status;return this},end(body='') {this.body=String(body)}})
    const blocked = response()
    mode.stageRoutes[1].handler({method:'GET',url:'/api/voice-call/live-stage-state?token=wrong'},blocked)
    assert.equal(blocked.status,404)
    const allowed = response()
    mode.stageRoutes[1].handler({method:'GET',url:'/api/voice-call/live-stage-state?token='+token},allowed)
    assert.equal(allowed.status,200)
    assert.equal(JSON.parse(allowed.body).slide.title,'下一页')
  } finally {mode.stop();rmSync(dir,{recursive:true,force:true})}
})

test('source speech waits for audio completion, then selects a new comment before continuing source', async () => {
  process.env.VOICE_LIVE_INGEST_TOKEN = 'ingest-test-secret'
  const dir = mkdtempSync(join(tmpdir(), 'dsh-live-test-'))
  const listeners = new Map()
  const emitted = []
  const prompts = []
  const agent = { session:{id:'voice-live-main'}, status:'idle', followup(input) { prompts.push(input.content[0].text); this.status='running' }, cancel() { this.status='idle' } }
  const ctx = {
    on(name, callback) { listeners.set(name, callback) },
    effect() {},
    get() { return undefined },
  }
  const mode = createLiveMode(ctx, {
    agents:{get() { return null }, async create({ setup }) {
      setup({systemPrompt:{section(){}},tools:{restrict() {}}})
      return {agent}
    }},
    pushEvent(value) { emitted.push(value) },
    textOf(content) { return content?.[0]?.text || '' },
    resolveAgentOptions() { return undefined },
    rootDir:dir,
  })
  const reply = speech => {
    listeners.get('session/event')({id:'voice-live-main'}, {type:'assistant/message',data:{message:{content:[{type:'text',text:speech}]}}})
    agent.status='idle'
    listeners.get('agent/status')({agent,status:'idle'})
  }
  try {
    const requested = mode.requestLogin()
    assert.equal(requested.loginPending, true)
    const command = mode.ingest({events:[]}).loginRequest
    assert.match(command, /^[a-f0-9-]{36}$/)
    mode.ingest({loginAck:command,events:[]})
    assert.equal(mode.status().loginPending, false)
    assert.ok(mode.status().loginOpenedAt > 0)
    mode.configure({systemPrompt:'友好交流',sourceText:'第一段\n第二段'})
    mode.ingest({liveId:'room-1',browserOpen:true,events:[]})
    await enterMain(mode,listeners,agent,emitted,prompts)
    await new Promise(resolve=>setImmediate(resolve))
    assert.equal(prompts.length, 1)
    assert.match(prompts[0], /第一段/)
    mode.ingest({liveId:'room-1',browserOpen:true,events:[{type:'comment',msgId:'m1',nickname:'观众甲',content:'你好吗'}]})
    reply('{"selectedId":null,"speech":"欢迎大家","navigation":"next"}')
    assert.equal(mode.status().phase, 'awaiting-audio')
    assert.equal(prompts.length, 1)
    const first = emitted.find(item=>item.kind==='live-speech')
    mode.acknowledge({ownerId:'owner-1234567890123456',turnId:first.turnId})
    await new Promise(resolve=>setTimeout(resolve, 1250))
    assert.equal(prompts.length, 2)
    assert.match(prompts[1], /观众甲/)
    reply('{"selectedId":"1","speech":"观众甲，我很好"}')
    const second = emitted.filter(item=>item.kind==='live-speech')[1]
    assert.equal(second.selected.nickname, '观众甲')
    mode.acknowledge({ownerId:'owner-1234567890123456',turnId:second.turnId})
    await new Promise(resolve=>setTimeout(resolve, 1250))
    assert.match(prompts[2], /第二段/)
    assert.equal(mode.status().lastSelected.nickname, '观众甲')
  } finally { mode.stop(); rmSync(dir,{recursive:true,force:true}) }
})
