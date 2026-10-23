/** Turn operator text into ordered slides. A separator line keeps multiline slide copy together. */
export function parseSlides(sourceText) {
  const text = String(sourceText || '').trim()
  if (!text) return []
  const blocks = text.includes('\n---\n')
    ? text.split(/\n\s*---\s*\n/)
    : text.includes('\n\n') ? text.split(/\n\s*\n/) : text.split('\n')
  return blocks.map(part => part.trim()).filter(Boolean).flatMap((part, index) => {
    const lines = part.split('\n').map(line => line.trim()).filter(Boolean)
    const heading = /^#\s+(.+)$/.exec(lines[0] || '')
    const title = heading ? heading[1].slice(0, 100) : `第 ${index + 1} 页`
    let remaining = heading ? lines.slice(1).join('\n') || heading[1] : lines.join('\n')
    const slides = []
    while (remaining) {
      if (remaining.length <= 320) { slides.push({ title: slides.length ? title + '（续）' : title, body: remaining }); break }
      const splitAt = Math.max(...['。','！','？','\n','；'].map(mark => remaining.lastIndexOf(mark, 320)))
      const end = splitAt >= 160 ? splitAt + 1 : 320
      slides.push({ title: slides.length ? title + '（续）' : title, body: remaining.slice(0, end).trim() })
      remaining = remaining.slice(end).trim()
    }
    return slides
  })
}

export const LIVE_STAGE_HTML = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>小云直播演示画面</title>
<style>
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#050a18;color:#fff;font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}body{display:grid;place-items:center}
.stage{position:relative;width:min(100vw,177.777vh);aspect-ratio:16/9;max-height:100vh;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;background:radial-gradient(circle at 82% 14%,#2474bb 0,transparent 32%),linear-gradient(130deg,#101d40,#14245b 55%,#172b58)}
.stage:before{content:"";position:absolute;inset:-10%;background:linear-gradient(110deg,transparent 47%,#ffffff0b 48%,transparent 49%),radial-gradient(circle at 14% 85%,#20beaa33,transparent 33%);pointer-events:none}
.top,.bottom{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;padding:3.4% 5.2%;font-weight:600;letter-spacing:.08em}
.brand{display:flex;align-items:center;gap:.65em;color:#b7eaff;font-size:clamp(16px,1.55vw,30px)}.dot{width:.7em;height:.7em;border-radius:50%;background:#5eead4;box-shadow:0 0 1em #5eead4}
.num{font-size:clamp(15px,1.35vw,27px);color:#b8cbed;font-variant-numeric:tabular-nums}
.content{position:relative;z-index:1;flex:1;display:flex;flex-direction:column;justify-content:center;padding:2% 8% 5%;max-width:90%}
.eyebrow{color:#5de0db;font-size:clamp(14px,1.3vw,28px);letter-spacing:.18em;font-weight:700;margin-bottom:2.5%}
h1{font-size:clamp(38px,5.1vw,100px);line-height:1.13;margin:0 0 3%;letter-spacing:-.02em;text-wrap:balance}
.body{white-space:pre-wrap;overflow-wrap:anywhere;font-size:clamp(22px,2.45vw,52px);line-height:1.45;color:#e5efff;max-height:51vh;overflow:hidden}
.bottom{gap:3%;align-items:flex-end;color:#bbd4ef;font-size:clamp(13px,1.2vw,24px)}
.speech{flex:1;max-width:78%;min-height:1.5em;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#e5f6ff}
.progress{position:absolute;left:0;right:0;bottom:0;height:.6%;background:#ffffff24}.progress span{display:block;height:100%;background:linear-gradient(90deg,#4ce2cc,#78bbff);width:0}
</style></head><body><main class="stage"><div class="top"><div class="brand"><i class="dot"></i>小云 · LIVE</div><div class="num" id="num">等待素材</div></div><div class="content"><div class="eyebrow">LIGHTHOUSE · LIVE</div><h1 id="title">直播画面准备中</h1><div class="body" id="body">在 DSH 直播面板设置素材后，这里会同步显示当前页。</div></div><div class="bottom"><div id="state">待机中</div><div class="speech" id="speech"></div></div><div class="progress"><span id="progress"></span></div></main>
<script>
const token=new URL(location.href).searchParams.get('token')||'';
let revision=-1;
async function refresh(){try{const res=await fetch('/api/voice-call/live-stage-state?token='+encodeURIComponent(token),{cache:'no-store'});if(!res.ok)throw Error('画面连接失败');const s=await res.json();if(s.revision!==revision){revision=s.revision;document.getElementById('title').textContent=s.slide?.title||'直播画面准备中';document.getElementById('body').textContent=s.slide?.body||'请在场控面板设置直播素材';document.getElementById('num').textContent=s.slideCount?(s.slideIndex+1)+' / '+s.slideCount:'等待素材';document.getElementById('progress').style.width=s.slideCount?((s.slideIndex+1)/s.slideCount*100)+'%':'0%'}document.getElementById('state').textContent=s.running?'小云直播中':'待机中';document.getElementById('speech').textContent=s.speech||''}catch(e){document.getElementById('state').textContent=String(e.message||e)}}
refresh();setInterval(refresh,1200);
</script></body></html>`
