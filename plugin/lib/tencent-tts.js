import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const MAX_TEXT_BYTES = 450

/** Convert a playback speed multiplier using Tencent's documented interpolation. */
export function tencentSpeed(rate) {
  if (!Number.isFinite(rate) || rate < .6 || rate > 2.5) throw new Error('语音速度必须在 0.6–2.5 倍之间')
  const value = rate < 1.2 ? (rate-1)*5 : rate < 1.5 ? 1+(rate-1.2)/.3 : 2+(rate-1.5)*4
  return Math.round(value*100)/100
}

/** The SDK runs in the same supervised subprocess used by the ASR bridge. */
export const TENCENT_TTS_SCRIPT = `
const {randomUUID}=require('node:crypto');
const sdk=require(cfg.sdkModule);
const client=new sdk.tts.v20190823.Client({
  credential:{secretId:cfg.secretId,secretKey:cfg.secretKey},
  region:cfg.region,
  profile:{httpProfile:{endpoint:'tts.tencentcloudapi.com',reqTimeout:cfg.timeoutSeconds}}
});
client.TextToVoice({Text:cfg.text,SessionId:randomUUID(),VoiceType:cfg.voiceType,
  SampleRate:cfg.sampleRate,Codec:'mp3',Speed:cfg.speed,Volume:0,ModelType:1
}).then(result=>{
  if(typeof result.Audio!=='string'||!result.Audio)throw new Error('腾讯云未返回合成音频');
  process.stdout.write(JSON.stringify({ok:true,audio:result.Audio,mime:'audio/mpeg',
    provider:'tencent',voiceType:cfg.voiceType,requestId:result.RequestId,truncated:false}));
}).catch(error=>{
  let message=String(error.code||'TTS_ERROR')+': '+String(error.message||'语音合成失败');
  for(const secret of [cfg.secretId,cfg.secretKey])if(secret)message=message.split(secret).join('[redacted]');
  process.stdout.write(JSON.stringify({ok:false,error:'腾讯云语音合成失败：'+message.slice(0,500)}));
});`

/** Read server credentials once and synthesize one bounded piece without truncating it. */
export function createTencentTts({credentialsFile,voiceType=602003,region='ap-guangzhou',sampleRate=24000,timeoutSeconds=30,runNode}) {
  if (typeof credentialsFile!=='string' || !credentialsFile) throw new Error('请在服务端配置 tencentTtsCredentialsFile')
  if (!Number.isSafeInteger(voiceType)||voiceType<=0 || !['ap-guangzhou','ap-shanghai','ap-beijing'].includes(region) || ![8000,16000,24000].includes(sampleRate) || !Number.isFinite(timeoutSeconds)||timeoutSeconds<=0||timeoutSeconds>35) throw new Error('腾讯云语音合成配置无效')
  const credentials = JSON.parse(readFileSync(credentialsFile,'utf8'))
  if (typeof credentials.secretId!=='string'||!credentials.secretId || typeof credentials.secretKey!=='string'||!credentials.secretKey) throw new Error('腾讯云语音合成凭据不完整')
  const sdkModule=require.resolve('tencentcloud-sdk-nodejs-tts')
  return async (text,rate=1) => {
    if (typeof text!=='string'||!text.trim()) return {ok:false,error:'播报文本为空',status:400}
    if (Array.from(text).length>150 || Buffer.byteLength(text,'utf8')>MAX_TEXT_BYTES) return {ok:false,error:'单个语音片段超过腾讯云限制，请先分段后排队合成',status:400}
    let speed
    try {speed=tencentSpeed(rate)} catch(error) {return {ok:false,error:error.message,status:400}}
    const result=await runNode(TENCENT_TTS_SCRIPT,{...credentials,sdkModule,text,speed,voiceType,region,sampleRate,timeoutSeconds})
    if (!result.ok) return {ok:false,error:result.error||'腾讯云语音合成未完成',status:502}
    if (typeof result.audio!=='string'||!result.audio || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(result.audio)) return {ok:false,error:'腾讯云返回的音频数据无效',status:502}
    return {ok:true,audio:result.audio,mime:'audio/mpeg',provider:'tencent',voiceType,requestId:result.requestId,truncated:false}
  }
}

/** Split without dropping text; each SDK request fits both provider limits. */
export const splitTencentSpeech = text => {
  const characters=Array.from(text),parts=[];
  const encoder=new TextEncoder();
  let start=0;
  while(start<characters.length){
    let end=start,bytes=0,sentence=0,clause=0;
    while(end<characters.length&&end-start<150){
      const char=characters[end],size=encoder.encode(char).length;
      if(bytes+size>450)break;
      bytes+=size;end++;
      if(/[。！？!?；;\n]/u.test(char))sentence=end;
      else if(/[，,：:\s]/u.test(char))clause=end;
    }
    const cut=end===characters.length?end:sentence||clause||end;
    const part=characters.slice(start,cut).join('');
    if(part.trim())parts.push(part);
    start=cut;
  }
  return parts;
};
