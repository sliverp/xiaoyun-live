export const isLiveMessageResponse = address => {
  try {
    const url = new URL(address)
    return url.hostname === 'channels.weixin.qq.com' && url.pathname.includes('/mmfinderassistant-bin/live/msg')
  } catch { return false }
}

export const extractLiveMessage = (request, response) => {
  const data = response?.data
  if (!data || typeof data !== 'object') return null
  const liveId = String(data.liveInfo?.liveId || request?.liveId || request?.live_id || '').slice(0, 120)
  const liveStatus = String(data.liveInfo?.liveStatus || data.liveInfo?.status || '').slice(0, 60)
  const events = Array.isArray(data.msgList) ? data.msgList.flatMap(item => {
    if (item?.type !== 1) return []
    const msgId = String(item.clientMsgId || '').slice(0, 160)
    const nickname = String(item.nickname || '').trim().slice(0, 80)
    const content = String(item.content || '').trim().slice(0, 500)
    if (!msgId || !nickname || !content) return []
    return [{ type: 'comment', msgId, nickname, content, viewerId: String(item.username || '').slice(0, 120) }]
  }) : []
  for (const item of Array.isArray(data.msgList)?data.msgList:[]) {
    if(item?.type!==10005||!item.clientMsgId)continue
    events.push({type:'enter',msgId:String(item.clientMsgId).slice(0,160),nickname:String(item.nickname||'').slice(0,80),content:'',viewerId:String(item.username||'').slice(0,120)})
  }
  for (const item of Array.isArray(data.appMsgList)?data.appMsgList:[]) {
    if(![20006,20009,20013].includes(item?.msgType)||!item.clientMsgId)continue
    const contact=item.fromUserContact?.contact
    events.push({type:item.msgType===20006?'like':'gift',msgId:String(item.clientMsgId).slice(0,160),nickname:String(contact?.nickname||'').slice(0,80),content:'',viewerId:String(contact?.username||'').slice(0,120)})
  }
  return { liveId, liveStatus, events }
}
