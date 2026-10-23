import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,readFileSync,appendFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createLiveAnalytics} from './live-analytics.js'

const makeSnapshot=(at,online,state='live',liveId='room-a')=>({at,liveId,platformState:state,fields:online===null?{}:{onlineUsers:{value:online,raw:String(online),at,source:'api',path:'data.liveInfo.onlineCnt'},startedAtMs:{value:at-100000,raw:String(at-100000),at,source:'api'}},extra:{}})
const fixture=t=>{const rootDir=mkdtempSync(join(tmpdir(),'xiaoyun-live-analytics-'));t.after(()=>rmSync(rootDir,{recursive:true,force:true}));return {rootDir,analytics:createLiveAnalytics({rootDir})}}

test('platform end produces a report with sampled peaks, missing metrics, and deduplicated comments',t=>{
  const {rootDir,analytics}=fixture(t),at=Date.now()-20000
  const comment={type:'comment',msgId:'m1',nickname:'观众',viewerId:'v1',content:'你好',at}
  analytics.ingest({liveId:'room-a',browserOpen:true,metricsSnapshots:[makeSnapshot(at,12)],events:[comment]},{stage:'source',running:true,pageNumber:3})
  analytics.ingest({liveId:'room-a',browserOpen:true,metricsSnapshots:[makeSnapshot(at+5000,18)],events:[comment]})
  analytics.ingest({liveId:'room-a',browserOpen:true,metricsSnapshots:[makeSnapshot(at+10000,0,'ended')],events:[]})
  const data=JSON.parse(analytics.exportData().body),s=data.summary
  assert.equal(s.status,'ended')
  assert.equal(s.commentCount,1)
  assert.equal(s.uniqueCommenterIds,1)
  assert.equal(s.metrics.onlineUsers.observedPeak,18)
  assert.equal(s.metrics.onlineUsers.last,0)
  assert.equal(s.metrics.heat.last,null)
  assert.equal(s.observedAverageOnline,15)
  assert.equal(s.averageOnlineCoverageSeconds,10)
  assert.equal(data.snapshots[0].pageNumber,3)
  assert.equal(data.events[0].content,'你好')
  assert.match(readFileSync(join(rootDir,'live-analytics',s.sessionId,'report.md'),'utf8'),/小云直播数据报告/)
  assert.match(analytics.exportData({format:'csv'}).body,/onlineUsers_source/)
})

test('AI stopping exports a partial report while platform metrics keep collecting through narrator restart',t=>{
  const {analytics}=fixture(t),at=Date.now()-10000
  analytics.ingest({browserOpen:true,metricsSnapshots:[makeSnapshot(at,1)]})
  analytics.startAi();analytics.stopAi('立即停止')
  const id=analytics.status().current.id
  analytics.ingest({browserOpen:true,metricsSnapshots:[makeSnapshot(at+5000,10)]})
  analytics.startAi();analytics.stopAi('告别完成')
  const s=JSON.parse(analytics.exportData().body).summary
  assert.equal(s.sessionId,id)
  assert.equal(s.status,'collecting')
  assert.equal(s.aiRuns.length,2)
  assert.equal(s.metrics.onlineUsers.observedPeak,10)
})

test('restarting the service restores archive and deduplication; a new room gets a separate session',t=>{
  const {analytics,rootDir}=fixture(t),at=Date.now()-10000
  const event={type:'comment',msgId:'same',viewerId:'viewer',content:'你好'}
  analytics.ingest({liveId:'room-a',browserOpen:true,metricsSnapshots:[makeSnapshot(at,5)],events:[event]})
  const id=analytics.status().current.id
  const restored=createLiveAnalytics({rootDir})
  restored.ingest({liveId:'room-a',browserOpen:true,metricsSnapshots:[makeSnapshot(at,5)],events:[event]})
  assert.equal(restored.status().current.snapshotCount,1)
  assert.equal(restored.status().current.commentCount,1)
  restored.ingest({liveId:'room-b',browserOpen:true,metricsSnapshots:[makeSnapshot(at+5000,7,'live','room-b')],events:[event]})
  assert.notEqual(restored.status().current.id,id)
  assert.equal(restored.status().current.commentCount,1)
  assert.equal(JSON.parse(restored.exportData({sessionId:id}).body).summary.endReason,'检测到新的直播场次')
  assert.throws(()=>restored.exportData({sessionId:'../../secret'}),/没有可导出/)
})

test('missing slices and disconnects remain missing, and stale counters are withheld from the model',t=>{
  const {analytics}=fixture(t),at=Date.now()-60000
  analytics.ingest({browserOpen:true,metricsSnapshots:[makeSnapshot(at,25)]})
  assert.equal(analytics.modelContext().available,false)
  analytics.ingest({browserOpen:false,metricsSnapshots:[makeSnapshot(at+5000,null)]})
  const data=JSON.parse(analytics.exportData().body)
  assert.deepEqual(data.snapshots[1].fields,{})
  assert.equal(data.snapshots[1].connected,false)
  assert.equal(data.summary.metrics.onlineUsers.last,25)
  assert.equal(data.summary.metrics.totalViewers.last,null)
  assert.equal(analytics.modelContext().metrics['在线人数'],undefined)
})

test('data is available to the model with sample time, and ended replay does not invent a second session',t=>{
  const {analytics}=fixture(t),at=Date.now()-1000
  analytics.ingest({browserOpen:true,metricsSnapshots:[makeSnapshot(at,8)]})
  assert.equal(analytics.modelContext().metrics['在线人数'].value,8)
  assert.ok(analytics.modelContext().metrics['在线人数'].observedAt)
  analytics.ingest({browserOpen:true,metricsSnapshots:[makeSnapshot(at+1,8,'ended')]})
  analytics.ingest({browserOpen:true,metricsSnapshots:[makeSnapshot(at+2,8,'ended')]})
  assert.equal(analytics.status().sessions.length,1)
  assert.equal(analytics.status().current.status,'ended')
})

test('an interrupted final JSONL write is ignored without inventing a metric sample',t=>{
  const {analytics,rootDir}=fixture(t),at=Date.now()-1000
  analytics.ingest({browserOpen:true,metricsSnapshots:[makeSnapshot(at,4)]})
  const id=analytics.status().current.id
  appendFileSync(join(rootDir,'live-analytics',id,'snapshots.jsonl'),'{"at":')
  const data=JSON.parse(analytics.exportData().body)
  assert.equal(data.snapshots.length,1)
  const restored=createLiveAnalytics({rootDir})
  restored.ingest({browserOpen:true,metricsSnapshots:[makeSnapshot(at+1,6)]})
  assert.equal(JSON.parse(restored.exportData().body).snapshots.length,2)
})
