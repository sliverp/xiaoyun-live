/** Metrics read from the signed-in video-channel backend, with their original labels. */
export const LIVE_METRICS = [
  { key:'onlineUsers', label:'在线人数', unit:'人', api:['onlineCnt','onlineCount'], labels:['在线人数','当前在线人数','当前在线','实时在线人数','实时在线'] },
  { key:'peakOnlineUsers', label:'平台最高在线人数', unit:'人', api:['maxOnlineCnt','peakOnlineCnt','maxOnlineCount'], labels:['最高在线人数','最高在线','峰值在线人数'] },
  { key:'heat', label:'热度', unit:'', api:['heat','heatValue','hotValue','hotCnt'], labels:['直播热度','热度','人气值'] },
  { key:'totalViewers', label:'累计观看人数', unit:'人', api:['totalViewerCnt','totalAudienceCnt','totalWatchUserCnt'], labels:['累计观看人数','累计观众','累计观看','观看人数','观看总人数'] },
  { key:'views', label:'观看次数', unit:'次', api:['watchCnt','viewCnt','totalViewCnt'], labels:['观看次数','观看人次','累计观看人次'] },
  { key:'likes', label:'点赞次数', unit:'次', api:['likeCnt','likeCount'], labels:['点赞总数','点赞次数','点赞数','点赞'] },
  { key:'shares', label:'分享次数', unit:'次', api:['shareCnt','shareCount'], labels:['分享次数','分享数','转发次数'] },
  { key:'newFollowers', label:'新增关注人数', unit:'人', api:['newFollowCnt','newFansCnt'], labels:['新增关注人数','新增关注','新增粉丝','新增关注者'] },
  { key:'giftCoins', label:'礼物金额', unit:'微信币', api:['rewardTotalAmountInWecoin'], labels:['礼物收入（微信币）','礼物收入(微信币)','微信币收入'] },
  { key:'durationSeconds', label:'平台直播时长', unit:'秒', api:['durationSeconds','liveDurationSeconds'], labels:['直播时长','开播时长'] },
  { key:'startedAtMs', label:'平台开播时间', unit:'毫秒时间戳', api:['startTime'], labels:[] },
  { key:'endedAtMs', label:'平台结束时间', unit:'毫秒时间戳', api:['endTime'], labels:[] },
]

/** Parse displayed rounded counts without converting unavailable values to zero. */
export function parseMetricValue(input, key) {
  if (input === null || input === undefined || input === '') return null
  if (typeof input !== 'number' && typeof input !== 'string') return null
  const raw=String(input).trim()
  if (!raw || /^(--?|—|暂无|未开播|加载中|null|undefined)$/i.test(raw)) return null
  if (key==='durationSeconds') {
    const clock=raw.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/)
    if (clock) return Number(clock[3])<60&&(!clock[1]||Number(clock[2])<60)?Number(clock[1]||0)*3600+Number(clock[2])*60+Number(clock[3]):null
    const duration=raw.match(/^(?:(\d+)\s*小时)?\s*(?:(\d+)\s*分(?:钟)?)?\s*(?:(\d+)\s*秒)?$/)
    if (duration && duration.slice(1).some(Boolean)) return Number(duration[1]||0)*3600+Number(duration[2]||0)*60+Number(duration[3]||0)
  }
  const match=raw.replaceAll(',','').match(/^([0-9]+(?:\.[0-9]+)?)\s*(万|亿|[kKwWmM])?\s*(?:人|次|个|秒|微信币)?$/)
  if (!match) return null
  const factor={万:10000,亿:100000000,k:1000,K:1000,w:10000,W:10000,m:1000000,M:1000000}[match[2]]||1
  let value=Number(match[1])*factor
  if ((key==='startedAtMs'||key==='endedAtMs') && value>0 && value<1e12) value*=1000
  return Number.isFinite(value)&&value>=0&&value<=Number.MAX_SAFE_INTEGER?value:null
}

/** Keep only finite metric values and bounded provenance at the ingest wire. */
export function normalizeMetricSnapshot(input, now=Date.now()) {
  if (!input || typeof input!=='object' || Array.isArray(input)) return null
  const at=Number(input.at)
  if (!Number.isFinite(at)||at<=0||at>now+60000) return null
  const fields={}
  for (const metric of LIVE_METRICS) {
    const entry=input.fields?.[metric.key]
    if (!entry || typeof entry!=='object') continue
    const value=parseMetricValue(entry.value,metric.key)
    const observedAt=Number(entry.at)
    if (value===null||!Number.isFinite(observedAt)||observedAt<=0||observedAt>at+60000) continue
    fields[metric.key]={value,raw:String(entry.raw??entry.value).slice(0,80),at:observedAt,source:entry.source==='api'?'api':'dom',path:String(entry.path||'').slice(0,160),approximate:entry.approximate===true}
  }
  const extra={}
  for (const [path,entry] of Object.entries(input.extra||{}).slice(0,80)) {
    if (!/^data\.[a-zA-Z0-9_.]{1,150}$/.test(path)||/token|cookie|openid|username|session|auth|key|uin/i.test(path)) continue
    if (!entry||typeof entry!=='object') continue
    const value=parseMetricValue(entry.value)
    if (value===null) continue
    extra[path]={value,raw:String(entry.raw??entry.value).slice(0,80),at:at,source:'api',path}
  }
  return {at,fields,extra,liveId:String(input.liveId||'').slice(0,120),platformState:['live','ended','unknown'].includes(input.platformState)?input.platformState:'unknown'}
}
