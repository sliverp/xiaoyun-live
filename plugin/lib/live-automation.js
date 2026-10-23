import {readFileSync,writeFileSync,renameSync} from 'node:fs'
import {join} from 'node:path'

export const DEFAULT_LOTTERY_SCHEDULE={enabled:false,fixedTimes:[],intervalMinutes:0,metric:'heat',threshold:0}

/** Parse pre-live giveaway rules; fixed times use Asia/Shanghai every day. */
export function validateLotterySchedule(value={}){
  const config={...DEFAULT_LOTTERY_SCHEDULE,...value}
  if(typeof config.enabled!=='boolean'||!Array.isArray(config.fixedTimes)||config.fixedTimes.length>24||config.fixedTimes.some(time=>typeof time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)))throw new Error('定时抽奖请填写24小时制时间，例如19:30，最多24个')
  if(!Number.isInteger(config.intervalMinutes)||config.intervalMinutes<0||config.intervalMinutes>1440||!['heat','onlineUsers'].includes(config.metric)||!Number.isSafeInteger(config.threshold)||config.threshold<0)throw new Error('抽奖间隔应为0–1440分钟，人气阈值应为非负整数')
  config.fixedTimes=[...new Set(config.fixedTimes)].sort()
  if(config.enabled&&!config.fixedTimes.length&&!config.intervalMinutes&&!config.threshold)throw new Error('请至少设置一种自动抽奖条件')
  return {enabled:config.enabled,fixedTimes:config.fixedTimes,intervalMinutes:config.intervalMinutes,metric:config.metric,threshold:config.threshold}
}

/** Persist trigger claims before queuing a giveaway, so reconnects cannot award it twice. */
export function createLotterySchedule(rootDir){
  const file=join(rootDir,'live-lottery-schedule.json')
  let record={config:{...DEFAULT_LOTTERY_SCHEDULE},anchorAt:0,claims:[],pending:[],lastReason:''}
  const persist=()=>{writeFileSync(file+'.tmp',JSON.stringify(record,null,2)+'\n',{mode:0o600});renameSync(file+'.tmp',file)}
  try{record={...record,...JSON.parse(readFileSync(file,'utf8'))};record.config=validateLotterySchedule(record.config);if(!Array.isArray(record.claims)||record.claims.some(id=>typeof id!=='string')||!Number.isFinite(record.anchorAt)||record.anchorAt<0)throw new Error('自动抽奖记录格式无效')}catch(error){if(error?.code!=='ENOENT')throw error}
  const configure=value=>{const config=validateLotterySchedule(value);if(JSON.stringify(config)!==JSON.stringify(record.config)){record.config=config;record.anchorAt=0;record.pending=[]}persist()}
  const start=()=>{if(!record.anchorAt){record.anchorAt=Date.now();persist()}}
  const due=()=>{
    const c=record.config,now=Date.now(),slots=[]
    if(!c.enabled||!record.anchorAt)return slots
    const date=new Date(now+8*3600000).toISOString().slice(0,10)
    for(const time of c.fixedTimes){const at=Date.parse(date+'T'+time+':00+08:00');if(at>=record.anchorAt&&now>=at&&now-at<120000)slots.push({id:'time:'+date+':'+time,label:'指定时间 '+time})}
    if(c.intervalMinutes){const period=c.intervalMinutes*60000,number=Math.floor((now-record.anchorAt)/period);if(number>0)slots.push({id:'interval:'+record.anchorAt+':'+c.intervalMinutes+':'+number,label:'每'+c.intervalMinutes+'分钟抽奖'})}
    return slots
  }
  const evaluate=({snapshot,active,remaining})=>{
    if(!record.config.enabled||!record.anchorAt)return null
    const slots=due(),c=record.config,field=snapshot?.fields?.[c.metric]
    if(c.threshold&&field&&Number.isFinite(field.value)&&Date.now()-field.at>=0&&Date.now()-field.at<=30000&&field.value>=c.threshold)slots.push({id:'metric:'+record.anchorAt+':'+c.metric+':'+c.threshold,label:(c.metric==='heat'?'热度':'在线人数')+'达到'+c.threshold})
    let candidates=[...new Map([...record.pending,...slots].filter(slot=>!record.claims.includes(slot.id)).map(slot=>[slot.id,slot])).values()]
    const newestInterval=candidates.filter(slot=>slot.id.startsWith('interval:')).at(-1)
    candidates=candidates.filter(slot=>!slot.id.startsWith('interval:')||slot===newestInterval)
    if(!candidates.length)return null
    if(active){
      if(JSON.stringify(record.pending)!==JSON.stringify(candidates)){record.pending=candidates;record.lastReason='条件已记录，等待当前抽奖完成';persist()}
      return null
    }
    const reason=candidates.map(slot=>slot.label).join('、')
    record.pending=[]
    record.claims.push(...candidates.map(slot=>slot.id));record.claims=record.claims.slice(-10000)
    record.lastReason=remaining?'已排队：'+reason:'奖品已发完，跳过：'+reason;persist()
    return remaining?reason:null
  }
  const status=()=>({config:{...record.config},anchorAt:record.anchorAt,nextIntervalAt:record.anchorAt&&record.config.intervalMinutes?record.anchorAt+(Math.floor((Date.now()-record.anchorAt)/(record.config.intervalMinutes*60000))+1)*record.config.intervalMinutes*60000:null,lastReason:record.lastReason,pendingCount:record.pending.length,claimedCount:record.claims.length,timezone:'Asia/Shanghai'})
  return {configure,start,evaluate,status}
}
