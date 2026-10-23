import puppeteer from 'puppeteer-core'
import { readFileSync, mkdirSync, writeFileSync, renameSync, existsSync, unlinkSync } from 'node:fs'
import { writeFile, unlink } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { randomUUID, createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { isLiveMessageResponse, extractLiveMessage } from './parser.mjs'
import { isLiveDataResponse, extractLiveMetrics, extractDomMetrics, createMetricCollector, readBackendMetricTiles } from './metrics.mjs'
import {LIVE_METRICS} from '../plugin/lib/live-metrics.js'

const here = dirname(fileURLToPath(import.meta.url))
const config = JSON.parse(readFileSync(resolve(here, 'config.json'), 'utf8'))
const metricsIntervalMs=config.metricsIntervalMs??5000
if(!Number.isInteger(metricsIntervalMs)||metricsIntervalMs<1000||metricsIntervalMs>60000)throw new Error('直播数据采样间隔必须为 1000–60000 毫秒')
const metrics=createMetricCollector()
const metricsOutbox=resolve(here,'metrics-outbox.json')
let pendingMetrics=[]
try { pendingMetrics=JSON.parse(readFileSync(metricsOutbox,'utf8'));if(!Array.isArray(pendingMetrics))throw new Error('直播数据待发送队列无效') }catch(error){if(error?.code!=='ENOENT')throw error}
let lastMetricsAt=pendingMetrics.at(-1)?.at||0
const saveMetricsOutbox=()=>{writeFileSync(metricsOutbox+'.tmp',JSON.stringify(pendingMetrics)+'\n',{mode:0o600});renameSync(metricsOutbox+'.tmp',metricsOutbox)}
const endpoint = new URL(config.endpoint)
if (endpoint.protocol !== 'https:') throw new Error('弹幕接收地址必须使用 HTTPS')
if (!config.ingestToken || !/^[a-zA-Z0-9_-]{20,}$/.test(config.ingestToken)) throw new Error('缺少弹幕接收密钥')
const profile = resolve(here, 'chrome-profile')
const execFileAsync = promisify(execFile)
const ocrTool = resolve(here, 'ocr-tool')
let lastImageHash = ''
let lastOcrText = ''
mkdirSync(profile, { recursive: true, mode: 0o700 })

const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
let browser = null
let page = null
let activePage = null
let presentationPage = null
let presentationAck = ''
let presentationState = { open:false, url:'', title:'', visibleText:'', pageKey:'', capturedAt:0, method:'' }
const attachedPages = new WeakSet()
let queued = []
let sending = false
let latestLiveId = ''
let latestStatus = ''
let captureAt = 0
let lastLogAt = 0
let loginAck = ''
let openingLogin = false
const pagePath = () => { try { return page ? new URL(page.url()).pathname : '' } catch { return '' } }
const browserOpen = () => Boolean(browser?.connected && page && !page.isClosed())

async function ensureBrowser() {
  if (browser?.connected && page && !page.isClosed()) return page
  const processes = await execFileAsync('/bin/ps',['-axo','command='])
  const existing = processes.stdout.split('\n').some(command=>command.startsWith(chrome+' ')&&command.includes('--user-data-dir='+profile)&&!command.includes('--type='))
  if (existing) {
    const [port,path]=readFileSync(resolve(profile,'DevToolsActivePort'),'utf8').trim().split('\n')
    if(!/^\d+$/.test(port)||!/^\/devtools\/browser\/[a-zA-Z0-9-]+$/.test(path))throw new Error('专用 Chrome 的连接信息无效，请关闭专用窗口后重新连接')
    browser=await puppeteer.connect({browserWSEndpoint:`ws://127.0.0.1:${port}${path}`,defaultViewport:null})
  } else browser = await puppeteer.launch({ executablePath: chrome, userDataDir: profile, headless:false, defaultViewport:null, handleSIGINT:false, handleSIGTERM:false, handleSIGHUP:false, args:['--restore-last-session','--window-size=1200,900','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'] })
  const openedPages = await browser.pages()
  page = openedPages.find(item => { try { return new URL(item.url()).hostname === 'channels.weixin.qq.com' } catch { return false } }) || openedPages[0] || await browser.newPage()
  activePage = page
  presentationPage=openedPages.find(item=>{try{const url=new URL(item.url());return ['http:','https:'].includes(url.protocol)&&url.hostname!=='channels.weixin.qq.com'}catch{return false}})||null
  for (const openedPage of await browser.pages()) attachPage(openedPage)
  browser.on('targetcreated', async target => { if (target.type() === 'page') { const openedPage = await target.page(); if (openedPage) attachPage(openedPage) } })
  browser.on('disconnected', () => { browser = null; page = null; activePage = null; presentationPage = null; presentationState = { open:false, url:'', title:'', visibleText:'', pageKey:'', capturedAt:0, method:'' }; console.log('专用 Chrome 已关闭；再次点击「连接视频号」可重新打开。') })
  if (page.url() === 'about:blank') await page.goto('https://channels.weixin.qq.com/platform/live/liveBuild', { waitUntil:'domcontentloaded', timeout:30000 })
  return page
}

async function applyLoginCommand(result) {
  const request = String(result?.loginRequest || '')
  if (!request || request === loginAck || openingLogin) return
  openingLogin = true
  try {
    const targetPage = await ensureBrowser()
    await targetPage.goto('https://channels.weixin.qq.com/platform/live/liveBuild', { waitUntil:'domcontentloaded', timeout:30000 })
    await targetPage.bringToFront()
    loginAck = request
    console.log('已打开视频号直播后台。请在专用 Chrome 窗口扫码登录。')
  } catch (error) {
    console.error('打开视频号后台失败：' + String(error?.message || error))
  } finally { openingLogin = false }
}

async function capturePresentation() {
  if (!presentationPage || presentationPage.isClosed()) {
    presentationState = { open:false, url:'', title:'', visibleText:'', pageKey:'', capturedAt:0, method:'' }
    return
  }
  try {
    const state = await presentationPage.evaluate(() => {
      const selectors = ['.reveal .slides section.present', '.remark-visible .remark-slide-content', '.swiper-slide-active', '.slide.active', '[data-slide].active', '[aria-current="step"]']
      const root = selectors.map(selector => document.querySelector(selector)).find(Boolean) || document.body
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      const text = []
      while (walker.nextNode() && text.join(' ').length < 6500) {
        const node = walker.currentNode
        const parent = node.parentElement
        const value = node.textContent?.replace(/\s+/g, ' ').trim()
        if (!parent || !value || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(parent.tagName)) continue
        const style = getComputedStyle(parent)
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue
        if (![...parent.getClientRects()].some(rect => rect.width && rect.height && rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth)) continue
        text.push(value)
      }
      const images = [...root.querySelectorAll('img[alt]')].filter(image => {
        const rect = image.getBoundingClientRect()
        return rect.width && rect.height && rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth
      }).map(image => image.alt.trim()).filter(Boolean).slice(0, 12)
      const numbered=document.querySelector('[data-slide-count]')
      const progress=document.querySelector('.progress-dots[aria-label]')?.getAttribute('aria-label')?.match(/^(\d+)\s*\/\s*(\d+)$/)
      const figures=document.querySelectorAll('figure.slide')
      const activeFigure=document.querySelector('figure.slide.active')
      const pageNumber=Number(numbered?.getAttribute('data-slide-number')||progress?.[1]||(activeFigure?[...figures].indexOf(activeFigure)+1:0))
      const pageCount=Number(numbered?.getAttribute('data-slide-count')||progress?.[2]||figures.length||0)
      return { url:location.href, title:document.title, visibleText:[...text,...images.map(label=>'图片：'+label),root.querySelector('.dsh-speaker-notes')?.textContent?'本页补充笔记：'+root.querySelector('.dsh-speaker-notes').textContent:''].join('\n').slice(0,6000), pageKey:location.href + '|' + text.join('|').slice(0,1500),pageNumber,pageCount,
        flashSaleSupported:document.documentElement.getAttribute('data-flash-sale-supported')==='true',flashSaleId:document.documentElement.getAttribute('data-flash-sale-id')||'' }
    })
    if (state.visibleText.length < 40) {
      const screenshot = await presentationPage.screenshot({ type:'png' })
      const hash = createHash('sha256').update(screenshot).digest('hex')
      if (hash !== lastImageHash) {
        const path = resolve(tmpdir(), `dsh-live-slide-${randomUUID()}.png`)
        try {
          await writeFile(path, screenshot)
          const result = await execFileAsync(ocrTool, [path], { timeout:10000, maxBuffer:1024*1024 })
          lastOcrText = result.stdout.trim().slice(0,6000)
          lastImageHash = hash
        } finally { await unlink(path).catch(() => {}) }
      }
      if (lastOcrText) { state.visibleText = lastOcrText; state.pageKey = state.url + '|' + lastOcrText.slice(0,1500) }
    }
    presentationState = { ...state, open:true, capturedAt:Date.now(), method:state.visibleText === lastOcrText && lastOcrText ? 'ocr' : 'dom', error:'' }
  } catch (error) {
    presentationState = { ...presentationState, open:false, error:String(error?.message || error).slice(0,120) }
  }
}

async function applyPresentationCommand(result) {
  const command = result?.presentationCommand
  if (!command?.id || command.id === presentationAck) return
  try {
    await ensureBrowser()
    if (command.action === 'open') {
      const url = new URL(command.url)
      if (!['http:','https:'].includes(url.protocol)) throw new Error('演示页只支持 HTTP/HTTPS 地址')
      if (!presentationPage || presentationPage.isClosed()) presentationPage = await browser.newPage()
      lastImageHash = ''
      lastOcrText = ''
      await presentationPage.setBypassServiceWorker(true)
      await presentationPage.setCacheEnabled(false)
      await presentationPage.goto(url.href, { waitUntil:'domcontentloaded', timeout:30000 })
      if (url.hostname === 'lightvela-slides.pages.dev') {
        const switchToChinese = await presentationPage.waitForSelector('button[aria-label="Switch to Chinese"]', { timeout:10000 })
        await switchToChinese.click()
        await presentationPage.waitForSelector('button[aria-label="切换到英文"]', { timeout:10000 })
        await presentationPage.evaluate(() => document.activeElement?.blur())
      }
      await presentationPage.bringToFront()
    } else if (command.action === 'first') {
      if (!presentationPage || presentationPage.isClosed()) throw new Error('演示页未打开')
      const reset=await presentationPage.evaluate(()=>window.dshLiveDeck?.goToSlide?.(1)===true)
      if(!reset)throw new Error('当前演示稿不支持回到第一页')
    } else if (command.action === 'flash-sale') {
      if (!presentationPage || presentationPage.isClosed()) throw new Error('演示页未打开')
      const supported=await presentationPage.evaluate(sale=>{
        if(typeof window.dshLiveDeck?.setFlashSale!=='function')return false
        return window.dshLiveDeck.setFlashSale(sale)===true
      },command)
      if(!supported)throw new Error('当前演示稿不支持秒杀二维码，请打开新版合并演示稿')
    } else if (command.action === 'next' || command.action === 'prev') {
      if (!presentationPage || presentationPage.isClosed()) throw new Error('演示页未打开')
      await presentationPage.bringToFront()
      const handled = await presentationPage.evaluate(direction => {
        if (window.Reveal && typeof window.Reveal[direction] === 'function') { window.Reveal[direction](); return true }
        if (window.slideshow && typeof window.slideshow[direction === 'next' ? 'gotoNextSlide' : 'gotoPreviousSlide'] === 'function') { window.slideshow[direction === 'next' ? 'gotoNextSlide' : 'gotoPreviousSlide'](); return true }
        if (typeof window[direction === 'next' ? 'nextSlide' : 'prevSlide'] === 'function') { window[direction === 'next' ? 'nextSlide' : 'prevSlide'](); return true }
        return false
      }, command.action)
      if (!handled) await presentationPage.keyboard.press(command.action === 'next' ? 'ArrowRight' : 'ArrowLeft')
    } else throw new Error('未知演示页操作')
    presentationAck = command.id
    await capturePresentation()
  } catch (error) {
    console.error('演示页操作失败：' + String(error?.message || error))
    presentationState = { ...presentationState, error:String(error?.message || error).slice(0,120) }
    presentationAck = command.id
  }
}

async function applyCommand(result) {
  await applyLoginCommand(result)
  await applyPresentationCommand(result)
}

async function heartbeatBody(events) {
  await capturePresentation()
  const at=Date.now()
  if(at-lastMetricsAt>=metricsIntervalMs){
    for(const target of browser?.connected?await browser.pages():[]){
      let address;try{address=new URL(target.url())}catch{continue}
      if(address.hostname!=='channels.weixin.qq.com'||!address.pathname.startsWith('/platform/live/'))continue
      try {
        const rows=await target.evaluate(readBackendMetricTiles,LIVE_METRICS.flatMap(metric=>metric.labels))
        metrics.update(extractDomMetrics(rows,at))
      }catch{/* A closed/navigating backend tab is retried at the next sample. */}
    }
    const snapshot=metrics.snapshot(at)
    if(Object.keys(snapshot.fields).length||snapshot.liveId){pendingMetrics.push(snapshot);saveMetricsOutbox()}
    lastMetricsAt=at
  }
  return {body:JSON.stringify({ liveId: latestLiveId, liveStatus: latestStatus, browserOpen:browserOpen(), captureAt, pagePath:pagePath(), loginAck, presentationAck, presentation:presentationState, metricsSnapshots:pendingMetrics.slice(0,20), events }),metricsCount:Math.min(20,pendingMetrics.length)}
}

function acknowledgeMetrics(count){if(count){pendingMetrics.splice(0,count);saveMetricsOutbox()}}

async function flush() {
  if (sending || !queued.length) return
  sending = true
  const batch = queued.splice(0, 60)
  try {
    const payload=await heartbeatBody(batch)
    const result = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.ingestToken}`, 'Content-Type': 'application/json' },
      body: payload.body,
      signal: AbortSignal.timeout(8000),
    })
    if (!result.ok) throw new Error(`弹幕接收端 HTTP ${result.status}`)
    const accepted=await result.json()
    if(!accepted.accepted)throw new Error('直播接收端未确认数据')
    if(payload.metricsCount&&!accepted.metricsAccepted)throw new Error('接收端尚不支持直播数据，时间切片已保留在本机')
    acknowledgeMetrics(payload.metricsCount)
    await applyCommand(accepted)
    if (batch.length && Date.now() - lastLogAt > 10000) { console.log(`已转发 ${batch.length} 条直播弹幕`); lastLogAt = Date.now() }
  } catch (error) {
    queued = batch.concat(queued)
    if (Date.now() - lastLogAt > 10000) { console.error(String(error?.message || error)); lastLogAt = Date.now() }
  } finally { sending = false }
}

function attachPage(targetPage) {
  if (attachedPages.has(targetPage)) return
  attachedPages.add(targetPage)
  targetPage.on('framenavigated', frame => { if (frame === targetPage.mainFrame()) activePage = targetPage })
  targetPage.on('response', async response => {
    if (!isLiveDataResponse(response.url())) return
    activePage = targetPage
    try {
      const at=Date.now()
      const isMessage=isLiveMessageResponse(response.url())
      if(isMessage)captureAt=at
      const data=await response.json()
      if(isMessage){
        const request = JSON.parse(response.request().postData() || '{}')
        const payload = extractLiveMessage(request, data)
        if(payload){
          if (payload.liveId) latestLiveId = payload.liveId
          if(payload.liveStatus)latestStatus = payload.liveStatus
          queued.push(...payload.events.map(event=>({...event,at})))
          void flush()
        }
      }
      try{
        const counters=extractLiveMetrics(data,at)
        metrics.update(counters)
        if(counters?.liveId)latestLiveId=counters.liveId
        if(counters?.platformState==='live')latestStatus='1'
        if(counters?.platformState==='ended')latestStatus='2'
      }catch(error){console.error('解析直播指标失败，弹幕继续监听：'+String(error?.message||error).slice(0,120))}
    } catch (error) {
      if (Date.now() - lastLogAt > 10000) { console.error('解析直播弹幕失败：' + String(error?.message || error)); lastLogAt = Date.now() }
    }
  })
}
console.log('视频号弹幕监听已就绪；在 DSH 面板点击「连接视频号」将打开专用 Chrome。')
const heartbeat = setInterval(() => { if (queued.length) void flush(); else void flushHeartbeat() }, Math.min(5000,metricsIntervalMs))
async function flushHeartbeat() {
  if (sending) return
  sending=true
  try {
    const payload=await heartbeatBody([])
    const result = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.ingestToken}`, 'Content-Type': 'application/json' },
      body: payload.body,
      signal: AbortSignal.timeout(8000),
    })
    if (!result.ok) throw new Error(`弹幕接收端 HTTP ${result.status}`)
    const accepted=await result.json()
    if(!accepted.accepted)throw new Error('直播接收端未确认数据')
    if(payload.metricsCount&&!accepted.metricsAccepted)throw new Error('接收端尚不支持直播数据，时间切片已保留在本机')
    acknowledgeMetrics(payload.metricsCount)
    await applyCommand(accepted)
  } catch (error) {
    if (Date.now() - lastLogAt > 10000) { console.error(String(error?.message || error)); lastLogAt = Date.now() }
  } finally { sending=false }
}

async function reconnectExistingBrowser(){
  const processes=await execFileAsync('/bin/ps',['-axo','command='])
  const requestFile=resolve(here,'reconnect-request')
  if(existsSync(requestFile)||processes.stdout.split('\n').some(command=>command.startsWith(chrome+' ')&&command.includes('--user-data-dir='+profile)&&!command.includes('--type=')))await ensureBrowser()
  if(existsSync(requestFile))unlinkSync(requestFile)
}
void reconnectExistingBrowser().then(flushHeartbeat).catch(error=>console.error('重新连接专用 Chrome 失败：'+String(error?.message||error)))
const shutdown = async () => { clearInterval(heartbeat); if (browser?.connected) browser.disconnect(); process.exit(0) }
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
