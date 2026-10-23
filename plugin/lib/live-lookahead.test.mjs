import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createLiveMode} from './live-mode.js'

const ownerId='lookahead-owner-123456789'
const flush=()=>new Promise(resolve=>setImmediate(resolve))
async function fixture(t,{synthesize,navigation='stay',sourceText='# 内容\n第一部分。\n---\n# 下一页\n第二部分。'}={}){
  process.env.VOICE_LIVE_INGEST_TOKEN='test-ingest'
  t.mock.timers.enable({apis:['setTimeout','Date'],now:1790000000000})
  const rootDir=mkdtempSync(join(tmpdir(),'xiaoyun-lookahead-')),listeners=new Map(),prompts=[],events=[],audio=[]
  const agent={session:{id:'voice-live-main'},status:'idle',followup(message){prompts.push(message.content[0].text);this.status='running'},cancel(){this.status='idle'}}
  const mode=createLiveMode({on(name,listener){listeners.set(name,listener)},get(){},effect(){}},{agents:{get(){return agent}},pushEvent:event=>events.push(event),textOf:content=>content[0].text,rootDir,resolveAgentOptions(){},generation:{timeoutMs:1000},synthesize:async(text,speed)=>{audio.push({text,speed});return synthesize?await synthesize(text,speed):{ok:true,audio:Buffer.from(text).toString('base64'),mime:'audio/mpeg'}}})
  t.after(()=>{mode.stop();rmSync(rootDir,{recursive:true,force:true})})
  const tick=async(ms=110)=>{t.mock.timers.tick(ms);await flush()}
  const ingest=comments=>mode.ingest({browserOpen:true,liveId:'room-a',events:comments.map((content,index)=>({type:'comment',msgId:content,nickname:'观众'+index,content}))})
  const reply=(speech,navigation='stay')=>{listeners.get('session/event')({id:'voice-live-main'},{type:'assistant/message',data:{message:{content:[{type:'text',text:JSON.stringify({speech,navigation})}]}}});agent.status='idle'}
  const ack=()=>mode.acknowledge({ownerId,turnId:mode.status().currentSpeech.turnId})
  const prepare=(speed=1)=>mode.prepareNext({ownerId,turnId:mode.status().currentSpeech.turnId,speed})
  mode.configure({systemPrompt:'你是小云，介绍云端 Agent。',sourceText,commentFrequency:80})
  ingest([]);await mode.start(ownerId);await tick(0);reply('欢迎大家。');ack();await tick();reply('当前正在播放的完整讲解。',navigation)
  return {mode,agent,listeners,prompts,events,audio,tick,ingest,reply,ack,prepare}
}

test('next text and audio are prepared during playback without advancing the current turn',async t=>{
  const f=await fixture(t),current=f.mode.status().currentSpeech.turnId
  f.prepare(.9);await f.tick(0)
  assert.equal(f.prompts.length,3)
  assert.equal(f.mode.status().phase,'awaiting-audio')
  assert.equal(f.mode.status().currentSpeech.turnId,current)
  assert.equal(f.mode.status().stateMachine.current.id,'source')
  f.reply('下一段的完整讲解。');await f.tick(0)
  assert.equal(f.mode.status().preparation.phase,'ready')
  assert.equal(f.mode.status().pageSourceTurns,0)
  assert.equal(f.events.filter(event=>event.kind==='live-speech').length,2)
  assert.equal(f.audio[0].speed,.9)
  f.prepare(.9);await f.tick(0);assert.equal(f.prompts.length,3)
  f.ack();await f.tick()
  const next=f.events.filter(event=>event.kind==='live-speech').at(-1)
  assert.equal(next.text,'下一段的完整讲解。');assert.equal(next.audioSpeed,.9)
  assert.equal(Buffer.from(next.audioSegments[0].audio,'base64').toString(),next.text)
  assert.equal(f.prompts.length,3);assert.equal(f.mode.status().pageSourceTurns,1)
})

test('fresh comments at the audio boundary override a prepared lecture and remain fully visible',async t=>{
  const f=await fixture(t)
  f.prepare();await f.tick(0);f.reply('这段预生成的讲解还没播出。');await f.tick(0)
  f.ingest(['问题一','问题二','问题三']);f.ack();await f.tick()
  assert.equal(f.mode.status().stateMachine.current.id,'comment')
  assert.equal(f.mode.status().preparation,null)
  assert.match(f.prompts.at(-1),/问题一/);assert.match(f.prompts.at(-1),/问题三/)
  assert.match(f.prompts.at(-1),/没有实际播出/)
  assert.equal(f.events.some(event=>event.kind==='live-speech'&&event.text==='这段预生成的讲解还没播出。'),false)
})

test('comments arriving after warmup refresh the response from the entire unread batch',async t=>{
  const f=await fixture(t)
  f.ingest(['先来的问题']);f.prepare();await f.tick(0)
  assert.equal(f.mode.status().preparation.kind,'comment')
  f.reply('先回应一下大家关心的问题。');await f.tick(0)
  f.ingest(['后来才到的问题']);f.ack();await f.tick()
  assert.equal(f.mode.status().stateMachine.current.id,'comment')
  assert.equal(f.mode.status().preparation,null)
  assert.match(f.prompts.at(-1),/先来的问题/);assert.match(f.prompts.at(-1),/后来才到的问题/)
  assert.equal(f.mode.status().stateMachine.metrics.unreadCount,2)
})

test('an unfinished background generation is promoted instead of starting a duplicate model request',async t=>{
  const f=await fixture(t)
  f.prepare();await f.tick(0);const count=f.prompts.length
  f.ack();await f.tick()
  assert.equal(f.prompts.length,count);assert.equal(f.mode.status().phase,'thinking')
  f.reply('生成稍慢的下一段。');await f.tick(0)
  assert.equal(f.mode.status().currentSpeech.text,'生成稍慢的下一段。')
  assert.ok(f.events.at(-1).audioSegments)
})

test('stopping while warm audio is pending discards late completion',async t=>{
  let release
  const f=await fixture(t,{synthesize:()=>new Promise(resolve=>{release=resolve})})
  f.prepare();await f.tick(0);f.reply('正在预合成的下一段。');await f.tick(0)
  assert.equal(f.mode.status().preparation.phase,'synthesizing')
  f.ack();await f.tick();assert.equal(f.mode.status().phase,'preparing-audio')
  f.mode.stop();const count=f.events.length
  release({ok:true,audio:'SUQzBA=='});await f.tick(0)
  assert.equal(f.events.length,count);assert.equal(f.mode.status().running,false)
})

test('a giveaway overrides the prepared segment at the complete audio boundary',async t=>{
  const f=await fixture(t)
  f.prepare();await f.tick(0);f.reply('不会抢在抽奖前播出的文稿。');await f.tick(0)
  f.mode.requestLottery({keyword:'小云送大礼',waitSeconds:10})
  assert.equal(f.mode.status().currentSpeech.text,'当前正在播放的完整讲解。')
  f.ack();await f.tick()
  assert.equal(f.mode.status().stateMachine.current.id,'lottery-announcement')
  assert.equal(f.events.some(event=>event.kind==='live-speech'&&event.text==='不会抢在抽奖前播出的文稿。'),false)
})

test('a background timeout leaves the currently playing speech intact',async t=>{
  const f=await fixture(t),current=f.mode.status().currentSpeech.turnId
  f.prepare();await f.tick(0);await f.tick(1000)
  assert.equal(f.mode.status().running,true)
  assert.equal(f.mode.status().phase,'awaiting-audio')
  assert.equal(f.mode.status().currentSpeech.turnId,current)
  assert.equal(f.mode.status().preparation.phase,'error')
  f.ack();await f.tick();assert.equal(f.mode.status().phase,'thinking')
})

test('a warmup audio error falls back to ordinary synthesis without replacing the text',async t=>{
  const f=await fixture(t,{synthesize:async()=>({ok:false,error:'temporary unavailable'})})
  f.prepare();await f.tick(0);f.reply('音频可以重试，文稿保留。');await f.tick(0)
  assert.equal(f.mode.status().running,true);assert.equal(f.mode.status().preparation.phase,'error')
  f.ack();await f.tick()
  assert.equal(f.mode.status().currentSpeech.text,'音频可以重试，文稿保留。')
  assert.equal(f.events.at(-1).audioSegments,undefined)
})

test('finished-page narration does not speculate on a page that is not yet visible',async t=>{
  const f=await fixture(t,{navigation:'next'})
  const count=f.prompts.length
  f.prepare();await f.tick(0)
  assert.equal(f.mode.status().preparation,null);assert.equal(f.prompts.length,count)
})

test('goodbye discards the next lecture and starts only after the current audio ends',async t=>{
  const f=await fixture(t)
  f.prepare();await f.tick(0);f.reply('这段讲解不用播了。');await f.tick(0)
  f.mode.finish()
  assert.equal(f.mode.status().currentSpeech.text,'当前正在播放的完整讲解。')
  assert.equal(f.mode.status().preparation,null)
  f.ack();await f.tick()
  assert.equal(f.mode.status().stateMachine.current.id,'closing')
  assert.match(f.prompts.at(-1),/场控请求结束直播/)
})

test('a long prepared narration retains every character in ordered, bounded audio pieces',async t=>{
  const f=await fixture(t),text='甲'.repeat(175)+'。'+'乙'.repeat(170)
  f.prepare();await f.tick(0);f.reply(text);await f.tick(0)
  assert.ok(f.audio.length>=3)
  assert.equal(f.audio.map(item=>item.text).join(''),text)
  assert.ok(f.audio.every(item=>Array.from(item.text).length<=150&&Buffer.byteLength(item.text)<=450))
  f.ack();await f.tick()
  const ev=f.events.filter(item=>item.kind==='live-speech').at(-1)
  assert.equal(ev.audioSegments.map(item=>Buffer.from(item.audio,'base64').toString()).join(''),text)
})

test('old playback owners cannot request generation or change synthesis speed',async t=>{
  const f=await fixture(t),turnId=f.mode.status().currentSpeech.turnId
  assert.throws(()=>f.mode.prepareNext({ownerId:'wrong-owner',turnId}),/播报端/)
  assert.throws(()=>f.mode.prepareNext({ownerId,turnId,speed:10}),/语速/)
  assert.equal(f.mode.status().preparation,null)
})
