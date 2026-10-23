import {randomUUID} from 'node:crypto'
import {readFileSync,writeFileSync,renameSync} from 'node:fs'
import {join} from 'node:path'

const activeStates=new Set(['queued','announcing','waiting','result'])

/** A queued giveaway selects the first matching comment received inside its timed window. */
export function createLiveLottery({rootDir}) {
  const file=join(rootDir,'live-lottery.json')
  let record={version:1,config:{keyword:'小云送大礼',waitSeconds:10,prizes:['一件文化衫','一个马年公仔']},drawsUsed:0,current:null,history:[]}
  let firstMatch=null
  const persist=()=>{writeFileSync(file+'.tmp',JSON.stringify(record,null,2)+'\n',{mode:0o600});renameSync(file+'.tmp',file)}
  try {
    const loaded=JSON.parse(readFileSync(file,'utf8'))
    record={...record,...loaded,config:{...record.config,...loaded.config}}
    if(record.version!==1||!Array.isArray(record.history))throw new Error('抽奖记录格式无效')
    if(activeStates.has(record.current?.state)){
      record.current.interruptedFrom=record.current.state;record.current.state='interrupted';record.current.reason='服务重启，本轮不自动重抽；已选出的中奖者保留';record.current.completedAt=Date.now();persist()
    }
  }catch(error){if(error?.code!=='ENOENT')throw error}
  const archiveCurrent=()=>{
    if(!record.current)return
    record.history.push(record.current)
    const recentEmpty=new Set(record.history.filter(item=>!item.winner).slice(-50).map(item=>item.id))
    record.history=record.history.filter(item=>item.winner||recentEmpty.has(item.id))
  }
  const isActive=()=>activeStates.has(record.current?.state)
  const status=()=>({config:{...record.config},drawsUsed:record.drawsUsed,drawsTotal:record.config.prizes.length,nextPrize:record.config.prizes[record.drawsUsed]||null,current:record.current?{...record.current,winner:record.current.winner?{...record.current.winner}:null}:null,remainingSeconds:record.current?.state==='waiting'?Math.max(0,Math.ceil((record.current.deadlineAt-(record.current.pausedAt??Date.now()))/1000)):0,history:record.history.slice(-10)})
  const request=({keyword=record.config.keyword,waitSeconds=record.config.waitSeconds}={})=>{
    if(isActive())throw new Error('已有一轮抽奖排队或进行中，请等待本轮结束')
    if(record.drawsUsed>=record.config.prizes.length)throw new Error('奖品池已发完，不能继续抽奖')
    if(typeof keyword!=='string'||!keyword.trim()||keyword.trim().length>60||/[\r\n]/.test(keyword))throw new Error('抽奖口令应为1–60字的单行文字')
    if(!Number.isInteger(waitSeconds)||waitSeconds<5||waitSeconds>60)throw new Error('抽奖参与时间应为5–60秒')
    archiveCurrent()
    record.config={...record.config,keyword:keyword.trim(),waitSeconds};firstMatch=null
    record.current={id:randomUUID(),state:'queued',keyword:keyword.trim(),waitSeconds,prize:record.config.prizes[record.drawsUsed],roundNumber:record.drawsUsed+1,queuedAt:Date.now(),liveId:'',startedAt:null,deadlineAt:null,startSerial:null,outcome:null,winner:null,completedAt:null,reason:''}
    persist();return status()
  }
  const validatePool=prizes=>{
    if(!Array.isArray(prizes)||!prizes.length||prizes.length>500||prizes.some(prize=>typeof prize!=='string'||!prize.trim()||prize.length>80||/[\r\n]/.test(prize)))throw new Error('奖品池应为1–500份奖品，每份1–80字')
    const next=prizes.map(prize=>prize.trim())
    if(next.length<record.drawsUsed||next.slice(0,record.drawsUsed).some((prize,index)=>prize!==record.config.prizes[index]))throw new Error('已发出的奖品必须保留原顺序；只能调整未发部分或追加奖品')
    if(isActive())throw new Error('抽奖进行中，不能调整奖品池')
    return next
  }
  const configurePool=prizes=>{record.config.prizes=validatePool(prizes);persist()}
  const begin=liveId=>{
    const item=record.current
    if(item?.state!=='queued')throw new Error('当前没有待开始的抽奖')
    item.state='announcing';item.liveId=liveId;persist()
    return `直播间的朋友，福利来啦！现在是本场第${item.roundNumber}次口令抽奖，小云要送出${item.prize}！参与方式很简单：在弹幕区完整输入“${item.keyword}”。听完这段介绍，就开始${item.waitSeconds}秒参与时间，第一位被我收到、完整匹配口令的朋友中奖。准备好了吗？`
  }
  const openWindow=serial=>{
    const item=record.current
    if(item?.state!=='announcing')throw new Error('抽奖参与方式尚未播报完成')
    item.state='waiting';item.startedAt=Date.now();item.deadlineAt=item.startedAt+item.waitSeconds*1000;item.startSerial=serial;persist()
    return '现在开始啦！大家把口令发到弹幕里，小云正在认真看。看看哪位朋友最先完成，祝大家好运！'
  }
  const settle=({comments,liveId,bridgeReady})=>{
    const item=record.current
    if(item?.state!=='waiting'||item.pausedAt!=null||Date.now()<item.deadlineAt)return false
    item.state='result'
    if(!bridgeReady||item.liveId&&liveId!==item.liveId){item.outcome='cancelled';item.reason='弹幕监听断开或直播间发生变化，本轮不判定中奖者'}
    else {
      const eligible=[...(firstMatch?[firstMatch]:[]),...comments].filter(comment=>comment.serial>item.startSerial&&comment.at>=item.startedAt&&comment.at<=item.deadlineAt&&comment.content.trim()===item.keyword)
      const first=eligible.reduce((first,comment)=>!first||comment.serial<first.serial?comment:first,null)
      item.outcome=first?'winner':'empty'
      if(first){item.winner={nickname:first.nickname,viewerId:first.viewerId,msgId:first.msgId,serial:first.serial,content:first.content,at:first.at};record.drawsUsed+=1}
    }
    persist();return true
  }
  const resultSpeech=()=>{
    const item=record.current
    if(item?.state!=='result')throw new Error('抽奖结果尚未确定')
    if(item.outcome==='winner')return `恭喜${item.winner.nickname}，获得${item.prize||'本轮礼物'}！请扫描屏幕右下方的用户交流群二维码，加入社群后联系工作人员领取奖励。`
    if(item.outcome==='cancelled')return '刚才弹幕监听没有保持正常，这轮抽奖先取消，不判定中奖者。连接恢复后，可以重新参与这轮口令抽奖。'
    return `参与时间到了，这轮没有收到完整匹配“${item.keyword}”的弹幕，暂时没有中奖者。我们先继续分享。`
  }
  const complete=()=>{if(record.current?.state==='result'){record.current.state='completed';record.current.completedAt=Date.now();persist()}}
  const pause=()=>{const item=record.current;if(item?.state==='waiting'&&item.pausedAt==null){item.pausedAt=Date.now();persist()}}
  const resume=()=>{const item=record.current;if(item?.state==='waiting'&&item.pausedAt!=null){item.deadlineAt+=Date.now()-item.pausedAt;item.pausedAt=null;persist()}}
  const reset=()=>{if(record.current){archiveCurrent();record.current=null}record.drawsUsed=0;firstMatch=null;persist()}
  const observeComment=(comment,liveId)=>{
    const item=record.current
    if(item?.state!=='waiting'||item.liveId&&item.liveId!==liveId||firstMatch)return
    if(comment.serial>item.startSerial&&comment.at>=item.startedAt&&(item.pausedAt!=null||comment.at<=item.deadlineAt)&&comment.content.trim()===item.keyword)firstMatch={...comment}
  }
  const cancel=reason=>{
    if(!isActive())return
    record.current.interruptedFrom=record.current.state;record.current.state=record.current.winner?'interrupted':'cancelled';record.current.reason=reason;record.current.completedAt=Date.now();persist()
  }
  const prepareRecovery=reason=>{
    const item=record.current
    if(!item||item.state==='completed'||item.state==='queued'||item.state==='result')return
    if(item.state==='interrupted'&&item.interruptedFrom==='result'&&item.winner){item.state='result';item.reason='自动恢复后重播已确定的结果，不重新抽取';persist();return}
    if(item.state==='announcing'||item.state==='interrupted'&&['queued','announcing'].includes(item.interruptedFrom)){item.state='queued';persist();return}
    cancel(reason)
  }
  return {status,isActive,request,begin,openWindow,settle,resultSpeech,complete,cancel,pause,resume,reset,observeComment,validatePool,configurePool,prepareRecovery}
}
