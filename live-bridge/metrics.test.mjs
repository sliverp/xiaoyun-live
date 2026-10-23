import {test} from 'node:test'
import assert from 'node:assert/strict'
import {isLiveDataResponse,extractLiveMetrics,extractDomMetrics,createMetricCollector,readBackendMetricTiles} from './metrics.mjs'
import {parseMetricValue,normalizeMetricSnapshot} from '../plugin/lib/live-metrics.js'

test('zero is a measurement, unavailable is missing, rounded counts retain provenance',()=>{
  assert.equal(parseMetricValue(0),0)
  for(const value of [null,undefined,'','--','暂无',-1,Infinity,true,'100人正在聊天'])assert.equal(parseMetricValue(value),null)
  assert.equal(parseMetricValue('1.2万'),12000)
  assert.equal(parseMetricValue('1,234 人'),1234)
  assert.equal(parseMetricValue('01:02:03','durationSeconds'),3723)
  assert.equal(parseMetricValue('02:99','durationSeconds'),null)
  assert.equal(parseMetricValue(1790000000,'startedAtMs'),1790000000000)
})

test('API counters are read without uploading cookies, full payloads, or account identifiers',()=>{
  const s=extractLiveMetrics({data:{liveInfo:{liveId:'room-a',liveStatus:1,onlineCnt:0,likeCnt:12,startTime:1790000000,rewardTotalAmountInWecoin:3,cookie:'secret',openid:'secret',unknownCount:42,nested:{otherCnt:9,tokenCount:999}},msgList:[{content:'private'}]}},1790000001000)
  assert.equal(s.fields.onlineUsers.value,0)
  assert.equal(s.fields.giftCoins.value,3)
  assert.equal(s.fields.startedAtMs.value,1790000000000)
  assert.equal(s.platformState,'live')
  assert.equal(s.extra['data.liveInfo.unknownCount'].value,42)
  assert.doesNotMatch(JSON.stringify(s),/secret|private|tokenCount/)
  assert.equal(isLiveDataResponse('https://channels.weixin.qq.com/cgi-bin/mmfinderassistant-bin/live/msg'),true)
  assert.equal(isLiveDataResponse('https://channels.weixin.qq.com/micro/live/cgi-bin/mmfinderassistant-bin/live/msg'),true)
  assert.equal(isLiveDataResponse('https://channels.weixin.qq.com/micro/live/cgi-bin/mmfinderassistant-bin/live/get_live_info'),true)
  assert.equal(isLiveDataResponse('https://example.org/mmfinderassistant-bin/live/msg'),false)
  assert.equal(isLiveDataResponse('https://channels.weixin.qq.com/mmfinderassistant-bin/login'),false)
})

test('every recognized live-message route also passes the live-data filter',async()=>{
  const {isLiveMessageResponse}=await import('./parser.mjs')
  for(const prefix of ['', '/cgi-bin', '/micro/live/cgi-bin']){
    const address='https://channels.weixin.qq.com'+prefix+'/mmfinderassistant-bin/live/msg'
    assert.equal(isLiveMessageResponse(address),true)
    assert.equal(isLiveDataResponse(address),true)
  }
})

test('DOM tiles work with either visual orientation and do not mistake a missing count for a neighbour',()=>{
  const s=extractDomMetrics([{label:'在线人数',value:'10'},{label:'热度',value:'2.6万'},{label:'点赞',value:'--'}],1000)
  assert.equal(s.fields.onlineUsers.value,10)
  assert.equal(s.fields.heat.value,26000)
  assert.equal(s.fields.heat.approximate,true)
  assert.equal(s.fields.likes,undefined)
  assert.equal(extractDomMetrics(['直播已结束']).platformState,'ended')
})

test('collector prefers fresh API counters, expires each counter separately, and resets for a new room',()=>{
  const collector=createMetricCollector({freshMs:10000})
  collector.update(extractLiveMetrics({data:{liveInfo:{liveId:'a',onlineCnt:15,likeCnt:70}}},1000))
  collector.update(extractDomMetrics([{label:'在线人数',value:'10'}],2000))
  assert.equal(collector.snapshot(2000).fields.onlineUsers.value,15)
  assert.deepEqual(collector.snapshot(12000).fields,{})
  collector.update(extractLiveMetrics({data:{liveInfo:{liveId:'b',onlineCnt:2}}},13000))
  assert.equal(collector.snapshot(13000).liveId,'b')
  assert.equal(collector.snapshot(13000).fields.likes,undefined)
})

test('fresh API live status prevents an older DOM ended label from closing the session',()=>{
  const collector=createMetricCollector()
  collector.update(extractLiveMetrics({data:{liveInfo:{liveId:'a',liveStatus:1,onlineCnt:8}}},1000))
  collector.update(extractDomMetrics(['直播已结束'],2000))
  assert.equal(collector.snapshot(2000).platformState,'live')
  collector.update(extractLiveMetrics({data:{liveInfo:{liveId:'a',liveStatus:2,onlineCnt:0}}},3000))
  assert.equal(collector.snapshot(3000).platformState,'ended')
})

test('wire parser rejects forged future or invalid counters without losing a legitimate zero',()=>{
  assert.equal(normalizeMetricSnapshot({at:100000},1000),null)
  const s=normalizeMetricSnapshot({at:1000,fields:{onlineUsers:{value:0,at:1000,source:'api'},heat:{value:'bad',at:1000}},extra:{'data.liveInfo.authCount':{value:4}}},1000)
  assert.equal(s.fields.onlineUsers.value,0)
  assert.equal(s.fields.heat,undefined)
  assert.deepEqual(s.extra,{})
})
