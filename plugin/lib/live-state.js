/** Audience-facing stages and the conditions used by the live scheduler. */
export const LIVE_STATES = [
  {id:'idle',label:'准备就绪',description:'设置素材、提示词和播报端，等待开始。'},
  {id:'opening',label:'开场欢迎',description:'欢迎观众，介绍自己和本场主题。'},
  {id:'source',label:'内容讲解',description:'围绕当前主题讲一段完整内容。'},
  {id:'comment',label:'弹幕回应',description:'读取积累的全部新弹幕，回应共同话题或具体观众。'},
  {id:'engagement',label:'互动引导',description:'短暂提问，或邀请点赞、分享，然后回到主线。'},
  {id:'flash-sale',label:'整点秒杀',description:'右上角展示秒杀二维码，讲解、弹幕和翻页正常继续；五分钟后自动收起。'},
  {id:'lottery-announcement',label:'抽奖说明',description:'场控排队的抽奖在当前整段口播结束后开始，说明礼物与弹幕口令。'},
  {id:'lottery-wait',label:'抽奖参与',description:'参与方式播完后开始计时；小云口播互动，同时收集新弹幕。'},
  {id:'lottery-result',label:'开奖播报',description:'参与时间到后，第一条完整匹配口令的新弹幕中奖；播完结果继续主线。'},
  {id:'scheduling',label:'调度下一轮',description:'在整段口播完成后检查结束请求、弹幕、互动和翻页。'},
  {id:'advancing',label:'翻页',description:'等待 Chrome 确认新的页面内容。'},
  {id:'closing',label:'收尾告别',description:'总结本场分享、感谢观众并说再见。'},
  {id:'ended',label:'已结束',description:'停止生成口播，人声与背景音乐停止。'},
  {id:'waiting',label:'等待恢复',description:'等待监听连接、可读取的页面或场控手动翻页。'},
  {id:'error',label:'异常暂停',description:'显示故障，修复后重新开始。'},
]

/** Evaluate transitions in priority order; callers run this only at an audio boundary. */
export function planLiveTurn(s) {
  const quota = s.frequency >= 50 ? 1 : s.frequency >= 20 ? 2 : 3
  const interval = Math.round(90000 - s.frequency * 650)
  const commentDue = s.unreadCount > 0 && (s.sourceFinished || s.sourceSinceComment >= 1 && (s.sourceSinceComment >= quota || s.commentElapsedMs >= interval))
  const rules = [
    {id:'closing',label:'收尾告别',condition:'场控请求结束，或最后一页已讲完；当前整段音频播放完成',ready:s.closingRequested},
    {id:'opening',label:'开场欢迎',condition:'本次直播尚未欢迎观众',ready:s.openingPending},
    {id:'flash-sale',label:'整点秒杀',condition:'指定起止时间范围内按设置间隔定时安排，或场控手动安排；当前整段口播结束后展示右上角二维码',ready:s.flashSale?.queued},
    {id:'lottery-announcement',label:'抽奖说明',condition:'场控已点击开始抽奖；当前整段口播完成，弹幕监听已连接；先于普通弹幕、互动和翻页',ready:s.lottery?.state==='queued'&&s.bridgeReady},
    {id:'lottery-result',label:'开奖播报',condition:'抽奖时间已结束，互动音频完整播放完成，结果已经确定',ready:s.lottery?.state==='result'},
    {id:'lottery-wait',label:'抽奖参与',condition:'抽奖参与方式已完整播报，正在收集指定口令的新弹幕',ready:s.lottery?.state==='waiting'},
    {id:'waiting',label:'等待恢复',condition:'监听连接或当前页面尚未就绪',ready:!s.bridgeReady || !s.pageReady},
    {id:'comment',label:'弹幕回应',condition:`有未读弹幕，且已讲 ${quota} 段或距上次回应 ${Math.round(interval/1000)} 秒；每次回应后回到内容`,ready:commentDue},
    {id:'engagement',label:'互动引导',condition:'AI 已安排互动，且满足讲解段数与互动间隔；弹幕优先',ready:s.engagementPending},
    {id:'advancing',label:'翻页',condition:'AI 已讲完当前页、开启自动翻页，且不是最后一页',ready:s.navigationPending},
    {id:'waiting',label:'等待场控翻页',condition:'当前页已讲完，自动翻页关闭，当前没有待回应弹幕',ready:s.sourceFinished},
    {id:'source',label:'内容讲解',condition:'当前主题还有内容，没有更高优先级的待办',ready:true},
  ]
  const selected = rules.findIndex(rule => rule.ready)
  return {next:rules[selected],rules:rules.map((rule,index)=>({...rule,selected:index===selected,blocked:index>selected}))}
}

/** Project the running stage separately from model generation and audio preparation. */
export function describeLiveState({stage,phase,reason,since,plan,history,unreadCount,sourceSinceComment,sourceTurnsOnPage,engagementTurns,engagementElapsedMs,engagementMinTurns,engagementCooldownSeconds,closingRequested,generation,pageNumber,pageCount}) {
  const current = LIVE_STATES.find(item=>item.id===stage) || LIVE_STATES[0]
  const execution = phase === 'thinking' ? '正在生成口播' : phase === 'awaiting-audio' ? '正在合成 / 播放；等待整段完成' : phase === 'lottery-countdown' ? '互动已播完，等待抽奖时间结束' : phase === 'preparing-audio' ? '下一段文本已就绪，正在完成音频合成' : phase === 'waiting-presentation' ? '等待页面确认' : phase === 'waiting-bridge' ? '等待监听恢复' : phase === 'error' ? '需要处理故障' : phase === 'stopped' ? '未在播报' : '正在检查转移条件'
  const progress = generation && ['thinking','waiting-model'].includes(phase) ? `${phase==='waiting-model'?'等待模型释放':'正在生成口播'} · ${generation.elapsedSeconds}秒 / 最多${generation.timeoutSeconds}秒${generation.label?' · '+generation.label:''}` : execution
  return {current:{...current,since,reason,execution:progress},next:plan.next,transitions:plan.rules,nodes:LIVE_STATES,history,
    metrics:{unreadCount,sourceSinceComment,sourceTurnsOnPage,engagementTurns,engagementElapsedSeconds:Math.floor(engagementElapsedMs/1000),engagementMinTurns,engagementCooldownSeconds,closingRequested,pageNumber,pageCount}}
}
