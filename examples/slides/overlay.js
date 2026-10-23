// This sample overlay points to the project repository, not a real prize campaign.
const overlay=document.createElement('aside');
overlay.style.cssText='position:fixed;right:24px;top:24px;background:white;border:2px solid #c5d6ff;border-radius:18px;padding:18px;text-align:center;z-index:20;width:220px;box-shadow:0 10px 35px #21387922';
overlay.hidden=true;
const label=document.createElement('strong');label.textContent='演示二维码 · 非真实秒杀';
const image=document.createElement('img');image.style.cssText='display:block;width:180px;height:180px;margin:12px auto';image.alt='项目源码二维码';
const count=document.createElement('div');overlay.append(label,image,count);document.body.append(overlay);
let deadline=0,offset=0;
function hideOverlay(){overlay.hidden=true;document.documentElement.removeAttribute('data-flash-sale-id');}
window.dshLiveDeck={
  goToSlide(number){if(!Number.isInteger(number)||number<1||number>pages.length)return false;show(number-1);return true;},
  setFlashSale(command){
    if(!command.active){hideOverlay();return true;}
    if(!command.saleId||!Number.isFinite(command.expiresAt))return false;
    const qr=new URL(command.qrUrl,location.href);
    if(qr.origin!==location.origin)return false;
    image.src=qr.href;deadline=command.expiresAt;offset=Number.isFinite(command.serverAt)?command.serverAt-Date.now():0;
    document.documentElement.setAttribute('data-flash-sale-id',command.saleId);overlay.hidden=false;return true;
  }
};
document.documentElement.setAttribute('data-flash-sale-supported','true');
setInterval(()=>{if(overlay.hidden)return;const seconds=Math.max(0,Math.ceil((deadline-Date.now()-offset)/1000));count.textContent='展示剩余 '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');if(seconds===0)hideOverlay();},1000);
