/** Bounded route selection with a cooldown before retrying failed providers. */
export function createGenerationFailover({fallbacks=[],cooldownMs=300000,primaryTimeoutMs=10000,timeoutMs=30000}={}) {
  if (!Array.isArray(fallbacks) || fallbacks.length>4 || fallbacks.some(route=>!route||typeof route.provider!=='string'||!route.provider.trim()||typeof route.model!=='string'||!route.model.trim()||typeof route.label!=='string'||!route.label.trim())) throw new Error('直播备用模型配置无效')
  if (!Number.isInteger(cooldownMs)||cooldownMs<1000||cooldownMs>3600000) throw new Error('模型恢复探测间隔应为1000–3600000毫秒')
  if (!Number.isInteger(primaryTimeoutMs)||primaryTimeoutMs<1000||primaryTimeoutMs>120000) throw new Error('主模型生成时限无效')
  const routes=[null,...fallbacks.map(route=>({...route}))],retryAt=new Map()
  let preferred=0,lastFailure='',switchedAt=0
  const attempt=(index,tried=[])=>({index,tried:[...tried,index],route:routes[index],timeoutMs:index===0&&fallbacks.length?primaryTimeoutMs:timeoutMs})
  return {
    begin(){
      const index=Date.now()>=(retryAt.get(0)||0)?0:Date.now()>=(retryAt.get(preferred)||0)?preferred:routes.findIndex((_,i)=>Date.now()>=(retryAt.get(i)||0))
      return attempt(index<0?0:index)
    },
    next(current,cause){
      lastFailure=String(cause?.message||cause).slice(0,200)
      retryAt.set(current.index,Date.now()+cooldownMs)
      const index=routes.findIndex((_,i)=>!current.tried.includes(i)&&Date.now()>=(retryAt.get(i)||0))
      if(index<0)return null
      preferred=index;switchedAt=Date.now()
      return attempt(index,current.tried)
    },
    success(current){preferred=current.index;retryAt.delete(current.index)},
    status(current){
      const index=current?.index??preferred
      return {index,label:routes[index]?.label||'DeepSeek 主通道',provider:routes[index]?.provider||null,model:routes[index]?.model||null,fallbackActive:index>0,attempt:current?.tried.length||0,routeCount:routes.length,lastFailure,switchedAt,primaryRetryAt:retryAt.get(0)||0}
    },
  }
}
