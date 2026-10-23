import {mkdirSync,existsSync,writeFileSync,symlinkSync,readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {randomBytes} from 'node:crypto'
const require=createRequire('/opt/xiaoyun/runtime/package.json');
const {stringify,parse}=require('yaml');
const root=process.env.DSH_HOME||'/data',profile=root+'/profiles/web';
const primary={provider:'demo-primary',model:process.env.LLM_MODEL,reasoningEffort:'high'};
for(const name of ['LLM_MODEL','LLM_API_KEY','LLM_BASE_URL','PUBLIC_HOST'])if(!process.env[name]||process.env[name]==='YOUR_MODEL_KEY')throw new Error('Configure '+name+' in the private .env file.');
mkdirSync(profile+'/node_modules/@biliye',{recursive:true});mkdirSync(root+'/home',{recursive:true});
if(!existsSync(root+'/.live-ingest-token'))writeFileSync(root+'/.live-ingest-token',randomBytes(32).toString('base64url'),{mode:0o600});
if(!existsSync(profile+'/node_modules/@biliye/dsh-voice-call'))symlinkSync('/opt/xiaoyun/plugin',profile+'/node_modules/@biliye/dsh-voice-call');
writeFileSync(profile+'/package.json',JSON.stringify({name:'xiaoyun-web-profile',private:true,dependencies:{'@biliye/dsh-voice-call':'file:/opt/xiaoyun/plugin'},dsh:{profile:{bundles:['@deepseek-ai/dsh-base','@deepseek-ai/dsh-web-app','@biliye/dsh-voice-call'],patchReload:'startup'}}},null,2)+'\n');
const provider=(baseURL,apiKeyEnv,model)=>({displayName:'Xiaoyun Live model',apiKeyEnv,api:'openai-completions',baseURL,timeoutMs:30000,streamIdleTimeoutMs:10000,retryPolicy:{mode:'normal',maxRetries:0},compat:{thinkingFormat:'deepseek',maxTokensField:'max_tokens',supportsDeveloperRole:false},models:[{id:model,name:model,contextWindow:128000,maxTokens:4096,input:['text'],reasoningEfforts:{off:null,high:'high'}}]});
const file=root+'/settings.yaml';const settings=existsSync(file)?parse(readFileSync(file,'utf8')):{};
settings['agent-default-model']=primary;
settings['llm-pi-ai']={providers:{'demo-primary':provider(process.env.LLM_BASE_URL,'LLM_API_KEY',process.env.LLM_MODEL)}};
const fallbacks=[];
if(process.env.BACKUP_API_KEY){settings['llm-pi-ai'].providers['demo-backup']=provider(process.env.BACKUP_BASE_URL,'BACKUP_API_KEY',process.env.BACKUP_MODEL);fallbacks.push({provider:'demo-backup',model:process.env.BACKUP_MODEL,label:'备用模型'});}
writeFileSync(file,stringify(settings),{mode:0o600});
const persona='你叫小云，是一个 AI 虚拟直播伙伴。以第一人称自然介绍当前内容，保持友好、清楚，不冒充真人或官方客服。只依据当前材料回答，不编造活动、价格、观众数据或执行结果。需要具体操作时遵守工具授权。';
writeFileSync(profile+'/cordis.patch.yml',stringify([{id:'system-prompt',config:{includeHarnessIdentity:false,includeRuntimeContext:true,persona}},{id:'voice-call',config:{tencentTtsCredentialsFile:'/secrets/tencent-tts.json',tencentTtsVoiceType:Number(process.env.TENCENT_TTS_VOICE||602003),tencentTtsRegion:process.env.TENCENT_TTS_REGION||'ap-guangzhou',liveGenerationFreshSession:true,liveGenerationPrimaryTimeoutMs:10000,liveGenerationTimeoutMs:30000,liveGenerationCooldownMs:300000,liveGenerationFallbacks:fallbacks}}]),{mode:0o600});
