import {randomUUID} from 'node:crypto'
import {mkdirSync,readdirSync,readFileSync,writeFileSync,appendFileSync,truncateSync} from 'node:fs'
import {join} from 'node:path'
import {LIVE_METRICS,normalizeMetricSnapshot} from './live-metrics.js'

const validId=id=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id)
const iso=at=>at?new Date(at).toISOString():null
const readLines=path=>{
  const text=readFileSync(path,'utf8')
  const lines=text.split('\n')
  // A crash can interrupt the final append; only complete JSONL records count.
  if(lines.at(-1)!==''){lines.pop();truncateSync(path,Buffer.byteLength(lines.join('\n')+(lines.length?'\n':'')))}
  return lines.filter(Boolean).map(line=>JSON.parse(line))
}
const csvCell=value=>{
  let text=value==null?'':String(value)
  if(/^[=+\-@\t\r]/.test(text))text="'"+text
  return '"'+text.replaceAll('"','""')+'"'
}

/** Persist platform sessions independently of the AI narrator's start/stop cycles. */
export function createLiveAnalytics({rootDir}) {
  const root=join(rootDir,'live-analytics')
  mkdirSync(root,{recursive:true,mode:0o700})
  const sessions=new Map()
  for(const id of readdirSync(root).filter(validId)) {
    const meta=JSON.parse(readFileSync(join(root,id,'session.json'),'utf8'))
    if(meta.version!==1||meta.id!==id)throw new Error('直播数据记录格式无效')
    const snapshots=readLines(join(root,id,'snapshots.jsonl'))
    const events=readLines(join(root,id,'events.jsonl'))
    meta.snapshotCount=snapshots.length;meta.eventCount=events.length;meta.commentCount=events.filter(event=>event.type==='comment').length
    meta.latestSnapshot=snapshots.at(-1)||null;meta.lastFields={};meta.peaks={}
    for(const snapshot of snapshots){
      meta.lastObservedAt=Math.max(meta.lastObservedAt,snapshot.at)
      for(const [key,entry]of Object.entries(snapshot.fields)){
        meta.lastFields[key]=entry
        if(!meta.peaks[key]||entry.value>meta.peaks[key].value)meta.peaks[key]={value:entry.value,at:entry.at}
      }
    }
    const oldRun=meta.aiRuns.at(-1)
    if(oldRun&&!oldRun.endedAt){oldRun.endedAt=Math.max(oldRun.startedAt,meta.lastObservedAt);oldRun.reason='服务重启，上个播报区间按最后观测时间结束'}
    writeFileSync(join(root,id,'session.json'),JSON.stringify(meta,null,2)+'\n',{mode:0o600})
    sessions.set(id,meta)
  }
  let current=[...sessions.values()].filter(s=>!s.endedAt).sort((a,b)=>b.firstObservedAt-a.firstObservedAt)[0]||null
  let latest=[...sessions.values()].sort((a,b)=>b.lastObservedAt-a.lastObservedAt)[0]||null
  let seen=new Set()
  const path=(s,name)=>join(root,s.id,name)
  const loadSeen=()=>{seen=new Set(current?readLines(path(current,'events.jsonl')).filter(e=>e.msgId).map(e=>e.msgId):[])}
  loadSeen()
  const persist=s=>writeFileSync(path(s,'session.json'),JSON.stringify(s,null,2)+'\n',{mode:0o600})
  const append=(s,file,value)=>appendFileSync(path(s,file),JSON.stringify(value)+'\n',{mode:0o600})
  const create=(liveId,at)=>{
    const s={version:1,id:randomUUID(),liveId,firstObservedAt:at,lastObservedAt:at,startedAt:null,endedAt:null,platformEndedAt:null,endReason:'',snapshotCount:0,eventCount:0,commentCount:0,latestSnapshot:null,lastFields:{},peaks:{},aiRuns:[]}
    mkdirSync(join(root,s.id),{mode:0o700})
    writeFileSync(path(s,'snapshots.jsonl'),'',{mode:0o600})
    writeFileSync(path(s,'events.jsonl'),'',{mode:0o600})
    sessions.set(s.id,s);current=s;latest=s;seen=new Set();persist(s)
    return s
  }
  const summary=s=>{
    const events=readLines(path(s,'events.jsonl'))
    const unique=new Set(events.filter(e=>e.type==='comment'&&e.viewerId).map(e=>e.viewerId))
    const metrics={}
    for(const definition of LIVE_METRICS) {
      const observed=s.lastFields?.[definition.key]
      metrics[definition.key]={label:definition.label,unit:definition.unit,last:observed?.value??null,lastObservedAt:observed?.at??null,observedPeak:s.peaks[definition.key]?.value??null,peakAt:s.peaks[definition.key]?.at??null}
    }
    const end=s.platformEndedAt||s.endedAt||s.lastObservedAt
    const snapshots=readLines(path(s,'snapshots.jsonl'))
    let onlineSeconds=0,onlineTotal=0
    for(let i=0;i<snapshots.length-1;i++){
      const row=snapshots[i],duration=(snapshots[i+1].at-row.at)/1000,entry=row.fields.onlineUsers
      if(!row.connected||!entry||duration<=0||duration>15||row.at-entry.at>30000)continue
      onlineSeconds+=duration;onlineTotal+=duration*entry.value
    }
    return {version:1,sessionId:s.id,liveId:s.liveId,status:s.endedAt?'ended':'collecting',endReason:s.endReason,
      firstObservedAt:s.firstObservedAt,lastObservedAt:s.lastObservedAt,platformStartedAt:s.startedAt,platformEndedAt:s.platformEndedAt,
      observedDurationSeconds:Math.max(0,(s.lastObservedAt-s.firstObservedAt)/1000),
      platformDurationSeconds:s.startedAt?Math.max(0,(end-s.startedAt)/1000):s.lastFields?.durationSeconds?.value??null,
      observedAverageOnline:onlineSeconds?onlineTotal/onlineSeconds:null,averageOnlineCoverageSeconds:onlineSeconds,
      snapshotCount:s.snapshotCount,eventCount:s.eventCount,commentCount:s.commentCount,uniqueCommenterIds:unique.size,
      metrics,aiRuns:s.aiRuns.map(run=>({...run,durationSeconds:Math.max(0,((run.endedAt||s.lastObservedAt)-run.startedAt)/1000)})),
      limitations:['最高在线、最高热度为采集窗口内观测峰值；平台自带最高在线另列。','累计观看人数只使用后台明确提供的字段，不对在线人数求和。','未采集到的指标为 null；页面用万/亿展示的数值可能经过舍入，原值与来源见时间切片。','断连或后台未返回数据的时间段不补造数据；弹幕统计仅涵盖采集到的消息。','独立评论者 ID 数不是总观众数；监听中途接入无法追溯接入前的时间切片。']}
  }
  const markdown=s=>{
    const data=summary(s)
    const lines=['# 小云直播数据报告','',`- 记录 ID：${s.id}`,`- 平台直播 ID：${s.liveId||'未取得'}`,`- 状态：${data.status==='ended'?'平台直播已结束':'采集中（本次导出为阶段数据）'}`,`- 采集开始：${iso(s.firstObservedAt)}`,`- 最近采集：${iso(s.lastObservedAt)}`,`- 平台开播：${iso(s.startedAt)||'未取得'}`,`- 平台结束：${iso(s.platformEndedAt)||'未取得'}`,`- 已观测时长：${Math.round(data.observedDurationSeconds)} 秒`,`- 平台时长：${data.platformDurationSeconds==null?'未取得':Math.round(data.platformDurationSeconds)+' 秒'}`,`- 时间切片：${s.snapshotCount} 条`,`- 已采集弹幕：${s.commentCount} 条`,`- 独立评论者 ID：${data.uniqueCommenterIds} 个`,'','| 指标 | 最近取得值 | 观测峰值 | 峰值时间（UTC） |','| --- | ---: | ---: | --- |']
    lines.splice(14,0,`- 观测平均在线：${data.observedAverageOnline==null?'未取得':data.observedAverageOnline.toFixed(2)+' 人'}（有效覆盖 '+data.averageOnlineCoverageSeconds+' 秒）`)
    for(const [key,metric]of Object.entries(data.metrics)) {
      if(['startedAtMs','endedAtMs'].includes(key))continue
      lines.push(`| ${metric.label}（${metric.unit||'后台原单位'}） | ${metric.last??'未取得'} | ${metric.observedPeak??'未取得'} | ${iso(metric.peakAt)||'—'} |`)
    }
    lines.push('','## 小云播报区间','')
    if(!data.aiRuns.length)lines.push('未启动小云播报。')
    for(const run of data.aiRuns)lines.push(`- ${iso(run.startedAt)} → ${iso(run.endedAt)||'尚未结束'}，${Math.round(run.durationSeconds)} 秒${run.reason?'，'+run.reason:''}`)
    lines.push('','## 统计口径','',...data.limitations.map(line=>'- '+line),'','逐时刻数值、原始显示值、字段来源和缺失情况见 JSON / CSV 导出。','')
    return lines.join('\n')
  }
  const writeReport=s=>{
    writeFileSync(path(s,'summary.json'),JSON.stringify(summary(s),null,2)+'\n',{mode:0o600})
    writeFileSync(path(s,'report.md'),markdown(s),{mode:0o600})
  }
  const finish=(reason,at=Date.now())=>{
    if(!current)return
    const s=current
    s.endedAt=at;s.endReason=reason
    const run=s.aiRuns.at(-1)
    if(run&&!run.endedAt){run.endedAt=at;run.reason='平台直播结束'}
    persist(s);writeReport(s);latest=s;current=null;seen=new Set()
  }
  const ingest=(body,context={})=>{
    const now=Date.now()
    const incoming=Array.isArray(body.metricsSnapshots)?body.metricsSnapshots.slice(0,60):[]
    for(const input of incoming) {
      const snapshot=normalizeMetricSnapshot(input,now)
      if(!snapshot)continue
      const id=snapshot.liveId
      if(!id&&!Object.keys(snapshot.fields).length&&!current)continue
      if(id&&[...sessions.values()].some(s=>s.liveId===id&&s.endedAt))continue
      if(current&&id&&current.liveId&&current.liveId!==id)finish('检测到新的直播场次',snapshot.at)
      if(!current) {
        if(snapshot.platformState==='ended')continue
        create(id,snapshot.at)
      }
      const s=current
      if(id&&!s.liveId)s.liveId=id
      if(s.latestSnapshot&&snapshot.at<=s.latestSnapshot.at)continue
      if(snapshot.fields.startedAtMs?.value)s.startedAt=snapshot.fields.startedAtMs.value
      if(snapshot.fields.endedAtMs?.value)s.platformEndedAt=snapshot.fields.endedAtMs.value
      const newComments=new Set((Array.isArray(body.events)?body.events:[]).filter(event=>event?.type==='comment'&&event.content&&event.msgId&&!seen.has(String(event.msgId).slice(0,160))&&(Number(event.at)||now)<=snapshot.at&&(!body.liveId||body.liveId===s.liveId)).map(event=>String(event.msgId).slice(0,160)))
      const record={...snapshot,receivedAt:now,connected:body.browserOpen===true,aiStage:String(context.stage||'').slice(0,40),aiRunning:context.running===true,pageNumber:Number(context.pageNumber)||null,pageKey:String(context.pageKey||'').slice(0,2048),commentCount:s.commentCount+newComments.size}
      append(s,'snapshots.jsonl',record)
      s.snapshotCount++;s.latestSnapshot=record;s.lastObservedAt=snapshot.at
      s.lastFields={...s.lastFields,...snapshot.fields}
      for(const [key,entry]of Object.entries(snapshot.fields))if(!s.peaks[key]||entry.value>s.peaks[key].value)s.peaks[key]={value:entry.value,at:entry.at}
      persist(s);latest=s
      if(snapshot.platformState==='ended'){s.platformEndedAt||=snapshot.at;finish('视频号后台报告直播结束',snapshot.at)}
    }
    // Room identity on the snapshot prevents old queued samples being attributed to a new room.
    const bodyId=String(body.liveId||'').slice(0,120)
    if(bodyId&&Array.isArray(body.events)&&body.events.length&&![...sessions.values()].some(s=>s.liveId===bodyId)){
      if(current&&current.liveId&&current.liveId!==bodyId)finish('检测到新的直播场次',now)
      if(!current)create(bodyId,now)
    }
    if(current&&bodyId&&current.liveId&&bodyId!==current.liveId)return
    const target=current||latest
    if(!target||bodyId&&target.liveId&&bodyId!==target.liveId)return
    if(target!==current)seen=new Set(readLines(path(target,'events.jsonl')).filter(e=>e.msgId).map(e=>e.msgId))
    let added=0
    for(const input of (Array.isArray(body.events)?body.events:[]).slice(0,500)) {
      if(!input||!['comment','like','enter','gift'].includes(input.type))continue
      const msgId=String(input.msgId||'').slice(0,160)
      if(!msgId||seen.has(msgId))continue
      const event={type:input.type,msgId,at:Number.isFinite(input.at)&&input.at>0&&input.at<=now+60000?input.at:now,receivedAt:now,nickname:String(input.nickname||'').slice(0,80),viewerId:String(input.viewerId||'').slice(0,120),content:String(input.content||'').slice(0,500)}
      if(input.type==='comment'&&!event.content.trim())continue
      seen.add(msgId);append(target,'events.jsonl',event);target.eventCount++
      added++
      if(input.type==='comment')target.commentCount++
    }
    if(added)persist(target)
    if(added&&target.endedAt)writeReport(target)
  }
  const startAi=()=>{
    const now=Date.now(),s=current||create('',now)
    const last=s.aiRuns.at(-1)
    if(!last||last.endedAt)s.aiRuns.push({startedAt:now,endedAt:null,reason:''})
    persist(s)
  }
  const stopAi=(reason)=>{
    const s=current||latest
    if(!s)return
    const run=s.aiRuns.at(-1)
    if(run&&!run.endedAt){run.endedAt=Date.now();run.reason=String(reason).slice(0,200);persist(s)}
    writeReport(s)
  }
  const status=()=>{
    const s=current||latest
    return {current:s?{id:s.id,liveId:s.liveId,status:s.endedAt?'ended':'collecting',snapshotCount:s.snapshotCount,commentCount:s.commentCount,lastObservedAt:s.lastObservedAt,latestSnapshot:s.latestSnapshot,observedPeaks:s.peaks}:null,
      sessions:[...sessions.values()].sort((a,b)=>b.firstObservedAt-a.firstObservedAt).slice(0,100).map(s=>({id:s.id,liveId:s.liveId,startedAt:s.startedAt||s.firstObservedAt,endedAt:s.endedAt,snapshotCount:s.snapshotCount,commentCount:s.commentCount}))}
  }
  const modelContext=()=>{
    const s=current||latest
    if(!s)return {available:false,reason:'尚未采集到本场直播数据'}
    const snapshot=s.latestSnapshot
    const now=Date.now(),fresh={}
    for(const definition of LIVE_METRICS){const entry=snapshot?.fields[definition.key];if(entry&&now-entry.at<=30000)fresh[definition.label]={value:entry.value,unit:definition.unit,observedAt:iso(entry.at),display:entry.raw,approximate:entry.approximate}}
    return {available:Object.keys(fresh).length>0,sessionId:s.id,platformEnded:Boolean(s.endedAt),snapshotAt:iso(snapshot?.at),metrics:fresh,observedPeakOnline:s.peaks.onlineUsers?.value??null,observedPeakHeat:s.peaks.heat?.value??null,collectedComments:s.commentCount,observedSeconds:Math.max(0,(s.lastObservedAt-s.firstObservedAt)/1000)}
  }
  const exportData=({sessionId,format='json'}={})=>{
    const s=sessionId?sessions.get(String(sessionId)):current||latest
    if(!s||sessionId&&!validId(String(sessionId)))throw new Error('没有可导出的直播记录')
    writeReport(s)
    const name='xiaoyun-live-'+s.id
    if(format==='md')return {filename:name+'.md',mime:'text/markdown; charset=utf-8',body:markdown(s)}
    const snapshots=readLines(path(s,'snapshots.jsonl'))
    if(format==='csv') {
      const headers=['time_utc','received_utc','platform_state','connected','ai_stage','ai_running','page_number','comment_count']
      for(const metric of LIVE_METRICS)headers.push(metric.key,metric.key+'_raw',metric.key+'_observed_utc',metric.key+'_source',metric.key+'_approximate')
      headers.push('additional_api_metrics_json')
      const rows=snapshots.map(row=>{
        const cells=[iso(row.at),iso(row.receivedAt),row.platformState,row.connected,row.aiStage,row.aiRunning,row.pageNumber,row.commentCount]
        for(const metric of LIVE_METRICS){const e=row.fields[metric.key];cells.push(e?.value,e?.raw,iso(e?.at),e?.source,e?.approximate)}
        cells.push(JSON.stringify(row.extra));return cells.map(csvCell).join(',')
      })
      return {filename:name+'.csv',mime:'text/csv; charset=utf-8',body:'\uFEFF'+[headers.map(csvCell).join(','),...rows].join('\r\n')+'\r\n'}
    }
    if(format!=='json')throw new Error('导出格式只能是 json、csv 或 md')
    return {filename:name+'.json',mime:'application/json; charset=utf-8',body:JSON.stringify({summary:summary(s),metricDefinitions:LIVE_METRICS,snapshots,events:readLines(path(s,'events.jsonl'))},null,2)+'\n'}
  }
  const recordLottery=draw=>{
    const s=current||latest
    if(!s)return
    append(s,'events.jsonl',{type:'lottery',at:Date.now(),id:draw.id,keyword:draw.keyword,startedAt:draw.startedAt,deadlineAt:draw.deadlineAt,outcome:draw.outcome,winner:draw.winner,reason:draw.reason})
    s.eventCount++;persist(s)
  }
  return {ingest,startAi,stopAi,status,modelContext,exportData,recordLottery}
}
