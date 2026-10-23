import {LIVE_METRICS,parseMetricValue} from '../plugin/lib/live-metrics.js'

/** Observe only backend live API responses, never request headers or login responses. */
export function isLiveDataResponse(address) {
  try { const url=new URL(address);return url.hostname==='channels.weixin.qq.com'&&url.pathname.includes('/mmfinderassistant-bin/live/') } catch { return false }
}

/** Extract numeric live counters; unknown numeric counter names remain labelled by source path. */
export function extractLiveMetrics(response,at=Date.now()) {
  const data=response?.data
  if (!data||typeof data!=='object') return null
  const info=data.liveInfo
  const roots=[['data',data],['data.liveInfo',info],['data.statistics',data.statistics],['data.liveStats',data.liveStats],['data.liveStatistics',data.liveStatistics]]
  const fields={},extra={}
  for (const [prefix,root] of roots) {
    if (!root||typeof root!=='object'||Array.isArray(root)) continue
    for (const metric of LIVE_METRICS) for (const name of metric.api) {
      const value=parseMetricValue(root[name],metric.key)
      if(value===null)continue
      fields[metric.key]={value,raw:String(root[name]),at,source:'api',path:prefix+'.'+name,approximate:false}
      break
    }
    const walk=(object,path,depth)=>{
      if(depth>3||!object||typeof object!=='object'||Array.isArray(object))return
      for(const [name,value]of Object.entries(object)){
        if(/token|cookie|openid|username|nickname|session|auth|key|uin|url|content/i.test(name))continue
        if(value&&typeof value==='object'){walk(value,path+'.'+name,depth+1);continue}
        if(!/(?:Cnt|Count|Num|heat|hot|duration|time|amount)/i.test(name))continue
        const parsed=parseMetricValue(value)
        if(parsed!==null&&Object.keys(extra).length<80)extra[path+'.'+name]={value:parsed,raw:String(value),at,source:'api',path:path+'.'+name}
      }
    }
    walk(root,prefix,0)
  }
  const state=String(info?.liveStatus??info?.status??data.liveStatus??'')
  return {at,fields,extra,liveId:String(info?.liveId||data.liveId||'').slice(0,120),platformState:state==='1'?'live':state==='2'?'ended':'unknown',stateSource:'api'}
}

/** Match visible metric labels and their adjacent values; unrelated numbers are ignored. */
export function extractDomMetrics(rows,at=Date.now()) {
  const fields={}
  const tiles=rows.filter(value=>value&&typeof value==='object')
  const lines=rows.filter(value=>typeof value==='string').map(value=>value.trim()).filter(Boolean)
  for (const metric of LIVE_METRICS) for (const label of metric.labels) {
    const tile=tiles.find(tile=>tile.label===label)
    if(tile){
      const value=parseMetricValue(tile.value,metric.key)
      if(value!==null){fields[metric.key]={value,raw:String(tile.value),at,source:'dom',path:label,approximate:/[万亿kKwWmM]/.test(String(tile.value))};break}
    }
    const index=lines.findIndex(line=>line===label||line.startsWith(label+'：')||line.startsWith(label+':'))
    if(index<0)continue
    const line=lines[index]
    const candidate=line===label?lines[index+1]:line.slice(label.length).replace(/^[:：]\s*/,'')
    let value=parseMetricValue(candidate,metric.key)
    // Some data tiles place the value immediately above their label.
    const raw=value===null?lines[index-1]:candidate
    if(value===null)value=parseMetricValue(raw,metric.key)
    if(value===null)continue
    fields[metric.key]={value,raw:String(raw),at,source:'dom',path:label,approximate:/[万亿kKwWmM]/.test(String(raw))}
    break
  }
  return {at,fields,extra:{},liveId:'',platformState:lines.some(line=>/^(直播已结束|本场直播已结束|直播结束)$/.test(line))?'ended':'unknown',stateSource:'dom'}
}

/** Runs inside the backend page: read metric tiles, excluding viewer-message containers. */
export function readBackendMetricTiles(labels) {
  const result=[]
  const allLabels=new Set(labels)
  const visible=element=>{const style=getComputedStyle(element);return style.display!=='none'&&style.visibility!=='hidden'&&element.getClientRects().length>0}
  for(const element of document.querySelectorAll('span,div,p,dt,dd,th,td,strong,label,h1,h2,h3,h4,h5')) {
    if(element.children.length||!visible(element))continue
    if(element.closest('[class*="comment"],[class*="chat"],[class*="message"],[role="log"],input,textarea'))continue
    const text=element.textContent.trim()
    const inline=labels.find(label=>text.startsWith(label+'：')||text.startsWith(label+':'))
    if(inline){result.push({label:inline,value:text.slice(inline.length).replace(/^[:：]\s*/,'')});continue}
    const label=text
    if(!allLabels.has(label))continue
    let parent=element.parentElement
    for(let level=0;parent&&level<4;level++,parent=parent.parentElement){
      const walker=document.createTreeWalker(parent,NodeFilter.SHOW_TEXT),lines=[]
      while(walker.nextNode()){
        const node=walker.currentNode,value=node.textContent.trim()
        if(value&&node.parentElement&&visible(node.parentElement))lines.push(value)
      }
      const labelCount=lines.filter(line=>allLabels.has(line)).length
      if(labelCount>1)break
      const values=lines.filter(line=>!allLabels.has(line)&&/^[0-9]/.test(line)&&line.length<80)
      if(labelCount===1&&values.length===1){result.push({label,value:values[0]});break}
    }
  }
  // Only explicit platform status text can mark a live session as ended.
  for(const element of document.querySelectorAll('span,strong,h1,h2,h3'))if(element.children.length===0&&visible(element)&&!element.closest('[class*="comment"],[class*="chat"],[class*="message"],[role="log"]')&&/^(直播已结束|本场直播已结束|直播结束)$/.test(element.textContent.trim()))result.push(element.textContent.trim())
  return result
}

/** Retain independently timestamped counters and clear them when the room changes. */
export function createMetricCollector({freshMs=30000}={}) {
  let liveId='',platformState='unknown',stateAt=0,stateSource=''
  let fields={},extra={}
  const update=snapshot=>{
    if(!snapshot)return
    if(snapshot.liveId&&liveId&&snapshot.liveId!==liveId){fields={};extra={};platformState='unknown';stateAt=0;stateSource=''}
    if(snapshot.liveId)liveId=snapshot.liveId
    if(snapshot.platformState!=='unknown'&&!(stateSource==='api'&&snapshot.stateSource==='dom'&&snapshot.at-stateAt<freshMs)){platformState=snapshot.platformState;stateAt=snapshot.at;stateSource=snapshot.stateSource}
    for(const [key,entry]of Object.entries(snapshot.fields)){
      const current=fields[key]
      if(current&&current.source==='api'&&entry.source==='dom'&&entry.at-current.at<freshMs)continue
      fields[key]=entry
    }
    extra={...extra,...snapshot.extra}
  }
  const snapshot=(at=Date.now())=>({at,liveId,platformState,
    fields:Object.fromEntries(Object.entries(fields).filter(([,entry])=>at-entry.at<=freshMs)),
    extra:Object.fromEntries(Object.entries(extra).filter(([,entry])=>at-entry.at<=freshMs))})
  return {update,snapshot}
}
