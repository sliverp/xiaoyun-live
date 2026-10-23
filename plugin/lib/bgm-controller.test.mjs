import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
const source = readFileSync(new URL('./client.js',import.meta.url),'utf8').split('// BEGIN BACKGROUND MUSIC CONTROLLER')[1].split('// END BACKGROUND MUSIC CONTROLLER')[0]
const create = runInNewContext(source+'\ncreateBackgroundMusic')
function fixture({pending=false}={}) {
  let now=0, serial=0
  const frames=new Map(),timers=new Map(),nodes=[],states=[]
  class Audio {
    constructor(url){this.src=url;this.volume=0;this.paused=true;nodes.push(this)}
    play(){this.paused=false;if(!pending){this.onplaying?.();return Promise.resolve()}return new Promise(resolve=>{this.resolve=()=>{this.onplaying?.();resolve()}})}
    pause(){this.paused=true;this.onpause?.()}
    removeAttribute(){this.src=''}
    load(){}
  }
  const listeners=new Map();
  const document={hidden:false,addEventListener:(name,callback)=>listeners.set(name,callback),removeEventListener:name=>listeners.delete(name)};
  const environment={document,Audio,performance:{now:()=>now},requestAnimationFrame:callback=>{const id=++serial;frames.set(id,callback);return id},cancelAnimationFrame:id=>frames.delete(id),setTimeout:(callback,delay)=>{const id=++serial;timers.set(id,{callback,at:now+delay});return id},clearTimeout:id=>timers.delete(id)}
  const advance=milliseconds=>{
    now+=milliseconds
    for(const [id,timer]of [...timers])if(timer.at<=now){timers.delete(id);timer.callback()}
    const callbacks=[...frames];frames.clear();for(const [,callback]of callbacks)callback(now)
  }
  const music=create({onState:value=>states.push({...value}),environment})
  return {music,nodes,states,advance,frames,timers,document,listeners}
}

test('music ducks during speech, holds its level across short speech gaps, and then recovers',async()=>{
  const f=fixture();f.music.setSource('track.mp3');await f.music.play();f.advance(600)
  assert.equal(f.nodes[0].volume,.16)
  assert.equal(f.nodes[0].loop,true)
  f.music.setSpeaking(true);f.advance(120)
  assert.ok(Math.abs(f.nodes[0].volume-.048)<.000001)
  assert.equal(f.music.state().ducked,true)
  f.music.setSpeaking(false);f.advance(400)
  assert.ok(Math.abs(f.nodes[0].volume-.048)<.000001)
  f.music.setSpeaking(true);f.advance(1000)
  assert.ok(Math.abs(f.nodes[0].volume-.048)<.000001)
  f.music.setSpeaking(false);f.advance(650);f.advance(1100)
  assert.equal(f.nodes[0].volume,.16)
  assert.equal(f.music.state().ducked,false)
  f.music.setOptions({volume:0,duck:true});f.advance(180)
  assert.equal(f.nodes[0].volume,0)
  f.music.dispose()
})

test('pausing and disposing prevent an outstanding play request from starting music again',async()=>{
  const f=fixture({pending:true});f.music.setSource('track.mp3')
  const started=f.music.play();f.music.pause();f.nodes[0].resolve()
  assert.equal(await started,false)
  assert.equal(f.nodes[0].paused,true)
  assert.equal(f.music.state().phase,'paused')
  f.music.setSpeaking(false);f.music.dispose();f.music.setSpeaking(false)
  assert.equal(f.frames.size,0)
  assert.equal(f.timers.size,0)
})

test('switching a running track releases the old audio and keeps volume preferences',async()=>{
  const f=fixture();f.music.setSource('old.mp3');await f.music.play();f.advance(600)
  f.music.setOptions({volume:.25,duck:false});f.music.setSource('new.mp3');await new Promise(resolve=>setImmediate(resolve));f.advance(600)
  assert.equal(f.nodes[0].paused,true)
  assert.equal(f.nodes[0].src,'')
  assert.equal(f.nodes[1].src,'new.mp3')
  assert.equal(f.nodes[1].volume,.25)
  assert.equal(f.music.state().phase,'playing')
  f.music.dispose()
})

test('speech still lowers music immediately when the control tab is in the background',async()=>{
  const f=fixture();f.music.setSource('track.mp3');await f.music.play();f.advance(600)
  f.document.hidden=true;f.listeners.get('visibilitychange')()
  f.music.setSpeaking(true)
  assert.ok(Math.abs(f.nodes[0].volume-.048)<.000001)
  assert.equal(f.frames.size,0)
  f.music.setSpeaking(false);f.advance(650)
  assert.equal(f.nodes[0].volume,.16)
  f.music.dispose();assert.equal(f.listeners.size,0)
})

test('each built-in choice resolves to its own stored track and has a source credit',()=>{
  const tracks=runInNewContext(source+'\nBGM_TRACKS'),resolve=runInNewContext(source+'\nbackgroundTrack')
  assert.equal(tracks.length,4)
  assert.equal(new Set(tracks.map(track=>track.id)).size,4)
  assert.equal(new Set(tracks.map(track=>track.url)).size,4)
  for(const track of tracks){
    assert.equal(resolve(track.id).url,track.url)
    assert.match(track.url,/\/live-bgm\/.+\.[a-f0-9]{16}\.mp3$/)
    assert.ok(track.credit&&track.source)
  }
  assert.equal(resolve('unknown').id,'gymnopedie')
})
