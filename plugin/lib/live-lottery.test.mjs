import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createLiveLottery} from './live-lottery.js'

function fixture(t){const rootDir=mkdtempSync(join(tmpdir(),'xiaoyun-lottery-'));t.after(()=>rmSync(rootDir,{recursive:true,force:true}));return {rootDir,lottery:createLiveLottery({rootDir})}}

test('participation starts after the announcement, selecting the first exact new comment in receipt order',t=>{
  let now=100000;t.mock.method(Date,'now',()=>now)
  const {lottery}=fixture(t)
  lottery.request({keyword:'小云送大礼',waitSeconds:10})
  assert.equal(lottery.status().current.startedAt,null)
  assert.match(lottery.begin('room-a'),/一件文化衫/)
  assert.equal(lottery.status().current.startedAt,null)
  lottery.openWindow(5)
  const comments=[
    {serial:4,at:now+1,content:'小云送大礼',nickname:'旧弹幕'},
    {serial:6,at:now+1,content:'我想小云送大礼',nickname:'不完全匹配'},
    {serial:8,at:now+4000,content:'小云送大礼',nickname:'观众乙',msgId:'m8'},
    {serial:7,at:now+3000,content:' 小云送大礼 ',nickname:'观众甲完整ID',msgId:'m7',viewerId:'viewer7'},
    {serial:9,at:now+10001,content:'小云送大礼',nickname:'超时弹幕'},
  ]
  assert.equal(lottery.settle({comments,liveId:'room-a',bridgeReady:true}),false)
  now+=10000
  assert.equal(lottery.settle({comments,liveId:'room-a',bridgeReady:true}),true)
  assert.equal(lottery.status().current.winner.nickname,'观众甲完整ID')
  assert.equal(lottery.status().current.winner.msgId,'m7')
  assert.match(lottery.resultSpeech(),/恭喜观众甲完整ID/)
  lottery.complete();assert.equal(lottery.isActive(),false)
})

test('duplicate clicks fail, and no eligible comment produces an explicit no-winner result',t=>{
  let now=100000;t.mock.method(Date,'now',()=>now)
  const {lottery}=fixture(t)
  assert.throws(()=>lottery.request({keyword:'',waitSeconds:10}),/口令/)
  assert.throws(()=>lottery.request({keyword:'口令',waitSeconds:1}),/参与时间/)
  lottery.request({keyword:'口令',waitSeconds:5})
  assert.throws(()=>lottery.request(),/已有一轮/)
  lottery.begin('room');lottery.openWindow(0);now+=5000
  lottery.settle({comments:[],liveId:'room',bridgeReady:true})
  assert.equal(lottery.status().current.outcome,'empty')
  assert.match(lottery.resultSpeech(),/没有中奖者/)
})

test('disconnects and room changes cannot select a winner from an incomplete collection',t=>{
  for(const context of [{liveId:'room-a',bridgeReady:false},{liveId:'room-b',bridgeReady:true}]){
    let now=100000;t.mock.method(Date,'now',()=>now)
    const {lottery}=fixture(t);lottery.request();lottery.begin('room-a');lottery.openWindow(0)
    const comments=[{serial:1,at:now+1,content:'小云送大礼',nickname:'观众'}];now+=10000
    lottery.settle({comments,...context})
    assert.equal(lottery.status().current.winner,null)
    assert.equal(lottery.status().current.outcome,'cancelled')
    assert.match(lottery.resultSpeech(),/取消/)
  }
})

test('a service restart retains a selected ID without rerolling or replaying a giveaway',t=>{
  let now=100000;t.mock.method(Date,'now',()=>now)
  const {lottery,rootDir}=fixture(t);lottery.request();lottery.begin('room');lottery.openWindow(0)
  const comments=[{serial:1,at:now+1,content:'小云送大礼',nickname:'保留ID',msgId:'m1'}];now+=10000
  lottery.settle({comments,liveId:'room',bridgeReady:true})
  const restored=createLiveLottery({rootDir})
  assert.equal(restored.status().current.state,'interrupted')
  assert.equal(restored.status().current.winner.nickname,'保留ID')
  assert.equal(restored.isActive(),false)
  restored.request();assert.equal(restored.status().history[0].winner.nickname,'保留ID')
})

test('the two rewards are announced in order, direct winners to the lower-right community QR, and cannot be drawn again',t=>{
  let now=100000;t.mock.method(Date,'now',()=>now)
  const {lottery,rootDir}=fixture(t)
  for(const [index,prize] of ['一件文化衫','一个马年公仔'].entries()){
    lottery.request({keyword:'参与口令',waitSeconds:5})
    assert.equal(lottery.status().current.roundNumber,index+1)
    assert.ok(lottery.begin('room').includes(prize))
    lottery.openWindow(index)
    const comment={serial:index+1,at:now+1,content:'参与口令',nickname:'幸运观众'+index}
    lottery.observeComment(comment,'room')
    now+=5000
    lottery.settle({comments:[],liveId:'room',bridgeReady:true})
    assert.match(lottery.resultSpeech(),/屏幕右下方.*加入社群后联系工作人员领取奖励/)
    assert.ok(lottery.resultSpeech().includes(prize))
    lottery.complete()
  }
  assert.throws(()=>lottery.request(),/奖品池已发完/)
  const restored=createLiveLottery({rootDir})
  assert.equal(restored.status().drawsUsed,2)
  assert.throws(()=>restored.request(),/奖品池已发完/)
  restored.reset();restored.request()
  assert.equal(restored.status().current.prize,'一件文化衫')
})

test('an empty or cancelled attempt keeps the same prize available',t=>{
  let now=100000;t.mock.method(Date,'now',()=>now)
  const {lottery}=fixture(t)
  lottery.request();lottery.begin('room');lottery.openWindow(0);now+=10000
  lottery.settle({comments:[],liveId:'room',bridgeReady:true});lottery.complete()
  assert.equal(lottery.status().drawsUsed,0)
  lottery.request();assert.equal(lottery.status().current.prize,'一件文化衫')
  lottery.cancel('取消');lottery.request();assert.equal(lottery.status().current.roundNumber,1)
})

test('a long broadcast retains all awarded records beyond fifty attempts',t=>{
  let now=100000;t.mock.method(Date,'now',()=>now)
  const {lottery,rootDir}=fixture(t);lottery.configurePool(Array.from({length:60},()=>'一份礼物'))
  for(let i=0;i<60;i++){
    lottery.request({keyword:'参与',waitSeconds:5});lottery.begin('room');lottery.openWindow(i)
    const comment={serial:i+1,at:now+1,content:'参与',nickname:'观众'+i};now+=5000
    lottery.settle({comments:[comment],liveId:'room',bridgeReady:true});lottery.complete()
  }
  const stored=JSON.parse(readFileSync(join(rootDir,'live-lottery.json'),'utf8'))
  assert.equal(stored.drawsUsed,60);assert.equal(stored.history.filter(item=>item.winner).length,59)
  assert.equal(stored.history[0].winner.nickname,'观众0')
})
