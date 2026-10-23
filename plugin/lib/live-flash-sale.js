import {randomUUID} from 'node:crypto'
import {readFileSync,writeFileSync,renameSync} from 'node:fs'
import {join} from 'node:path'

export const DEFAULT_FLASH_SALE={enabled:false,intervalMinutes:60,durationSeconds:300,startAt:null,endAt:null,link:'https://github.com/sliverp/xiaoyun-live',qrUrl:'/live-slides/assets/flash-sale-qr.png'}

/** Validate the independent scheduled sale overlay before broadcasting. */
export function validateFlashSale(value={}){
  const c={...DEFAULT_FLASH_SALE,...value}
  if(typeof c.enabled!=='boolean'||!Number.isInteger(c.durationSeconds)||c.durationSeconds<60||c.durationSeconds>900)throw new Error('秒杀展示时间应为1–15分钟')
  if(![5,10,15,30,60].includes(c.intervalMinutes))throw new Error('秒杀间隔应为5、10、15、30或60分钟')
  for(const at of [c.startAt,c.endAt])if(at!==null&&(!Number.isSafeInteger(at)||at<0||!Number.isFinite(new Date(at).getTime())))throw new Error('秒杀开始、结束时间无效')
  if(c.startAt!==null&&c.endAt!==null&&c.endAt<=c.startAt)throw new Error('秒杀结束时间必须晚于开始时间')
  const link=new URL(c.link)
  if(link.protocol!=='https:'||link.username||link.password)throw new Error('秒杀链接必须是 HTTPS 地址')
  if(typeof c.qrUrl!=='string'||!/^\/live-slides\/assets\/[a-zA-Z0-9_.-]+\.png$/.test(c.qrUrl))throw new Error('请选择已部署的秒杀二维码')
  return {enabled:c.enabled,intervalMinutes:c.intervalMinutes,durationSeconds:c.durationSeconds,startAt:c.startAt,endAt:c.endAt,link:link.href,qrUrl:c.qrUrl}
}

/** Persist one claim per scheduled time; sales never consume or reset giveaway prizes. */
export function createFlashSale(rootDir){
  const file=join(rootDir,'live-flash-sale.json')
  let record={version:1,configured:false,config:{...DEFAULT_FLASH_SALE},anchorAt:0,claims:[],current:null,lastReason:''}
  try{record={...record,...JSON.parse(readFileSync(file,'utf8'))}}catch(error){if(error?.code!=='ENOENT')throw error}
  record.config=validateFlashSale(record.config)
  if(record.version!==1||!Array.isArray(record.claims)||record.claims.some(x=>typeof x!=='string')||!Number.isFinite(record.anchorAt))throw new Error('秒杀记录格式无效')
  const persist=()=>{writeFileSync(file+'.tmp',JSON.stringify(record,null,2)+'\n',{mode:0o600});renameSync(file+'.tmp',file)}
  const active=()=>record.current?.state==='displaying'&&Date.now()<record.current.expiresAt
  const pending=()=>record.current?.state==='queued'
  const configure=value=>{if(active()||pending())throw new Error('秒杀展示或排队期间不能修改设置');record.config=validateFlashSale(value);record.configured=true;record.anchorAt=0;persist()}
  const start=()=>{if(!record.anchorAt){record.anchorAt=Date.now();persist()}}
  const request=(reason='场控手动安排',claim='')=>{
    if(active()||pending())throw new Error('秒杀已排队或正在展示')
    if(claim&&record.claims.includes(claim))return false
    if(claim){record.claims.push(claim);record.claims=record.claims.slice(-10000)}
    record.current={id:randomUUID(),state:'queued',queuedAt:Date.now(),startedAt:null,expiresAt:null,reason,automatic:Boolean(claim),announcementDone:false}
    record.lastReason=reason;persist();return true
  }
  const inWindow=at=>(record.config.startAt===null||at>=record.config.startAt)&&(record.config.endAt===null||at<record.config.endAt)
  const interval=()=>record.config.intervalMinutes*60000
  const claimed=at=>record.claims.includes('slot:'+at)||record.claims.includes('hour:'+at)
  const currentSlot=now=>Math.floor(now/interval())*interval()
  const canClaimSlot=(now,at)=>inWindow(now)&&inWindow(at)&&now-at<120000&&at+120000>record.anchorAt&&!claimed(at)
  const nextAt=now=>{
    if(!record.config.enabled||record.config.endAt!==null&&now>=record.config.endAt)return null
    let at=currentSlot(now)
    if(!canClaimSlot(now,at))at+=interval()
    if(record.config.startAt!==null)at=Math.max(at,Math.ceil(record.config.startAt/interval())*interval())
    while(claimed(at))at+=interval()
    return inWindow(at)?at:null
  }
  const cancelExpiredQueue=()=>{
    if(!pending()||!record.current.automatic||inWindow(Date.now()))return false
    record.current.state='cancelled';record.lastReason='不在秒杀时间范围，已取消尚未开始的自动展示';persist();return true
  }
  const evaluate=()=>{
    if(!record.config.enabled||!record.anchorAt||active()||pending())return false
    const now=Date.now(),at=currentSlot(now)
    if(!canClaimSlot(now,at))return false
    const label=new Date(at+8*3600000).toISOString().slice(0,16).replace('T',' ')+'（北京时间）'
    return request(label+'秒杀 · 每'+record.config.intervalMinutes+'分钟','slot:'+at)
  }
  const begin=()=>{
    if(cancelExpiredQueue())return null
    if(!pending())throw new Error('没有待展示的秒杀')
    record.current.state='displaying';record.current.startedAt=Date.now();record.current.expiresAt=Date.now()+record.config.durationSeconds*1000;persist()
    return (record.config.intervalMinutes===60?'整点秒杀':'秒杀')+'时间到啦！想参与的朋友，请扫描屏幕右上角的二维码，查看 Lighthouse 本轮秒杀商品。二维码会保留'+Math.round(record.config.durationSeconds/60)+'分钟，大家可以边听讲解边扫码参与，有问题也欢迎发在弹幕里！'
  }
  const announced=()=>{if(record.current?.state==='displaying'){record.current.announcementDone=true;persist()}}
  const expire=()=>{
    if(cancelExpiredQueue())return true
    if(record.current?.state!=='displaying'||Date.now()<record.current.expiresAt)return false
    record.current.state='completed';record.lastReason='展示结束，已收起二维码；讲解和翻页正常继续';persist();return true
  }
  const cancel=()=>{if(active()||pending()||record.current?.state==='displaying'){record.current.state='cancelled';record.lastReason='场控停止展示';persist()}}
  const status=()=>{
    const now=Date.now(),next=nextAt(now)
    const scheduleState=!record.config.enabled?'disabled':record.config.startAt!==null&&now<record.config.startAt?'waiting':record.config.endAt!==null&&now>=record.config.endAt?'ended':next===null?'complete':'scheduled'
    return {configured:record.configured,config:{...record.config},current:record.current?{...record.current}:null,active:active(),queued:pending(),remainingSeconds:active()?Math.ceil((record.current.expiresAt-now)/1000):0,nextAt:next,scheduleState,serverAt:now,lastReason:record.lastReason,timezone:'Asia/Shanghai'}
  }
  return {configure,start,request,evaluate,begin,announced,expire,cancel,active,pending,status}
}
