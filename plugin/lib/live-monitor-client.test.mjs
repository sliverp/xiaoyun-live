import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
const source=readFileSync(new URL('./client.js',import.meta.url),'utf8')
const extract=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)))
test('a remote restart changes server state without enabling sound or claiming playback locally',async()=>{
  const refs={current:{liveOwnerId:'monitor-owner',liveActive:false,settings:{bgmEnabled:true}}},sounds=[],calls=[],notices=[]
  const restart=runInNewContext(extract('const restartLive =','const finishLive =')+'\nrestartLive',{
    refs,API:{liveRestart:'restart'},liveCall:async(path,body)=>{calls.push({path,body});return {ok:true,status:{ownerId:'obs-owner'}}},
    updateLiveStatus(){},setLiveNotice:text=>notices.push(text),setLiveBusy(){},setLiveError:message=>{if(message)throw new Error(message)},
    stopPlayback:()=>sounds.push('stop'),pauseBgm:()=>sounds.push('pause'),unlockAudio:()=>sounds.push('unlock'),startBgm:()=>sounds.push('play'),
  })
  await restart()
  assert.equal(calls[0].path,'restart');assert.equal(refs.current.liveActive,false)
  assert.deepEqual(sounds,[]);assert.match(notices[0],/原播报电脑/)
})
test('opening monitoring never steals an existing broadcaster; an explicit takeover is required',async()=>{
  const refs={current:{liveOwnerId:'monitor-owner',liveActive:false}},calls=[],sounds=[],notices=[]
  const start=runInNewContext(extract('const startLive =','const stopLive =')+'\nstartLive',{
    refs,API:{liveStatus:'status'},liveCall:async(path)=>{calls.push(path);return {ok:true,status:{running:true,ownerId:'obs-owner'}}},
    liveConfigFromStatus:()=>({}),updateLiveConfig(){},updateLiveStatus(){},setLiveBusy(){},setLiveNotice:text=>notices.push(text),setLiveError:message=>{if(message)throw new Error(message)},
    stopPlayback:()=>sounds.push('stop'),unlockAudio:()=>sounds.push('unlock'),pauseBgm(){},
  })
  await start()
  assert.deepEqual(calls,['status']);assert.deepEqual(sounds,[]);assert.equal(refs.current.liveActive,false)
  assert.match(notices[0],/接管播报/)
})
test('monitor-side resume only sends the shared control command, leaving sound on the broadcaster',async()=>{
  const refs={current:{liveOwnerId:'monitor-owner',liveActive:false}},sounds=[],calls=[]
  const resume=runInNewContext(extract('const toggleLivePause =','const restartLive =')+'\ntoggleLivePause',{
    refs,liveStatus:{paused:true,ownerId:'obs-owner'},API:{liveResume:'resume'},setLiveBusy(){},setLiveError:message=>{if(message)throw new Error(message)},
    liveCall:async(path)=>{calls.push(path);return {ok:true,status:{paused:false}}},updateLiveStatus(){},
    startLive:()=>sounds.push('start'),unlockAudio:()=>sounds.push('unlock'),applyLivePause:()=>sounds.push('local-pause'),
  })
  await resume();assert.deepEqual(calls,['resume']);assert.deepEqual(sounds,[])
})
test('older snapshots and responses from a retired server cannot overwrite a newer global state',()=>{
  const refs={current:{}},accepted=[]
  const update=runInNewContext(extract('const updateLiveStatus=','const automationFromStatus=')+'\nupdateLiveStatus',{refs,setLiveStatus:state=>accepted.push(state)})
  update({serverEpoch:'a',revision:2});update({serverEpoch:'a',revision:1});update({serverEpoch:'b',revision:1});update({serverEpoch:'a',revision:3})
  assert.deepEqual(accepted.map(state=>state.serverEpoch+state.revision),['a2','b1'])
})
