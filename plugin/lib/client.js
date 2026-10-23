window.__ModuleLoader__.load({
	id: "@biliye/dsh-voice-call",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const React = require("react");
		//#region src/client/index.js
		const NS = "voice-call";
		const inject = ["slots", "sessions", "timer"];
		const API = {
			getState: "/api/voice-call/state",
			bindSession: "/api/voice-call/bind-session",
			ensure: "/api/voice-call/ensure",
			setPersona: "/api/voice-call/persona",
			viewing: "/api/voice-call/viewing",
			sendText: "/api/voice-call/send-text",
			tts: "/api/voice-call/tts",
			cloudAsr: "/api/voice-call/asr",
			createTask: "/api/voice-call/tasks",
			taskList: "/api/voice-call/tasks",
			taskStatus: "/api/voice-call/task-status",
			pollEvents: "/api/voice-call/events",
            liveHeartbeat:"/api/voice-call/live-heartbeat",
            liveAutomation:"/api/voice-call/live-automation",
            liveStatus: "/api/voice-call/live-status",
            liveConfig: "/api/voice-call/live-config",
            liveStart: "/api/voice-call/live-start",
            liveStop: "/api/voice-call/live-stop",
            livePause:"/api/voice-call/live-pause",liveResume:"/api/voice-call/live-resume",liveRestart:"/api/voice-call/live-restart",
            liveFinish: "/api/voice-call/live-finish",
            livePlaybackError: "/api/voice-call/live-playback-error",
            liveAck: "/api/voice-call/live-ack",
            livePrepare:"/api/voice-call/live-prepare",
            liveConnect: "/api/voice-call/live-connect",
            liveSlide: "/api/voice-call/live-slide",
            liveAuto: "/api/voice-call/live-auto",
            livePresentationOpen: "/api/voice-call/live-presentation-open",
            livePresentationNav: "/api/voice-call/live-presentation-nav",
            livePace: "/api/voice-call/live-pace",
            liveExport: "/api/voice-call/live-export",
            liveLottery: "/api/voice-call/live-lottery",
            liveFlashSale: "/api/voice-call/live-flash-sale",
		};
		const call = async (url, body, signal) => {
			const options = body === undefined
				? { method: 'GET' }
				: { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
			const controller=signal?null:new window.AbortController();const timeout=controller?window.setTimeout(()=>controller.abort(),45000):null
            try{
			const res = await fetch(url, { ...options, signal:signal||controller.signal })
			let data = null
			try { data = await res.json() } catch {}
			if (!res.ok) return { ok: false, error: data?.error || `HTTP ${res.status}` }
			return data
            }finally{if(timeout)window.clearTimeout(timeout)}
		}
		const DEFAULTS = {
			asrMode: 'funasr-http',
            audioInputDeviceId:'',
			asrUrl: 'ws://127.0.0.1:10095',
			funasrHttpBase: 'http://127.0.0.1:10095/v1/audio/transcriptions',
			funasrHttpKey: '',
			funasrHttpModel: 'sensevoice',
			cloudAsrBase: 'https://api.openai.com/v1/audio/transcriptions',
			cloudAsrKey: '',
			cloudAsrModel: 'whisper-1',
			ttsEnabled: true,
            bgmEnabled: true, bgmVolume: .16, bgmDucking: true, bgmTrack: 'gymnopedie',
			ttsProvider: 'tencent',
			ttsBase: 'https://api.openai.com/v1/audio/speech',
			ttsMinimaxBase: 'https://api.minimaxi.com/v1/t2a_v2',
			ttsKey: '',
			ttsGroupId: '',
			ttsVoice: '602003',
			ttsSpeed: 1,
            speechSpeedVersion: 2,
			ttsMaxChars: 300,
			persona: '',
			autoSend: true,
			announceOtherDone: true,
			wakeMode: false,
			wakeWord: '小鲸鱼',
			sleepAfterMs: 8000,
			vadEnabled: true,
			vadSilenceMs: 1200,
			vadRms: 0.05,
            vadMinSpeechMs: 320,
            inputGateVersion: 2,
			checkMs: 30000,
			pos: { x: -1, y: -1 },
		}
		const speechSpeed = (settings) => Math.max(.5, Math.min(2, Number(settings.ttsSpeed) || DEFAULTS.ttsSpeed));
        const loadSettings = () => {
			let merged = { ...DEFAULTS }
			try {
				const raw = window.localStorage.getItem('xiaoyun.live.v1')
				if (raw) {
					const stored = JSON.parse(raw)
					merged = { ...merged, ...stored }
                    if (stored.inputGateVersion !== 2) {
                        merged.vadRms = Math.max(Number(stored.vadRms) || 0, 0.05)
                        merged.vadMinSpeechMs = 320
                        merged.inputGateVersion = 2
                    }
                    if (stored.speechSpeedVersion !== 2) {
                        merged.ttsSpeed = DEFAULTS.ttsSpeed
                        merged.speechSpeedVersion = 2
                    }
					if (merged.asrMode === 'funasr' && stored.funasrHttpBase === undefined) {
						merged.asrMode = 'funasr-http'
					}
				}
			} catch {}
            merged.ttsVoice = DEFAULTS.ttsVoice;
            merged.ttsProvider = DEFAULTS.ttsProvider;
			try { window.localStorage.setItem('xiaoyun.live.v1', JSON.stringify(merged)) } catch {}
			return merged
		}
		const saveSettings = (s) => {
			try { window.localStorage.setItem('xiaoyun.live.v1', JSON.stringify(s)) } catch {}
		}
		const sessionTitle = (list, id) => {
			const row = id ? list?.byId?.[id] : undefined
			return row?.displayTitle || row?.title || id || '未绑定会话'
		}
		const STYLE = `
.va-fab { position: fixed; width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg,#6c5ce7,#a29bfe); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 2147483000; box-shadow: 0 6px 20px rgba(0,0,0,.35); font-size: 24px; user-select: none; touch-action: none; border: none; }
.va-fab:hover { transform: scale(1.08); }
.va-fab.on { background: linear-gradient(135deg,#e17055,#ff7675); animation: va-pulse 1.2s infinite; }
@keyframes va-pulse { 0%,100% { box-shadow: 0 6px 20px rgba(225,112,85,.6); } 50% { box-shadow: 0 6px 28px rgba(225,112,85,.95); } }
.va-panel { position: fixed; width: 420px; max-width: calc(100vw - 24px); height: 560px; max-height: calc(100vh - 24px); background: #1e2130; border: 1px solid #3a3f56; border-radius: 16px; box-shadow: 0 12px 40px rgba(0,0,0,.5); z-index: 2147483001; display: flex; flex-direction: column; overflow: hidden; color: #e8eaf2; font: 13px/1.5 system-ui, sans-serif; }
.va-panel .va-head { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: #262a3d; border-bottom: 1px solid #3a3f56; }
.va-panel .va-head .va-title { font-weight: 700; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.va-panel .va-head .va-tab { background: transparent; color: #9aa0b5; border: none; cursor: pointer; padding: 4px 10px; border-radius: 8px; font-size: 13px; }
.va-panel .va-head .va-tab.on { background: #6c5ce7; color: #fff; }
.va-panel .va-head .va-x { background: transparent; border: none; color: #9aa0b5; cursor: pointer; font-size: 16px; padding: 2px 6px; }
.va-body { flex: 1; overflow-y: auto; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
.va-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.va-btn { background: #6c5ce7; color: #fff; border: none; border-radius: 10px; padding: 8px 14px; cursor: pointer; font-size: 13px; }
.va-btn:disabled { opacity: .5; cursor: not-allowed; }
.va-btn.danger { background: #e17055; }
.va-btn.ghost { background: #33384f; }
.va-input { flex: 1; background: #161a29; color: #e8eaf2; border: 1px solid #3a3f56; border-radius: 10px; padding: 8px 10px; font-size: 13px; outline: none; }
.va-input:focus { border-color: #6c5ce7; }
.va-transcript { background: #161a29; border-radius: 10px; padding: 10px; min-height: 64px; white-space: pre-wrap; word-break: break-word; color: #cfd4e6; }
.va-msg { background: #262a3d; border-radius: 10px; padding: 8px 10px; white-space: pre-wrap; word-break: break-word; }
.va-msg.user { background: #33386e; }
.va-msg .va-tag { color: #9aa0b5; font-size: 11px; margin-right: 6px; }
.va-task { background: #262a3d; border-radius: 10px; padding: 8px 10px; display: flex; flex-direction: column; gap: 4px; }
.va-task .va-t { display: flex; justify-content: space-between; gap: 8px; }
.va-badge { font-size: 11px; padding: 1px 8px; border-radius: 8px; white-space: nowrap; }
.va-badge.running { background: #fdcb6e55; color: #ffeaa7; }
.va-badge.completed { background: #00b89455; color: #55efc4; }
.va-badge.error { background: #d6303155; color: #ff7675; }
.va-badge.failed { background: #d6303155; color: #ff7675; }
.va-badge.pending { background: #636e7255; color: #dfe6e9; }
.va-hint { color: #9aa0b5; font-size: 12px; }
.va-set { display: flex; flex-direction: column; gap: 3px; }
.va-set label { color: #9aa0b5; font-size: 12px; }
.va-select, .va-input { width: 100%; box-sizing: border-box; }
.va-status { display: flex; gap: 10px; align-items: center; font-size: 12px; color: #9aa0b5; flex-wrap: wrap; }
.va-dot { width: 8px; height: 8px; border-radius: 50%; background: #636e72; }
.va-dot.live { background: #00b894; animation: va-pulse 1.2s infinite; }
.va-sendwrap { display: flex; gap: 8px; }
.va-input-device { display:flex; flex-direction:column; gap:10px; padding:12px; border:1px solid #3a3f56; border-radius:12px; background:#262a3d; }
.va-input-device-label { font-size:14px; font-weight:650; }
.va-input-device-row { display:flex; gap:8px; flex-wrap:wrap; }
.va-input-device-row select { min-width:150px; flex:1 1 190px; }
.va-input-device-row button { flex:0 0 auto; white-space:nowrap; }
.va-input-meter { display:flex; gap:4px; height:10px; }
.va-input-meter span { flex:1; border-radius:2px; background:#393e50; }
.va-input-meter .lit { background:#59dca9; }
.va-input-meter .high { background:#ffc15c; }
.va-input-device-footer { display:flex; align-items:flex-start; gap:8px; }
.va-input-device-footer .va-hint { flex:1; }
.va-input-refresh { background:none; border:none; color:#b4b5ff; padding:0; font-size:12px; cursor:pointer; white-space:nowrap; }
.va-input-error { color:#ffacac; font-size:12px; }
`
		const e = React.createElement
		const Fragment = React.Fragment
const AVATAR_SVG = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1254 1254\" aria-hidden=\"true\">\n<defs><filter id=\"va-green-key\" x=\"0\" y=\"0\" width=\"100%\" height=\"100%\" color-interpolation-filters=\"sRGB\">\n<feColorMatrix in=\"SourceGraphic\" type=\"matrix\" values=\"0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -.5 1 -.5 0 0\" result=\"greenExcess\"/>\n<feComponentTransfer in=\"greenExcess\" result=\"greenMask\"><feFuncA type=\"linear\" slope=\"8\" intercept=\"-4\"/></feComponentTransfer>\n<feComposite in=\"SourceGraphic\" in2=\"greenMask\" operator=\"out\" result=\"character\"/>\n<feFlood flood-color=\"#00ff00\" result=\"flatGreen\"/>\n<feComposite in=\"flatGreen\" in2=\"greenMask\" operator=\"in\" result=\"backdrop\"/>\n<feComposite in=\"character\" in2=\"backdrop\" operator=\"arithmetic\" k2=\"1\" k3=\"1\"/>\n</filter></defs>\n<g class=\"av-pose av-pose-greeting\"><g class=\"av-rhythm\"><image width=\"1254\" height=\"1254\" href=\"api/voice-call/avatar?asset=greeting.a9318cd99a62cfae.png&amp;render=20261022\" filter=\"url(#va-green-key)\"/><g transform=\"translate(609 671)\">\n<path class=\"av-mouth-closed\" d=\"M-37 -6 Q-1 22 37 -4\" fill=\"none\" stroke=\"#a4493b\" stroke-width=\"7\" stroke-linecap=\"round\"/>\n<g class=\"av-mouth-open\" transform=\"scale(1 0)\" opacity=\"0\">\n<path d=\"M-36 -8 Q0 -24 36 -8 Q39 44 0 45 Q-39 43 -36 -8Z\" fill=\"#9b433a\" stroke=\"#a4493b\" stroke-width=\"5\" stroke-linejoin=\"round\"/>\n<path d=\"M-27 -6 Q0 3 27 -6 L24 2 Q0 9 -24 2Z\" fill=\"#fff2df\"/>\n<path d=\"M-24 28 Q0 10 24 28 Q17 40 0 40 Q-17 40 -24 28Z\" fill=\"#f99789\"/>\n</g></g></g></g>\n<g class=\"av-pose av-pose-listen\"><g class=\"av-rhythm\"><image width=\"1254\" height=\"1254\" href=\"api/voice-call/avatar?asset=listen.85b9a9e2afa6fc99.png&amp;render=20261022\" filter=\"url(#va-green-key)\"/><g transform=\"translate(609 671)\">\n<path class=\"av-mouth-closed\" d=\"M-37 -6 Q-1 22 37 -4\" fill=\"none\" stroke=\"#a4493b\" stroke-width=\"7\" stroke-linecap=\"round\"/>\n<g class=\"av-mouth-open\" transform=\"scale(1 0)\" opacity=\"0\">\n<path d=\"M-36 -8 Q0 -24 36 -8 Q39 44 0 45 Q-39 43 -36 -8Z\" fill=\"#9b433a\" stroke=\"#a4493b\" stroke-width=\"5\" stroke-linejoin=\"round\"/>\n<path d=\"M-27 -6 Q0 3 27 -6 L24 2 Q0 9 -24 2Z\" fill=\"#fff2df\"/>\n<path d=\"M-24 28 Q0 10 24 28 Q17 40 0 40 Q-17 40 -24 28Z\" fill=\"#f99789\"/>\n</g></g></g></g>\n<g class=\"av-pose av-pose-ponder\"><g class=\"av-rhythm\"><image width=\"1254\" height=\"1254\" href=\"api/voice-call/avatar?asset=ponder.6f491d544971a8f6.png&amp;render=20261022\" filter=\"url(#va-green-key)\"/><g transform=\"translate(609 671)\">\n<path class=\"av-mouth-closed\" d=\"M-37 -6 Q-1 22 37 -4\" fill=\"none\" stroke=\"#a4493b\" stroke-width=\"7\" stroke-linecap=\"round\"/>\n<g class=\"av-mouth-open\" transform=\"scale(1 0)\" opacity=\"0\">\n<path d=\"M-36 -8 Q0 -24 36 -8 Q39 44 0 45 Q-39 43 -36 -8Z\" fill=\"#9b433a\" stroke=\"#a4493b\" stroke-width=\"5\" stroke-linejoin=\"round\"/>\n<path d=\"M-27 -6 Q0 3 27 -6 L24 2 Q0 9 -24 2Z\" fill=\"#fff2df\"/>\n<path d=\"M-24 28 Q0 10 24 28 Q17 40 0 40 Q-17 40 -24 28Z\" fill=\"#f99789\"/>\n</g></g></g></g>\n<g class=\"av-pose av-pose-explain\"><g class=\"av-rhythm\"><image width=\"1254\" height=\"1254\" href=\"api/voice-call/avatar?asset=explain.d9a8527727aa5d6f.png&amp;render=20261022\" filter=\"url(#va-green-key)\"/><g transform=\"translate(609 671)\">\n<path class=\"av-mouth-closed\" d=\"M-37 -6 Q-1 22 37 -4\" fill=\"none\" stroke=\"#a4493b\" stroke-width=\"7\" stroke-linecap=\"round\"/>\n<g class=\"av-mouth-open\" transform=\"scale(1 0)\" opacity=\"0\">\n<path d=\"M-36 -8 Q0 -24 36 -8 Q39 44 0 45 Q-39 43 -36 -8Z\" fill=\"#9b433a\" stroke=\"#a4493b\" stroke-width=\"5\" stroke-linejoin=\"round\"/>\n<path d=\"M-27 -6 Q0 3 27 -6 L24 2 Q0 9 -24 2Z\" fill=\"#fff2df\"/>\n<path d=\"M-24 28 Q0 10 24 28 Q17 40 0 40 Q-17 40 -24 28Z\" fill=\"#f99789\"/>\n</g></g></g></g>\n<g class=\"av-pose av-pose-happy\"><g class=\"av-rhythm\"><image width=\"1254\" height=\"1254\" href=\"api/voice-call/avatar?asset=happy.23e0cad87613272f.png&amp;render=20261022\" filter=\"url(#va-green-key)\"/><g transform=\"translate(609 671)\">\n<path class=\"av-mouth-closed\" d=\"M-37 -6 Q-1 22 37 -4\" fill=\"none\" stroke=\"#a4493b\" stroke-width=\"7\" stroke-linecap=\"round\"/>\n<g class=\"av-mouth-open\" transform=\"scale(1 0)\" opacity=\"0\">\n<path d=\"M-36 -8 Q0 -24 36 -8 Q39 44 0 45 Q-39 43 -36 -8Z\" fill=\"#9b433a\" stroke=\"#a4493b\" stroke-width=\"5\" stroke-linejoin=\"round\"/>\n<path d=\"M-27 -6 Q0 3 27 -6 L24 2 Q0 9 -24 2Z\" fill=\"#fff2df\"/>\n<path d=\"M-24 28 Q0 10 24 28 Q17 40 0 40 Q-17 40 -24 28Z\" fill=\"#f99789\"/>\n</g></g></g></g>\n<g class=\"av-pose av-pose-wink\"><g class=\"av-rhythm\"><image width=\"1254\" height=\"1254\" href=\"api/voice-call/avatar?asset=wink.0952f2c53c27f725.png&amp;render=20261022\" filter=\"url(#va-green-key)\"/><g transform=\"translate(609 671)\">\n<path class=\"av-mouth-closed\" d=\"M-37 -6 Q-1 22 37 -4\" fill=\"none\" stroke=\"#a4493b\" stroke-width=\"7\" stroke-linecap=\"round\"/>\n<g class=\"av-mouth-open\" transform=\"scale(1 0)\" opacity=\"0\">\n<path d=\"M-36 -8 Q0 -24 36 -8 Q39 44 0 45 Q-39 43 -36 -8Z\" fill=\"#9b433a\" stroke=\"#a4493b\" stroke-width=\"5\" stroke-linejoin=\"round\"/>\n<path d=\"M-27 -6 Q0 3 27 -6 L24 2 Q0 9 -24 2Z\" fill=\"#fff2df\"/>\n<path d=\"M-24 28 Q0 10 24 28 Q17 40 0 40 Q-17 40 -24 28Z\" fill=\"#f99789\"/>\n</g></g></g></g>\n<g class=\"av-pose av-pose-rest\"><g class=\"av-rhythm\"><image width=\"1254\" height=\"1254\" href=\"api/voice-call/avatar?asset=rest.67584a66577cabe4.png&amp;render=20261022\" filter=\"url(#va-green-key)\"/><g transform=\"translate(609 671)\">\n<path class=\"av-mouth-closed\" d=\"M-37 -6 Q-1 22 37 -4\" fill=\"none\" stroke=\"#a4493b\" stroke-width=\"7\" stroke-linecap=\"round\"/>\n<g class=\"av-mouth-open\" transform=\"scale(1 0)\" opacity=\"0\">\n<path d=\"M-36 -8 Q0 -24 36 -8 Q39 44 0 45 Q-39 43 -36 -8Z\" fill=\"#9b433a\" stroke=\"#a4493b\" stroke-width=\"5\" stroke-linejoin=\"round\"/>\n<path d=\"M-27 -6 Q0 3 27 -6 L24 2 Q0 9 -24 2Z\" fill=\"#fff2df\"/>\n<path d=\"M-24 28 Q0 10 24 28 Q17 40 0 40 Q-17 40 -24 28Z\" fill=\"#f99789\"/>\n</g></g></g></g>\n<g class=\"av-pose av-pose-thinking\"><g class=\"av-rhythm\"><image width=\"1254\" height=\"1254\" href=\"api/voice-call/avatar?asset=thinking.3ce1e0fe24001f53.png&amp;render=20261022\" filter=\"url(#va-green-key)\"/></g></g>\n<g class=\"av-pose av-pose-cool\"><g class=\"av-rhythm\"><image width=\"1254\" height=\"1254\" href=\"api/voice-call/avatar?asset=cool.501c56d4c04eff70.png&amp;render=20261022\" filter=\"url(#va-green-key)\"/></g></g>\n</svg>";
const AVATAR_POSES = [
  {
    "id": "greeting",
    "label": "挥手问好",
    "motion": "sway",
    "animated": true
  },
  {
    "id": "listen",
    "label": "侧耳聆听",
    "motion": "listen",
    "animated": true
  },
  {
    "id": "ponder",
    "label": "抬眼思考",
    "motion": "think",
    "animated": true
  },
  {
    "id": "explain",
    "label": "认真讲解",
    "motion": "nod",
    "animated": true
  },
  {
    "id": "happy",
    "label": "开心举手",
    "motion": "bounce",
    "animated": true
  },
  {
    "id": "wink",
    "label": "眨眼鼓励",
    "motion": "sway",
    "animated": true
  },
  {
    "id": "rest",
    "label": "放松休息",
    "motion": "breathe",
    "animated": true
  },
  {
    "id": "thinking",
    "label": "好奇托腮",
    "motion": "think",
    "animated": false
  },
  {
    "id": "cool",
    "label": "墨镜耍酷",
    "motion": "breathe",
    "animated": false
  }
];
const AVATAR_MODE_POSES = {
  idle: ['greeting', 'cool', 'wink', 'rest'],
  listening: ['listen', 'ponder', 'greeting'],
  thinking: ['ponder', 'thinking', 'rest'],
  speaking: ['explain', 'greeting', 'happy', 'wink'],
  error: ['thinking'],
};

function nextAvatarPose(mode, previous, random, elapsed = Infinity) {
  const source = AVATAR_MODE_POSES[mode];
  const choices = source.filter(id => id !== previous && (mode !== 'idle' || elapsed >= 35000 || id !== 'rest'));
  return choices.length ? choices[Math.floor(random * choices.length)] : source[0];
}

function nextAvatarPreview(mode, previous) {
  const choices = mode === 'speaking' ? AVATAR_MODE_POSES.speaking : AVATAR_POSES.map(pose => pose.id);
  return choices[(choices.indexOf(previous) + 1) % choices.length];
}

const AVATAR_STYLE = `
.va-avatar-stage { display:flex; flex-direction:column; gap:10px; flex-shrink:0; }
.va-avatar-canvas { height:340px; width:100%; flex-shrink:0; display:flex; align-items:center; justify-content:center; overflow:hidden; background:#00ff00; border:0; border-radius:0; box-shadow:none; }
.va-avatar-art { width:340px; height:340px; max-width:100%; position:relative; }
.va-avatar-art svg { width:100%; height:100%; display:block; }
.va-avatar-console { padding:12px; display:flex; flex-direction:column; gap:10px; background:#252b40; border:1px solid #39415c; border-radius:12px; }
.va-avatar-status-row { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.va-avatar-label { color:#d8e1f6; font-size:12px; display:flex; align-items:center; gap:6px; }
.va-avatar-label::before { content:''; width:6px; height:6px; border-radius:50%; background:#8c9bc0; }
.va-avatar-stage[data-mode="speaking"] .va-avatar-label::before { background:#40aa86; }
.va-avatar-stage[data-mode="listening"] .va-avatar-label::before { background:#4a88dc; }
.va-avatar-pose-name { color:#aab7d4; font-size:11px; }
.va-avatar-controls { display:flex; flex-wrap:wrap; gap:6px; }
.va-avatar-controls button { color:#e0e7f7; border:1px solid #4a5372; background:#343c57; border-radius:8px; padding:6px 9px; font:11px system-ui; cursor:pointer; }
.va-avatar-controls button:hover { background:#45506f; }
.va-avatar-controls button:disabled { opacity:.5; cursor:default; }
.va-avatar-capture-help { color:#9caac8; font-size:10px; }
.va-avatar-canvas:fullscreen { height:100dvh; width:100vw; background:#00ff00; cursor:none; }
.va-avatar-canvas::backdrop { background:#00ff00; }
.va-avatar-canvas:fullscreen .va-avatar-art { width:min(100vw,100dvh); height:min(100vw,100dvh); }
.av-pose { display:none; transform-origin:627px 1100px; }
${AVATAR_POSES.map(pose => `[data-pose="${pose.id}"] .av-pose-${pose.id} { display:block; animation:av-art-${pose.motion} ${pose.motion === 'bounce' ? '2.8' : '4.8'}s ease-in-out infinite; }`).join('\n')}
.av-rhythm { transform-origin:627px 760px; }
[data-mode="speaking"] .av-rhythm { transform:translateY(calc(var(--voice-level, 0) * -9px)); }
@keyframes av-art-breathe { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
@keyframes av-art-listen { 0%,65%,100%{transform:rotate(-1deg)} 25%{transform:rotate(-2deg) translateY(5px)} 40%{transform:rotate(-1deg)} }
@keyframes av-art-think { 0%,100%{transform:rotate(1deg)} 50%{transform:rotate(2.5deg) translateY(-4px)} }
@keyframes av-art-nod { 0%,45%,100%{transform:translateY(0)} 18%,30%{transform:translateY(7px) rotate(.5deg)} 24%{transform:translateY(0)} }
@keyframes av-art-sway { 0%,100%{transform:rotate(-.6deg)} 50%{transform:rotate(.8deg) translateY(-6px)} }
@keyframes av-art-bounce { 0%,100%{transform:translateY(0) rotate(-.6deg)} 42%{transform:translateY(-14px) rotate(.6deg)} }
@media (prefers-reduced-motion:reduce) { .av-pose { animation:none!important; } .av-rhythm { transform:none!important; } }
@media (max-height:730px) { .va-avatar-canvas{height:260px} .va-avatar-art{height:260px;width:260px} }
.va-panel { height:802px; max-height:calc(100dvh - 110px); }
.va-body { scrollbar-width:thin; scrollbar-color:#48516d transparent; }
`;
const AVATAR_LABELS = { idle:'我在这里', listening:'认真听你说', thinking:'让我想一想…', speaking:'正在和你说话', error:'稍等一下，出了点状况' };
function VoiceAvatar({ mode, analyser, onPreview, onStop, previewBusy, previewDisabled = false }) {
  const root = React.useRef(null);
  const [pose, setPose] = React.useState(AVATAR_MODE_POSES[mode][0]);
  const history = React.useRef({});
  const changePose = React.useRef(() => {});
  const [captureError, setCaptureError] = React.useState('');
  const openCapture = async () => {
    setCaptureError('');
    try { await root.current.querySelector('.va-avatar-canvas').requestFullscreen(); }
    catch { setCaptureError('无法进入全屏，可直接裁切上方绿幕区域。'); }
  };
  const closeCapture = async () => {
    if (document.fullscreenElement !== root.current.querySelector('.va-avatar-canvas')) return;
    try { await document.exitFullscreen(); }
    catch { setCaptureError('未能退出全屏，请使用浏览器的退出全屏功能。'); }
  };
  React.useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') closeCapture(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  React.useEffect(() => {
    const node = root.current;
    const mouths = [...node.querySelectorAll('.av-mouth-open')];
    const smiles = [...node.querySelectorAll('.av-mouth-closed')];
    const samples = analyser ? new Float32Array(analyser.fftSize) : null;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0, timer = 0, level = 0, quietSince = 0;
    const started = performance.now();
    let previousTime = started;
    let due = started + 5500 + Math.random() * 2500;
    let current = history.current[mode] ? nextAvatarPose(mode, history.current[mode], Math.random(), 0) : AVATAR_MODE_POSES[mode][0];
    const show = (id) => {
      current = id;
      history.current[mode] = id;
      node.dataset.pose = id;
      setPose(id);
    };
    const draw = (value) => {
      for (const mouth of mouths) {
        mouth.setAttribute('transform', `scale(${0.82 + value * .18} ${value * 1.25})`);
        mouth.setAttribute('opacity', value > .045 ? '1' : '0');
      }
      for (const smile of smiles) smile.setAttribute('opacity', value > .045 ? '0' : '1');
      node.style.setProperty('--voice-level', value.toFixed(3));
      node.dataset.mouth = value.toFixed(3);
    };
    const rotate = (preview = false) => {
      const id = preview ? nextAvatarPreview(mode, current) : nextAvatarPose(mode, current, Math.random(), performance.now() - started);
      show(id);
      due = performance.now() + (preview ? 10000 : 5500 + Math.random() * 2500);
    };
    const schedule = (delay) => {
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (!document.hidden && !reducedMotion.matches) rotate();
        schedule(mode === 'idle' ? 10000 + Math.random() * 6000 : 6000 + Math.random() * 3000);
      }, delay);
    };
    changePose.current = () => {
      rotate(true);
      if (mode !== 'speaking') schedule(10000);
    };
    const tick = (time) => {
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) sum += sample * sample;
      const target = Math.min(1, Math.max(0, (Math.sqrt(sum / samples.length) - .008) * 8));
      const elapsed = Math.min(100, time - previousTime);
      previousTime = time;
      level += (target - level) * (1 - Math.exp(-elapsed / (target > level ? 28 : 65)));
      draw(level < .02 ? 0 : level);
      quietSince = level < .06 ? (quietSince || time) : 0;
      if (!document.hidden && !reducedMotion.matches && time >= due && ((quietSince && time - quietSince >= 120) || time >= due + 2500)) rotate();
      frame = requestAnimationFrame(tick);
    };
    show(current);
    draw(0);
    if (mode === 'speaking' && analyser) frame = requestAnimationFrame(tick);
    else if (mode !== 'error') schedule(mode === 'idle' ? 12000 : 7000);
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); changePose.current = () => {}; draw(0); };
  }, [mode, analyser]);
  return e('div', { className:'va-avatar-stage', 'data-mode':mode, 'data-pose':pose, ref:root, role:'group', 'aria-label':'语音伙伴' },
    e('div', { className:'va-avatar-canvas', role:'img', 'aria-label':'人物绿幕', onDoubleClick:closeCapture },
      e('div', { className:'va-avatar-art', dangerouslySetInnerHTML:{ __html:AVATAR_SVG } })
    ),
    e('div', { className:'va-avatar-console', role:'group', 'aria-label':'人物控制' },
      e('div', { className:'va-avatar-status-row' },
        e('span', { className:'va-avatar-label', role:'status' }, AVATAR_LABELS[mode]),
        e('span', { className:'va-avatar-pose-name' }, AVATAR_POSES.find(p => p.id === pose).label)
      ),
      e('div', { className:'va-avatar-controls' },
        e('button', { type:'button', onClick:() => changePose.current() }, '换个表情'),
        e('button', { type:'button', disabled:previewBusy || previewDisabled, onClick:onPreview }, previewDisabled ? '直播中' : previewBusy ? '准备声音…' : '试听声音'),
        e('button', { type:'button', onClick:onStop }, '停止播报'),
        e('button', { type:'button', onClick:openCapture }, '全屏绿幕')
      ),
      e('span', { className:'va-avatar-capture-help', role:captureError ? 'alert' : undefined }, captureError || '绿幕 #00FF00 · Esc 或双击绿幕退出全屏')
    )
  );
}

		// A sustained signal must cross the user's volume threshold before recording.
function createVoiceGate() {
  let candidate = [], frames = [], active = false, voicedMs = 0, quietMs = 0, totalMs = 0;
  const reset = () => { candidate = []; frames = []; active = false; voicedMs = 0; quietMs = 0; totalMs = 0; };
  const finish = () => {
    const kept = frames;
    reset();
    const pcm = new Int16Array(kept.reduce((sum, frame) => sum + frame.length, 0));
    let offset = 0;
    for (const frame of kept) { pcm.set(frame, offset); offset += frame.length; }
    return pcm;
  };
  return {
    reset,
    push(input, settings) {
      let energy = 0;
      for (const sample of input) energy += sample * sample;
      const rms = Math.sqrt(energy / input.length);
      const loud = rms >= (Number(settings.vadRms) || 0.05);
      const ms = input.length / 16;
      const pcm = Int16Array.from(input, sample => Math.max(-1, Math.min(1, sample)) * (sample < 0 ? 32768 : 32767));
      let started = false;
      if (!active) {
        if (!loud) { candidate = []; voicedMs = 0; return { started }; }
        candidate.push(pcm);
        voicedMs += ms;
        if (voicedMs < (Number(settings.vadMinSpeechMs) || 320)) return { started };
        active = true;
        started = true;
        frames = candidate;
        candidate = [];
        totalMs = voicedMs;
      } else {
        frames.push(pcm);
        totalMs += ms;
        quietMs = loud ? 0 : quietMs + ms;
      }
      if (quietMs >= (Number(settings.vadSilenceMs) || 1200) || totalMs >= 20000) return { started, pcm:finish() };
      return { started };
    }
  };
}

const STAGE_CUES = [{"id":"xiaoyun-greeting","title":"小云打招呼","subtitle":"Keria 邀请 · 开场问候","text":"各位轻友，大家好！我是小云，Lighthouse 轻友团的 AI 伙伴。很开心来参加今晚的聚会！我的“AI 第六感”，就是对好点子特别敏感。虽然住在屏幕里，我也想和大家一起聊聊云、动动脑，让今晚多一点灵感，多一点快乐！","audioUrl":"/api/voice-call/stage-audio?asset=xiaoyun-greeting.107955bbaf50c2dc.mp3","durationSeconds":19.872},{"id":"xiaoyun-introduction","title":"小云自我介绍","subtitle":"Lighthouse 镜像部署 · TokenHub 接入 · 能力介绍","text":"可以呀！在 Lighthouse 上选用 DeepSeek Harness 镜像，就能先把 Agent 的运行环境搭起来。再接入腾讯云 TokenHub，配置好要用的大模型，加上语音和形象插件，我就能在浏览器里和大家见面、聊天啦！\n我不只会回答问题，还能调用工具查资料、整理内容，协助完成任务。你们提出想法，我来帮忙拆解步骤、动手尝试，让好点子一步步变成作品！\n如果你也想拥有一个可爱的小云，快来 Lighthouse 体验一下吧！","audioUrl":"/api/voice-call/stage-audio?asset=xiaoyun-introduction.7a8381b793774cbb.mp3","durationSeconds":35.472},{"id":"audience-interaction","title":"抽奖互动","subtitle":"邀请评论 · 主持人截图抽奖","text":"好的，主持人！那我来问一个问题：大家觉得我可爱吗？喜欢我的朋友，在评论区告诉我！","audioUrl":"/api/voice-call/stage-audio?asset=audience-interaction.ec7fed66ab46fe5f.mp3","durationSeconds":8.04},{"id":"picture-rules","title":"游戏一：看图抢答","subtitle":"看图抢答 · 四轮，每轮四题","text":"各位轻友，考验眼力和手速的时候到了！接下来，我们来玩“看图抢答”！四位轻友各自为战，两位产品老师担任求助嘉宾。游戏一共四轮，每轮四题。\n每道题，屏幕上会出现一张局部图片。看清楚，等主持人喊完“3、2、1，举手”，就可以抢答！被主持人点到的朋友，请在十秒内给出答案，也可以使用手里的求助卡。\n每位轻友有两张求助卡，分别对应两位产品老师，每位老师可以帮你一次。四轮比赛都用这两张卡，什么时候出手，由你决定！求助后，老师提供建议，再由你确认最终答案。记得在正式回答之前用卡，每题最多用一张。\n答对一道，拿一张得分卡！求助后答对，同样得分。答错或者超时，其他轻友还有一次抢答机会。两次都没答对，主持人就会揭晓答案。如果没人举手，我们会放大图片，再给大家一次机会。\n直播间的朋友，福利来了！每轮现场答对一道题，奖池增加五张！额度随机，五十到二百都有，所以大家也可以多多参与，在评论区给我们的轻友提提示，他们能看到你们的评论哦！认出来了就赶紧打出来，一起把这轮奖池冲到二十张！\n每轮结束，我们会公布这一轮赢下的代金券数量，放出抽奖助手二维码。大家扫码参与，五分钟后开奖！现场的四位轻友，直播间这轮能抽多少，就看你们的表现了！\n求助卡准备好了吗？接下来交给主持人，准备上图！","audioUrl":"/api/voice-call/stage-audio?asset=picture-rules.a35c4fbb464518b6.mp3","durationSeconds":107.424},{"id":"quick-quiz-rules","title":"游戏二：快问快答","subtitle":"直播间答题 · 两轮，每轮六题 · 现场六位轮流截屏","text":"接下来进入“快问快答”！直播间的朋友，准备好，这一场由你们答题，四位轻友和两位产品同学轮流帮大家截屏抽奖！\n游戏一共两轮，每轮六道题。每道题都有 A、B、C、D 四个选项，只有一个正确答案。主持人读完题目和选项，大家就可以在评论区打出你选的字母。\n随后，我们一起倒数“3、2、1”，轮到的轻友截屏，主持人公布答案，从这张截图里选择答对的幸运观众送代金券！大家看完题就赶紧发答案，争取出现在截图里！\n答对就有机会赢取代金券。每道题都跟上，下一张代金券就可能是你的！\n如果截图里没有人答对，助播会从本题截止前的答题记录中继续查找；这一题确实没人答对，代金券就留到下一题。\n直播间准备打答案，现场六位准备截屏。主持人，请出第一题！","audioUrl":"/api/voice-call/stage-audio?asset=quick-quiz-rules.2b818d706fefd681.mp3","durationSeconds":62.736},{"id":"new-year-wish","title":"新年许愿","subtitle":"收尾 · 先祝福，再许愿","text":"祝 Lighthouse 生日快乐！也祝每一位轻友，新的一年工作顺利、生活开心，部署少踩坑，服务稳稳跑，灵感不断电！\n今天能和大家一起聊天、一起玩游戏，小云特别开心。谢谢大家分享自己的故事，也谢谢直播间的朋友们一直陪着我们。希望今晚给大家留下了几段开心的回忆！\n接下来，小云也想许个愿！\n希望新的一年，Lighthouse 越来越好用，轻友团越来越热闹。让刚接触云的小伙伴，也能顺利迈出第一步；让已经有想法的轻友们，都能找到机会动手试一试。\n也希望明年再聚的时候，能听到大家更多的新故事：做出了什么有趣的小工具，认识了什么样的 AI 伙伴，又解决了哪些让自己头疼的问题。到时候，小云还想继续听你们分享！\n新的一年，希望我们都能多一点灵感，多一点行动，也多一点相聚的机会。一起创造更多好玩的可能！","audioUrl":"/api/voice-call/stage-audio?asset=new-year-wish.bc90585ad83bb003.mp3","durationSeconds":64.176}];
function stageCueTime(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  return Math.floor(value / 60) + ':' + String(value % 60).padStart(2, '0');
}
const STAGE_CUE_STYLE = `
.va-cues { position:fixed; z-index:2147483001; box-sizing:border-box; display:flex; flex-direction:column; background:#1e2130; color:#e8eaf2; border:1px solid #3a3f56; border-radius:16px; box-shadow:0 12px 40px #0006; overflow:hidden; font:13px/1.5 system-ui,sans-serif; }
.va-cues * { box-sizing:border-box; }
.va-cues-head { flex:none; display:flex; align-items:center; gap:12px; padding:14px 16px; border-bottom:1px solid #3a3f56; background:#262a3d; }
.va-cues-heading { flex:1; }
.va-cues-title { margin:0; font-size:16px; font-weight:700; }
.va-cues-caption { margin-top:3px; color:#aab2c9; font-size:11px; }
.va-cues button { cursor:pointer; font:inherit; }
.va-cues button:disabled { cursor:default; opacity:.5; }
.va-cues button:focus-visible,.va-cues textarea:focus-visible { outline:2px solid #b6b0ff; outline-offset:3px; }
.va-cues-close { border:0; padding:6px; color:#b8c1d8; background:transparent; }
.va-cues-list { min-height:0; overflow:auto; overscroll-behavior:contain; flex:1; padding:12px; display:flex; flex-direction:column; gap:10px; scrollbar-width:thin; scrollbar-color:#48516d transparent; }
.va-cue { flex:none; border:1px solid #3a415b; border-radius:12px; padding:12px; background:#262b3e; }
.va-cue[data-active="true"] { border-color:#a49aff; background:#302d4d; }
.va-cue-top { display:flex; align-items:center; gap:9px; }
.va-cue-index { display:grid; place-items:center; width:28px; height:28px; border-radius:8px; color:#c6c0ff; background:#7870c126; font-size:12px; font-variant-numeric:tabular-nums; }
.va-cue-heading { flex:1; min-width:0; }
.va-cue-heading h3 { margin:0; font-size:13px; color:#f3f1ff; }
.va-cue-subtitle { margin-top:2px; font-size:10px; color:#aab2c9; }
.va-cue-play { border:0; border-radius:8px; padding:7px 10px; color:white; background:#7161d9; white-space:nowrap; }
.va-cue-text { white-space:pre-wrap; overflow-wrap:anywhere; margin:10px 0 8px; color:#c8cfe2; font-size:12px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.va-cue-text.expanded { display:block; }
.va-cue-actions { display:flex; gap:12px; align-items:center; color:#8f9ab6; font-size:10px; }
.va-cue-link { border:0; background:transparent; padding:0; color:#bdb5ff; font-size:11px!important; }
.va-cue-actions span { margin-left:auto; }
.va-cues-footer { flex:none; padding:12px 14px; border-top:1px solid #3a3f56; background:#202537; }
.va-cues-player { display:flex; align-items:center; gap:8px; }
.va-cues-player-text { flex:1; min-width:0; font-size:12px; }
.va-cues-player-title { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.va-cues-progress { height:3px; border-radius:3px; background:#343b54; margin-top:8px; overflow:hidden; }
.va-cues-progress span { display:block; height:100%; background:#aaa0ff; }
.va-cues-stop { border:1px solid #786073; background:#47333f; color:#ffd4de; border-radius:8px; padding:6px 9px; }
.va-cues-coordinates { margin:10px 0 0; color:#99a7c4; font-size:10px; }
.va-cues-coordinates summary { cursor:pointer; }
.va-cues-coordinates dl { display:grid; grid-template-columns:repeat(4,1fr); gap:6px; margin:8px 0 0; }
.va-cues-coordinates dt { color:#7f8ca8; }
.va-cues-coordinates dd { margin:0; color:#c8d2e9; font-variant-numeric:tabular-nums; }
.va-cues-toggle { position:fixed; z-index:2147483001; border:1px solid #635c8e; border-radius:8px; padding:7px 10px; background:#292a44; color:#d8d2ff; font:12px system-ui; cursor:pointer; }
.va-live-map { background:#202538; border:1px solid #414c70; border-radius:12px; overflow:hidden; }
.va-live-map-heading { padding:12px 14px 0; display:flex; justify-content:space-between; align-items:center; gap:8px; }
.va-live-map-heading strong { color:#e6fff3; font-size:14px; }
.va-live-map-heading span { font-size:11px; color:#aab6d1; }
.va-live-map-legend { padding:6px 14px 0; display:flex; gap:14px; font-size:11px; color:#aab6d1; }
.va-live-map-legend i { display:inline-block; width:7px; height:7px; margin-right:5px; border-radius:50%; background:#65dfac; }
.va-live-map-legend .next i { background:#b0a0ff; }
.va-live-map svg { display:block; width:100%; height:auto; font-family:system-ui,-apple-system,"PingFang SC",sans-serif; }
.va-live-map-node { cursor:pointer; outline:none; }
.va-live-map-node .node-box { fill:#2d344b; stroke:#53617f; stroke-width:1.4; }
.va-live-map-node[data-current="true"] .node-box { fill:#174637; stroke:#6be4b2; stroke-width:2.5; }
.va-live-map-node[data-current="true"][data-state="error"] .node-box { fill:#592d3b; stroke:#ff9caf; }
.va-live-map-node[data-current="true"][data-state="waiting"] .node-box { fill:#58472a; stroke:#f6ce7e; }
.va-live-map-node[data-next="true"] .node-box { stroke:#b3a3ff; stroke-width:2; stroke-dasharray:5 3; }
.va-live-map-node:focus-visible .node-box,.va-live-map-node:hover .node-box { stroke:#e5deff; stroke-width:2.5; }
.va-live-map-node .node-name { fill:#edf1ff; font-size:15px; font-weight:600; }
.va-live-map-node .node-note { fill:#aebbd4; font-size:11px; }
.va-live-map-node[data-current="true"] .node-note { fill:#b8f3d8; }
.va-live-map-edge { cursor:pointer; outline:none; }
.va-live-map-edge path.route { fill:none; stroke:#596881; stroke-width:1.5; }
.va-live-map-edge[data-next="true"] path.route { stroke:#b3a3ff; stroke-width:2.8; stroke-dasharray:6 4; }
.va-live-map-edge:focus-visible path.route,.va-live-map-edge:hover path.route { stroke:#dbd2ff; stroke-width:2.5; }
.va-live-map-edge text { fill:#aab7cf; font-size:11px; paint-order:stroke; stroke:#202538; stroke-width:5px; stroke-linejoin:round; }
.va-live-map-edge[data-next="true"] text { fill:#ddd3ff; font-weight:600; }
.va-live-map-inspector { margin:0 12px 12px; padding:10px 12px; border-radius:8px; background:#2b3149; color:#c9d3e8; font-size:12px; line-height:1.6; }
.va-live-map-inspector strong { color:#edf1ff; }
.va-live-map-inspector button { margin-left:8px; border:0; background:transparent; color:#b9acff; font-size:11px; }
.va-live-map-metrics { display:flex; flex-wrap:wrap; gap:8px 16px; margin:8px 0; color:#b4bfd5; font-size:11px; }
`;

// BEGIN LIVE STATE GRAPH
/** Project the server's current stage and next step onto the visible flow. */
function liveGraphModel(machine) {
  const currentId=machine.current.id;
  const returning=currentId==='advancing'||currentId==='waiting'&&machine.next.id!=='waiting';
  const nextId=currentId==='closing'?'ended':returning?'scheduling':machine.next.id;
  const currentLabel=machine.current.label;
  const nextCondition=currentId==='closing'?'告别整段音频播放完毕，停止人声和背景音乐':currentId==='advancing'?'Chrome 确认新页面内容后，再选择下一段要讲什么':returning?'连接或页面已恢复，重新选择下一轮要讲什么':machine.next.condition;
  const metrics=machine.metrics;
  const rule=id=>machine.transitions.find(item=>item.id===id);
  const saleMode=machine.flashSale?.configured;
  const nodes=[
    ['idle',24,16,148,48,'等你开始'],['opening',222,16,148,48,'欢迎观众'],['ended',424,16,148,48,'人声与 BGM 停止'],
    ['source',24,128,148,58,'讲一个完整段落'],['scheduling',231,128,138,68,'选择下一步'],['closing',424,128,148,58,'感谢观众 · 说再见'],
    ['comment',24,286,148,58,'看最近100条弹幕'],['engagement',222,286,148,58,'提问 · 点赞 · 分享'],['advancing',424,286,148,58,'等待新画面确认'],
    ['lottery-announcement',24,418,148,58,'大礼 · 参与口令'],['lottery-wait',222,418,148,58,'十秒参与 · 语音互动'],['lottery-result',424,418,148,58,'首条匹配弹幕中奖'],
    ['waiting',24,552,244,50,'连接、页面或手动翻页'],['error',328,552,244,50,'处理问题后重新开始'],
  ].filter(row=>!saleMode||!row[0].startsWith('lottery-')).concat(saleMode?[['flash-sale',24,418,548,58,'右上角二维码 · 翻页照常 · 倒计时收起']]:[]).map(([id,x,y,width,height,note])=>({...machine.nodes.find(node=>node.id===id),id,x,y,width,height,note,current:id===currentId,next:id===nextId}));
  const edges=[
    ['idle','opening','M172 40H222',197,29,'开始','素材与监听就绪，点击「开始 AI 直播」'],
    ['ended','opening','M424 40H370',397,29,'再开始','再次点击开始，重新欢迎观众'],
    ['opening','scheduling','M296 64V128',322,103,'播完','欢迎整段音频播放完毕'],
    ['scheduling','opening','M304 128V64',0,0,'','本次直播还没有欢迎观众，先完成开场'],
    ['scheduling','source','M231 162H172',201,149,'继续','主题还有内容，当前没有更高优先级的待办'],
    ['source','scheduling','M98 186V215H266V181',144,211,'播完','当前整轮音频全部播放完，再检查弹幕、互动与翻页'],
    ['scheduling','comment','M251 172L207 246H98V286',126,268,'新弹幕到频率',rule('comment')?.condition||'有未读弹幕，且达到设置的回应频率'],
    ['comment','scheduling','M172 315H200V220H280V187',0,0,'','弹幕回应整段播完，重新选择下一步；主线还有内容时先继续讲解'],
    ['scheduling','engagement','M300 196V286',300,262,'AI 安排 · 到间隔',`AI 安排了互动，且已间隔 ${metrics.engagementMinTurns} 段讲解和 ${metrics.engagementCooldownSeconds} 秒；到频率的弹幕优先`],
    ['engagement','scheduling','M222 315H200V220H280V187',0,0,'','互动整段播放完毕，回到直播主线'],
    ['scheduling','advancing','M349 173V246H498V286',477,268,'讲完本页',rule('advancing')?.condition||'本页讲完，自动翻页开启，且还有下一页'],
    ['advancing','scheduling','M424 315H396V220H320V187',0,0,'','Chrome 确认新页面内容，重新选择下一轮'],
    ['scheduling','closing','M369 162H424',397,149,'要结束',rule('closing')?.condition||'场控请求结束，或最后一页已讲完'],
    ['closing','ended','M498 128V64',539,103,'告别播完','告别整段音频播放完毕，停止人声和背景音乐'],
    ['scheduling','waiting','M307 194H382V532H146V552',149,539,'尚未就绪','监听或页面暂不可用；关闭自动翻页时也可能等待场控翻页'],
    ['waiting','scheduling','M244 552V510H214V224H270V185',260,517,'恢复后继续','连接恢复、读到页面内容或场控完成手动翻页后继续'],
    ['scheduling','error','M357 169H386V532H450V552',452,539,'出现异常','模型生成、语音合成、播放或翻页发生错误时暂停'],
    ['error','opening','M572 577H588V5H296V16',0,0,'','处理故障后点击开始，再次欢迎观众'],
    ['scheduling','lottery-announcement','M231 162H10V396H98V418',93,392,'场控排队',rule('lottery-announcement')?.condition||'当前整段结束后进入场控排队的抽奖'],
    ['lottery-announcement','lottery-wait','M172 447H222',197,434,'说明播完','参与方式整段播完后开始计时，只收集此后读到的新弹幕'],
    ['lottery-wait','lottery-result','M370 447H424',397,434,'时间到','参与时间结束且互动音频完整播完；按接收顺序确定第一条匹配口令的弹幕'],
    ['lottery-result','scheduling','M498 418V374H386V220H320V187',0,0,'','开奖结果整段播完，继续讲解、弹幕或翻页'],
    ['lottery-announcement','scheduling','M98 418V374H200V220H280V187',0,0,'','抽奖被取消后，当前整段播完再调度'],
    ['lottery-wait','scheduling','M296 418V374H200V220H280V187',0,0,'','场控取消抽奖或请求结束，当前整段互动播完后再调度'],
  ].filter(row=>!saleMode||!row[0].startsWith('lottery-')&&!row[1].startsWith('lottery-')).concat(saleMode?[['scheduling','flash-sale','M231 162H10V396H98V418',93,392,'定时 / 手动排队','指定起止时间范围内按设置间隔定时安排，或场控手动安排；当前整段结束后显示二维码，讲解和翻页照常继续'],['flash-sale','scheduling','M498 418V374H386V220H320V187',0,0,'','二维码展示期间继续讲解、弹幕与翻页，倒计时结束后独立收起']]:[]).map(([from,to,path,x,y,label,condition])=>({from,to,path,x,y,label,condition,key:from+':'+to,next:from===currentId&&to===nextId}));
  return {currentId,currentLabel,nextId,nextCondition,nodes,edges};
}

function LiveStateGraph({machine}) {
  const [selection,setSelection]=React.useState(null);
  const id=React.useId().replaceAll(':','');
  const model=liveGraphModel(machine);
  const selectedNode=model.nodes.find(node=>node.id===selection?.node);
  const selectedEdge=model.edges.find(edge=>edge.key===selection?.edge);
  const visibleEdge=edge=>edge.next||selectedEdge?.key===edge.key||selectedNode?.id===edge.from||selectedNode?.id===edge.to||!['source','comment','engagement','advancing','waiting','error','ended','lottery-announcement','lottery-wait','lottery-result'].includes(edge.from)&&!['scheduling:opening','scheduling:waiting','scheduling:error'].includes(edge.key);
  const choose=(value,event)=>{if(!event||event.key==='Enter'||event.key===' '){event?.preventDefault();setSelection(value)}};
  const edgeView=edge=>e('g',{key:edge.key,className:'va-live-map-edge',role:'button',tabIndex:0,'aria-label':`查看转移：${model.nodes.find(node=>node.id===edge.from)?.label}到${model.nodes.find(node=>node.id===edge.to)?.label}`,'data-edge':edge.key,'data-next':edge.next,onClick:()=>choose({edge:edge.key}),onKeyDown:event=>choose({edge:edge.key},event)},
    e('title',null,edge.condition),
    e('path',{d:edge.path,fill:'none',stroke:'transparent',strokeWidth:14,pointerEvents:'stroke'}),
    e('path',{className:'route',d:edge.path,markerEnd:`url(#${id}-${edge.next?'next':'normal'})`,strokeDasharray:!edge.next&&['source','comment','engagement','advancing','waiting'].includes(edge.from)?'3 4':undefined}),
    edge.label?e('text',{x:edge.x,y:edge.y,textAnchor:'middle'},edge.label):null);
  return e('div',{className:'va-live-map'},
    e('div',{className:'va-live-map-heading',role:'status'},e('strong',null,'现在：'+model.currentLabel),e('span',null,machine.current.execution)),
    e('div',{className:'va-live-map-legend'},e('span',null,e('i'),'当前节点'),e('span',{className:'next'},e('i'),'虚线：下一步'),e('span',null,'点击节点或箭头查看条件')),
    e('svg',{viewBox:'0 0 600 624',role:'group','aria-label':'直播状态流程图'},
      e('defs',null,['normal','next'].map(kind=>e('marker',{key:kind,id:`${id}-${kind}`,viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:6,markerHeight:6,orient:'auto-start-reverse'},e('path',{d:'M0 0L10 5L0 10Z',fill:kind==='next'?'#b3a3ff':'#596881'})))),
      model.edges.filter(edge=>!edge.next&&visibleEdge(edge)).map(edgeView),model.edges.filter(edge=>edge.next).map(edgeView),
      model.nodes.map(node=>e('g',{key:node.id,className:'va-live-map-node',role:'button',tabIndex:0,'aria-label':'查看状态：'+node.label,'data-state':node.id,'data-current':node.current,'data-next':node.next,onClick:()=>choose({node:node.id}),onKeyDown:event=>choose({node:node.id},event)},
        e('title',null,node.description),
        node.id==='scheduling'?e('polygon',{className:'node-box',points:'300,128 369,162 300,196 231,162'}):e('rect',{className:'node-box',x:node.x,y:node.y,width:node.width,height:node.height,rx:10}),
        e('text',{className:'node-name',x:node.x+node.width/2,y:node.y+(node.id==='scheduling'?40:23),textAnchor:'middle'},node.id==='scheduling'?'选择下一步':node.label),
        node.id!=='scheduling'?e('text',{className:'node-note',x:node.x+node.width/2,y:node.y+node.height-10,textAnchor:'middle'},node.note):null,
        node.current?e('g',null,e('rect',{x:node.x+node.width-37,y:node.y-7,width:35,height:14,rx:5,fill:node.id==='error'?'#d57891':'#65dfac'}),e('text',{x:node.x+node.width-20,y:node.y+3,fontSize:9,fontWeight:700,textAnchor:'middle',fill:'#142b26'},'当前')):null
      )),
      e('text',{x:300,y:506,textAnchor:'middle',fill:'#aebbd4',fontSize:11,paintOrder:'stroke',stroke:'#202538',strokeWidth:4},machine.flashSale?.configured?'讲解 / 弹幕 / 互动 / 秒杀：整段结束后调度':'讲解 / 弹幕 / 互动 / 抽奖：整段结束后调度'),
      e('text',{x:300,y:530,textAnchor:'middle',fill:'#8f9bb4',fontSize:10},'连接未就绪或发生错误时，进入下面的等待 / 暂停状态')
    ),
    e('div',{className:'va-live-map-inspector'},
      e('strong',null,selectedEdge?'转移条件':selectedNode?'查看：'+selectedNode.label:'下一步：'+model.nodes.find(node=>node.id===model.nextId)?.label),
      selection?e('button',{onClick:()=>setSelection(null)},'跟随当前'):null,
      e('div',null,selectedEdge?selectedEdge.condition:selectedNode?selectedNode.description:model.nextCondition),
      selectedNode&&model.edges.some(edge=>edge.to===selectedNode.id)?e('div',null,'进入条件：'+model.edges.filter(edge=>edge.to===selectedNode.id).map(edge=>edge.condition).join('；')):null,
      selectedNode?e('div',null,'之后：'+model.edges.filter(edge=>edge.from===selectedNode.id).map(edge=>model.nodes.find(node=>node.id===edge.to)?.label).filter((label,index,all)=>all.indexOf(label)===index).join(' / ')):null
    )
  );
}
// END LIVE STATE GRAPH

// BEGIN FLASH SALE SCHEDULE
/** Format the explicit Beijing time without depending on this computer's timezone. */
function flashSaleTimeInput(value){return value==null?'':new Date(value+8*3600000).toISOString().slice(0,16)}
function flashSaleTimeValue(value){
  if(!value)return null;
  const time=Date.parse(value+':00+08:00');
  if(!Number.isFinite(time)||flashSaleTimeInput(time)!==value)throw new Error('请输入有效的北京时间');
  return time;
}
function flashSaleTimeLabel(value){return value==null?'':new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value))}
function flashSaleScheduleLabel(sale){
  if(sale.scheduleState==='disabled')return '自动展示已关闭，可手动安排';
  if(sale.scheduleState==='ended')return '秒杀时间已结束，不再自动安排';
  if(sale.scheduleState==='complete'||sale.nextAt==null)return '时间范围内已没有待触发的秒杀';
  return (sale.scheduleState==='waiting'?'未到开始时间 · 首场：':'下次秒杀：')+flashSaleTimeLabel(sale.nextAt)+'（北京时间）';
}
// END FLASH SALE SCHEDULE

function FlashSalePanel({status,request,onStatus}) {
  const sale=status.flashSale;
  const [enabled,setEnabled]=React.useState(sale.config.enabled);
  const [minutes,setMinutes]=React.useState(sale.config.durationSeconds/60);
  const [intervalMinutes,setIntervalMinutes]=React.useState(sale.config.intervalMinutes);
  const [starts,setStarts]=React.useState(flashSaleTimeInput(sale.config.startAt));
  const [ends,setEnds]=React.useState(flashSaleTimeInput(sale.config.endAt));
  const [busy,setBusy]=React.useState(false);
  const [error,setError]=React.useState('');
  const [dirty,setDirty]=React.useState(false);
  React.useEffect(()=>{if(!dirty){setEnabled(sale.config.enabled);setIntervalMinutes(sale.config.intervalMinutes);setMinutes(sale.config.durationSeconds/60);setStarts(flashSaleTimeInput(sale.config.startAt));setEnds(flashSaleTimeInput(sale.config.endAt))}},[sale.config.enabled,sale.config.intervalMinutes,sale.config.durationSeconds,sale.config.startAt,sale.config.endAt,dirty]);
  const send=async body=>{setBusy(true);setError('');try{const result=await request(body);if(!result.ok)throw new Error(result.error||'操作失败');onStatus(result.status);if(body.action==='configure')setDirty(false)}catch(error){setError(String(error.message||error))}finally{setBusy(false)}};
  const locked=sale.active||sale.queued;
  const save=()=>{try{const startAt=flashSaleTimeValue(starts),endAt=flashSaleTimeValue(ends);if(startAt!==null&&endAt!==null&&endAt<=startAt)throw new Error('秒杀结束时间必须晚于开始时间');send({action:'configure',config:{...sale.config,enabled,intervalMinutes,durationSeconds:minutes*60,startAt,endAt}})}catch(error){setError(String(error.message||error))}};
  return e('div',{className:'va-set',style:{border:'1px solid #7669a9',marginTop:12}},
    e('strong',null,'整点秒杀 · 二维码浮层'),
    e('div',{className:'va-hint',role:'status'},sale.active?'正在展示 · 剩余 '+Math.floor(sale.remainingSeconds/60)+':'+String(sale.remainingSeconds%60).padStart(2,'0'):sale.queued?'已排队，当前整段播完后展示':flashSaleScheduleLabel(sale)),
    e('div',{className:'va-hint'},'二维码固定在 PPT 右上角，展示期间照常讲解、回应弹幕和翻页；倒计时结束自动收起。'),
    e('a',{href:sale.config.link,target:'_blank',rel:'noopener noreferrer',style:{color:'#bcb2ff',overflowWrap:'anywhere'}},'固定秒杀入口 ↗'),
    e('label',{style:{display:'block',marginTop:10}},e('input',{type:'checkbox',checked:enabled,disabled:busy||locked,onChange:event=>{setEnabled(event.target.checked);setDirty(true)}}),' 启用自动秒杀（北京时间）'),
    e('label',{style:{display:'flex',gap:8,alignItems:'center',marginTop:10}},'秒杀间隔',e('select',{className:'va-input',value:intervalMinutes,disabled:busy||locked,'aria-label':'秒杀间隔（分钟）',style:{width:120},onChange:event=>{setIntervalMinutes(Number(event.target.value));setDirty(true)}},[5,10,15,30,60].map(value=>e('option',{key:value,value},value+' 分钟')))),
    e('label',{style:{display:'block',marginTop:10}},'秒杀开始时间（北京时间）',e('input',{className:'va-input',type:'datetime-local',step:60,'aria-label':'秒杀开始时间（北京时间）',value:starts,disabled:busy||locked,style:{marginTop:5,colorScheme:'dark',maxWidth:'100%'},onChange:event=>{setStarts(event.target.value);setDirty(true)}})),
    e('label',{style:{display:'block',marginTop:10}},'秒杀结束时间（北京时间）',e('input',{className:'va-input',type:'datetime-local',step:60,'aria-label':'秒杀结束时间（北京时间）',value:ends,min:starts||undefined,disabled:busy||locked,style:{marginTop:5,colorScheme:'dark',maxWidth:'100%'},onChange:event=>{setEnds(event.target.value);setDirty(true)}})),
    e('div',{className:'va-hint'},'开始时间到后，按所选间隔对齐时钟安排；15 分钟对应每小时 00、15、30、45 分，60 分钟对应整点。结束时间起不再新增；手动展示不受范围限制。'),
    e('label',{style:{display:'flex',gap:8,alignItems:'center',marginTop:8}},'展示时长',e('input',{className:'va-input',type:'number',min:1,max:15,step:1,value:minutes,disabled:busy||locked,'aria-label':'秒杀二维码展示分钟',style:{width:80},onChange:event=>{setMinutes(Number(event.target.value));setDirty(true)}}),'分钟'),
    e('div',{className:'va-row',style:{flexWrap:'wrap',marginTop:10}},
      e('button',{className:'va-btn ghost',disabled:busy||locked||!dirty,onClick:save},'保存秒杀设置'),
      e('button',{className:'va-btn',disabled:busy||!status.running||status.paused||sale.active||sale.queued,onClick:()=>send({action:'show'})},sale.queued?'展示已排队':'展示秒杀码'),
      sale.active||sale.queued?e('button',{className:'va-btn ghost',disabled:busy,onClick:()=>send({action:'hide'})},sale.queued?'取消排队':'提前收起'):null),
    status.presentation?.open&&!status.presentation.flashSaleSupported?e('div',{className:'va-hint'},'当前演示页不支持二维码浮层，请打开新版合并演示稿。'):null,
    sale.lastReason?e('div',{className:'va-hint'},sale.lastReason):null,
    error?e('div',{className:'va-error',role:'alert'},error):null
  );
}


function StageCuePanel({ anchorRef, anchorKey, playback, speed, onPlay, onStop }) {
  const [layout, setLayout] = React.useState(null);
  const [expanded, setExpanded] = React.useState(null);
  const [collapsed, setCollapsed] = React.useState(false);
  const [floatingOpen, setFloatingOpen] = React.useState(false);
  React.useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const measure = () => {
      const rect = anchor.getBoundingClientRect();
      const canvas = anchor.querySelector('.va-avatar-canvas')?.getBoundingClientRect();
      const available = rect.left - 24;
      const compact = available < 260;
      const width = compact ? Math.min(380, window.innerWidth - 24) : Math.min(380, available);
      const top = compact ? 12 : Math.max(12, rect.top);
      const next = { compact, left:compact ? 12 : rect.left - width - 12, top, width,
        height:Math.min(rect.height, window.innerHeight - top - 12),
        toggleTop:Math.max(12, Math.min(rect.top, window.innerHeight - 50)),
        canvas:canvas ? { x:canvas.x, y:canvas.y, width:canvas.width, height:canvas.height } : null };
      setLayout(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    measure();
    const observer = new window.ResizeObserver(measure);
    observer.observe(anchor);
    const canvas = anchor.querySelector('.va-avatar-canvas');
    if (canvas) observer.observe(canvas);
    window.addEventListener('resize', measure);
    anchor.addEventListener('scroll', measure, true);
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); anchor.removeEventListener('scroll', measure, true); };
  }, [anchorRef, anchorKey]);
  if (!layout) return null;
  const active = playback.phase === 'loading' || playback.phase === 'playing';
  const hidden = collapsed || (layout.compact && !floatingOpen);
  if (hidden) return e('button', { className:'va-cues-toggle', style:{left:layout.compact ? 12 : layout.left + layout.width - 100, top:layout.toggleTop}, onClick:() => { setCollapsed(false); setFloatingOpen(true); } }, '展开场控口播');
  const message = playback.phase === 'loading' ? '加载预合成音频…' : playback.phase === 'playing' ? `正在播报 · ${stageCueTime(playback.elapsedSeconds)} / ${stageCueTime(playback.durationSeconds)}` : playback.phase === 'done' ? '播报完成' : playback.phase === 'stopped' ? '已停止' : playback.phase === 'error' ? '播报失败，请重试' : '选择一条口播开始';
  return e('aside', { className:'va-cues', role:'region', 'aria-label':'场控口播', style:{left:layout.left, top:layout.top, width:layout.width, height:layout.height} },
    e('div', {className:'va-cues-head'},
      e('div', {className:'va-cues-heading'}, e('h2', {className:'va-cues-title'}, '场控口播'), e('div', {className:'va-cues-caption'}, '预合成音频 · '+speed+' 倍速 · 点击即播')),
      e('button', {className:'va-cues-close', 'aria-label':'收起场控口播', onClick:() => {setCollapsed(true);setFloatingOpen(false);}}, '‹')
    ),
    e('div', {className:'va-cues-list'}, STAGE_CUES.map((cue,index) => {
      const text = cue.text;
      const selected = active && playback.id === cue.id;
      return e('article', {className:'va-cue', key:cue.id, 'data-cue-id':cue.id, 'data-active':selected},
        e('div', {className:'va-cue-top'},
          e('span', {className:'va-cue-index'}, String(index + 1).padStart(2,'0')),
          e('div', {className:'va-cue-heading'}, e('h3',null,cue.title),e('div',{className:'va-cue-subtitle'},cue.subtitle)),
          e('button', {className:'va-cue-play', disabled:!text.trim(), 'aria-label':'播放：'+cue.title, onClick:() => onPlay(cue.id)},selected ? '↻ 重播' : '▶ 播报')
        ),
        e('p',{className:'va-cue-text'+(expanded===cue.id?' expanded':'')},text),
        e('div',{className:'va-cue-actions'},
          e('button',{className:'va-cue-link',onClick:()=>setExpanded(expanded===cue.id?null:cue.id),'aria-expanded':expanded===cue.id},expanded===cue.id?'收起全文':'查看全文'),
          e('span',null,'已预合成 · '+stageCueTime(cue.durationSeconds / speed))
        )
      );
    })),
    e('div',{className:'va-cues-footer'},
      e('div',{className:'va-cues-player'},
        e('div',{className:'va-cues-player-text',role:'status'},e('div',{className:'va-cues-player-title'},playback.title || '固定口播'),e('div',{className:'va-cues-caption'},message)),
        e('button',{className:'va-cues-stop',disabled:!active,onClick:() => onStop(),'aria-label':'停止口播'},'■ 停止')
      ),
      e('div',{className:'va-cues-progress','aria-hidden':true},e('span',{style:{width:playback.durationSeconds ? (playback.phase==='done' ? 100 : Math.min(100,(playback.elapsedSeconds || 0)/playback.durationSeconds*100))+'%' : '0%'}})),
      e('details',{className:'va-cues-coordinates'},
        e('summary',null,'绿幕坐标 · 页面像素'),
        layout.canvas ? e('dl',null,
          [['X',layout.canvas.x],['Y',layout.canvas.y],['宽',layout.canvas.width],['高',layout.canvas.height]].map(([key,value]) =>
            e('div',{key},e('dt',null,key),e('dd',null,Number(value.toFixed(2))))
          )
        ) : e('p',null,'切回「通话」页可查看绿幕坐标。')
      )
    )
  );
}

// BEGIN TENCENT SPEECH SEGMENTS
const splitTencentSpeech = text => {
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
// END TENCENT SPEECH SEGMENTS

// BEGIN BACKGROUND MUSIC CONTROLLER
const BGM_TRACKS = [
  {
    "id": "gymnopedie",
    "title": "轻柔钢琴 · Gymnopédie No.1",
    "url": "/live-bgm/gymnopedie-no1.67cf2c79a9758331.mp3",
    "source": "https://commons.wikimedia.org/wiki/File:Gymnopedie_No._1..ogg",
    "credit": "Erik Satie · Teknopazzo 音源 · CC0"
  },
  {
    "id": "raspberry-jam",
    "title": "Funk 律动 · Raspberry Jam",
    "url": "/live-bgm/raspberry-jam.3ba57da085ef24b0.mp3",
    "source": "https://opengameart.org/content/raspberry-jam",
    "credit": "congusbongus · CC0"
  },
  {
    "id": "upbeat-loop",
    "title": "轻快鼓点 · Upbeat Loop",
    "url": "/live-bgm/upbeat-loop.5990e9d7138f92ae.mp3",
    "source": "https://opengameart.org/content/upbeat-short-music-loop-vorbis-oog",
    "credit": "BenjaTheMaker · CC0"
  },
  {
    "id": "dance-field",
    "title": "动感电子 · Dance Field",
    "url": "/live-bgm/dance-field.fe6dd5f47f57bf17.mp3",
    "source": "https://opengameart.org/content/dance-field",
    "credit": "Centurion_of_war · CC0"
  }
];
const backgroundTrack = id => BGM_TRACKS.find(track => track.id === id) || BGM_TRACKS[0];
const createBackgroundMusic = ({onState, environment = window}) => {
  let audio = null, source = '', phase = 'idle', error = '', wanted = false, disposed = false, sequence = 0;
  let volume = .16, duck = true, speaking = false, frame = null, release = null;
  const state = () => ({phase,error,volume,ducked:phase === 'playing' && duck && speaking});
  const publish = () => { if (!disposed) onState(state()); };
  const cancelFade = () => { if (frame !== null) environment.cancelAnimationFrame(frame); frame = null; };
  const target = () => volume * (duck && speaking ? .3 : 1);
  const fade = (level, duration) => {
    cancelFade();
    if (!audio) return;
    const node = audio;
    if (environment.document?.hidden) { node.volume = level; return; }
    const from = node.volume, start = environment.performance.now();
    const tick = now => {
      if (disposed || node !== audio) return;
      const progress = Math.min(1, Math.max(0, (now - start) / duration));
      node.volume = Math.max(0, Math.min(1, from + (level - from) * progress));
      frame = progress < 1 ? environment.requestAnimationFrame(tick) : null;
    };
    frame = environment.requestAnimationFrame(tick);
  };
  const visibilityChanged = () => { if (!disposed && phase === 'playing') fade(target(),180); };
  environment.document?.addEventListener('visibilitychange',visibilityChanged);
  const clearAudio = () => {
    cancelFade();
    if (!audio) return;
    audio.onplaying = audio.onpause = audio.onerror = null;
    audio.pause(); audio.removeAttribute('src'); audio.load(); audio = null;
  };
  const play = async () => {
    if (disposed || !audio) return false;
    wanted = true; error = ''; phase = 'loading'; publish();
    const node = audio, run = ++sequence;
    try {
      await node.play();
      if (disposed || run !== sequence || node !== audio || !wanted) return false;
      phase = 'playing'; fade(target(), 600); publish(); return true;
    } catch (cause) {
      if (disposed || run !== sequence || node !== audio) return false;
      wanted = false; phase = 'error';
      error = cause?.name === 'NotAllowedError' ? '请点击「播放 BGM」启用音乐' : '音乐播放失败，请检查音频文件或网络';
      publish(); return false;
    }
  };
  return {
    state,
    setSource(url) {
      if (disposed || url === source) return;
      source = url; sequence += 1; clearAudio();
      const node = new environment.Audio(url); audio = node;
      node.loop = true; node.preload = 'auto'; node.volume = 0;
      node.onplaying = () => {
        if (disposed || node !== audio || !wanted) { node.pause(); return; }
        phase = 'playing'; fade(target(), 600); publish();
      };
      node.onpause = () => { if (!disposed && node === audio) { phase = 'paused'; publish(); } };
      node.onerror = () => { if (!disposed && node === audio) { sequence += 1; wanted = false; phase = 'error'; error = '音乐无法播放，请选择可用的音频'; publish(); } };
      if (wanted) void play();
    },
    play,
    pause() {
      wanted = false; sequence += 1; cancelFade(); audio?.pause(); phase = 'paused'; publish();
    },
    setOptions(options) {
      volume = Math.max(0, Math.min(.5, Number(options.volume) || 0)); duck = options.duck !== false;
      if (phase === 'playing') fade(target(), 180); publish();
    },
    setSpeaking(active) {
      if (disposed) return;
      if (release !== null) environment.clearTimeout(release);
      release = null;
      if (active) { speaking = true; if (phase === 'playing') fade(target(), 120); publish(); }
      else release = environment.setTimeout(() => {
        release = null; speaking = false;
        if (phase === 'playing') fade(target(), 1100); publish();
      }, 650);
    },
    dispose() {
      disposed = true; wanted = false; sequence += 1;
      if (release !== null) environment.clearTimeout(release);
      release = null; environment.document?.removeEventListener('visibilitychange',visibilityChanged); clearAudio();
    },
  };
};
// END BACKGROUND MUSIC CONTROLLER

const storedBackgroundMusic = async value => {
  const database = await new Promise((resolve,reject) => {
    const request = window.indexedDB.open('dsh.voiceBgm.v1',1);
    request.onupgradeneeded = () => request.result.createObjectStore('tracks');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise((resolve,reject) => {
      const transaction = database.transaction('tracks',value === undefined ? 'readonly' : 'readwrite');
      const request = value === undefined ? transaction.objectStore('tracks').get('custom') : transaction.objectStore('tracks').put(value,'custom');
      let result;
      request.onsuccess = () => { result = request.result; };
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('音乐保存被中止'));
    });
  } finally { database.close(); }
};

let ctxRef = null
		function Fab(props) {
			const { useSessions } = props
			const [settings, setSettings] = React.useState(loadSettings)
			const [open, setOpen] = React.useState(true)
			const [tab, setTab] = React.useState('call')
			const [calling, setCalling] = React.useState(false)
const [micMuted, setMicMuted] = React.useState(false)
const [micToggleBusy, setMicToggleBusy] = React.useState(false)
const [inputDevices, setInputDevices] = React.useState([])
const [inputDeviceBusy, setInputDeviceBusy] = React.useState(false)
const [inputError, setInputError] = React.useState('')
const [inputLevel, setInputLevel] = React.useState(0)
const [inputTesting, setInputTesting] = React.useState(false)
			const [transcript, setTranscript] = React.useState('')
			const [partial, setPartial] = React.useState('')
			const [msgs, setMsgs] = React.useState([])
			const [tasks, setTasks] = React.useState([])
			const [otherDones, setOtherDones] = React.useState([])
			const [text, setText] = React.useState('')
			const [status, setStatus] = React.useState('空闲')
			const [wake, setWake] = React.useState('asleep')
			const [busy, setBusy] = React.useState(false)
const [playback, setPlayback] = React.useState({ phase:'idle', analyser:null })
const [previewBusy, setPreviewBusy] = React.useState(false)
const [bgmState,setBgmState] = React.useState({phase:'idle',error:'',ducked:false});
const [bgmCustom,setBgmCustom] = React.useState(null);
const [waitingReply, setWaitingReply] = React.useState(false)
const [cuePlayback, setCuePlayback] = React.useState({phase:'idle',id:null,title:'',index:0,total:0})
const mainPanelRef = React.useRef(null)
			const [drag, setDrag] = React.useState(null)
			const [dedicated, setDedicated] = React.useState(null)
			const list = useSessions((s) => s)
			// 语音通话始终绑定专属会话（由 Host 保证固定 ID，跨重启保持同一会话）
			const sessionId = dedicated?.voiceSessionId || null
			const refs = React.useRef({ cueRun:null, micSource:null, inputMeter:null, inputGeneration:0, deviceBusy:false, deviceListRevision:0, inputDevices:[], ttsQueue:[], ttsJob:null, micMuted:false, micEpoch:0, micToggleBusy:false, ignoreSpeech:false, outputContext:null, outputAllowed:false, audioEpoch:0, cancelAudio:null, disposed:false, calling:false, ws: null, stream: null, actx: null, proc: null, recorder: null, chunks: [], settings, sessionId: null, since: (() => { try { return Number(window.localStorage.getItem('dsh.voiceCall.since.v1')) || 0 } catch { return 0 } })(), pollBusy: false, vad: null, vadBusy: false, ttsUntil: 0, pendingPcm: [], audioQueue: [], audioBusy: false, suppressClick: false, lastStreamText: '', lastStreamAt: 0, wake: 'asleep', sleepTimer: null })
			React.useEffect(() => { refs.current.settings = settings; refs.current.bgm?.setOptions({volume:settings.bgmVolume,duck:settings.bgmDucking}); if (!settings.bgmEnabled) pauseBgm(); }, [settings])
			React.useEffect(() => { refs.current.list = list }, [list])
React.useEffect(() => { refs.current.calling = calling }, [calling])
React.useEffect(() => {
  const media = window.navigator.mediaDevices;
  refreshInputDevices();
  const refresh = () => refreshInputDevices();
  media?.addEventListener('devicechange', refresh);
  return () => media?.removeEventListener('devicechange', refresh);
}, [])
React.useEffect(() => { if (!open) stopInputTest(); }, [open])
React.useEffect(() => { if (!settings.ttsEnabled) stopPlayback() }, [settings.ttsEnabled])
React.useEffect(() => {
 const r = refs.current; r.disposed = false;
 return () => {
  r.disposed = true; r.audioEpoch += 1; r.micEpoch++; r.audioQueue.length = 0;
  cancelSpeechRequests();
  r.inputGeneration++; stopInputMeter();
  if (r.cancelAudio) r.cancelAudio();
  r.bgm?.dispose();
  if (r.bgmCustomUrl) window.URL.revokeObjectURL(r.bgmCustomUrl);
  if (r.outputContext) r.outputContext.close().catch(() => {});
  if (r.proc) r.proc.disconnect();
  if (r.actx) r.actx.close().catch(() => {});
  if (r.stream) r.stream.getTracks().forEach((track) => track.stop());
  if (r.ws) r.ws.close();
 };
}, [])
			React.useEffect(() => {
				refs.current.sessionId = sessionId
				call(API.bindSession, { sessionId: sessionId || null }).catch(() => {})
			}, [sessionId])
			// 上报 GUI 当前查看的会话：该会话完成任务时不播报（用户正在看）
			React.useEffect(() => {
				const cur = list?.current || null
				if (cur) call(API.viewing, { sessionId: cur }).catch(() => {})
			}, [list?.current])
			// 拉取专属工作区/会话状态；未就绪时每 2 秒轮询直到就绪
			React.useEffect(() => {
				let disposed = false
				const refresh = () => call(API.getState)
					.then((r) => {
						if (!r?.ok || disposed) return
						setDedicated({ ready: !!r.ready, voiceSessionId: r.voiceSessionId || null, workspaceId: r.workspaceId || null, workspaceTitle: r.workspaceTitle || '' })
						if (r.otherDones?.length) setOtherDones((d) => [...r.otherDones, ...d].filter((x, i, arr) => arr.findIndex((y) => y.sessionId === x.sessionId && y.time === x.time) === i).slice(0, 20))
					})
					.catch(() => {})
				refresh()
				if (dedicated?.ready) return undefined
				const iv = ctxRef.interval(refresh, 2000)
				return () => { disposed = true; iv() }
			}, [dedicated?.ready])
			// 专属会话就绪提示（每页只提示一次）
			const noticeShown = React.useRef(false)
			React.useEffect(() => {
				if (dedicated?.ready && !noticeShown.current) {
					noticeShown.current = true
					setMsgs((m) => [...m.slice(-19), { role: 'notice', text: '✅ 专属工作区「' + (dedicated.workspaceTitle || '语音通话') + '」已就绪。这里是公共语音房间，所有访客共用对话记录，请轮流说话。点击「开始通话」并允许麦克风即可聊天。' }])
				}
			}, [dedicated])
			React.useEffect(() => { call(API.setPersona, { persona: settings.persona }).catch(() => {}) }, [settings.persona])
			React.useEffect(() => {
				call(API.taskList).then((r) => { if (r?.ok) setTasks(r.tasks || []) }).catch(() => {})
				// 打开面板时刷新会话/工作区基线，确保专属工作区与会话出现在侧边栏
				try { ctxRef.get('sessions')?.refresh?.().catch?.(() => {}) } catch {}
				try { ctxRef.get('workspaces')?.refresh?.().catch?.(() => {}) } catch {}
			}, [open])
			React.useEffect(() => {
				const dispose = ctxRef.interval(() => {
					const r = refs.current
					if (r.pollBusy) return
					r.pollBusy = true
					call(API.pollEvents + '?since=' + r.since)
						.then((res) => {
							if (res?.ok && res.events?.length) {
								r.since = res.events[res.events.length - 1].seq
								try { window.localStorage.setItem('dsh.voiceCall.since.v1', String(r.since)) } catch {}
								const s = r.settings
								for (const ev of res.events) {
                                    if(ev.kind==='live-owner'){if(r.liveActive&&ev.ownerId!==r.liveOwnerId){r.liveActive=false;r.ignoreSpeech=false;stopPlayback();pauseBgm()}continue}
                                    if (ev.kind === 'live-speech') { handleLiveSpeech(ev); continue }
                                    if (ev.kind === 'live-speech-cancel') { if (ev.ownerId === refs.current.liveOwnerId && ev.turnId === refs.current.liveTurnId) { refs.current.liveTurnId = ''; stopPlayback(); unlockAudio(); } continue }
                                    if(ev.kind==='live-paused'||ev.kind==='live-resumed'){if(ev.ownerId===r.liveOwnerId&&r.liveActive)applyLivePause(ev.kind==='live-paused');continue}
                                    if(ev.kind==='live-restarted'){
                                      const owned=ev.ownerId===r.liveOwnerId;
                                      if(owned||r.liveActive){stopPlayback();pauseBgm();r.liveTurnId=''}r.liveActive=owned&&r.liveArmed;r.ignoreSpeech=r.liveActive;
                                      if(owned&&r.liveArmed){unlockAudio();if(r.settings.bgmEnabled)startBgm()}
                                      continue;
                                    }
                                    if (ev.kind === 'live-error') { setLiveError(ev.error || '直播会话失败'); refs.current.liveActive = false; refs.current.ignoreSpeech = false; stopPlayback(); pauseBgm(); continue }
                                    if (ev.kind === 'live-stopped') { if (refs.current.liveActive) { refs.current.liveActive = false; refs.current.ignoreSpeech = false; stopPlayback(); pauseBgm(); } continue }
									if (ev.kind === 'speech-reset') {
                                        if (r.cueRun || r.liveActive) continue
                                        const allowed = r.outputAllowed
                                        stopPlayback()
                                        r.outputAllowed = allowed
                                        r.ignoreSpeech = false
                                    } else if (ev.kind === 'speech') {
                                        if (!r.liveActive && !r.cueRun && !r.ignoreSpeech && s.ttsEnabled && r.outputAllowed) requestTts(ev.text, ttsConfig(s), Math.max(2500, ev.text.length * 160 + 1500))
                                    } else if (ev.kind === 'reply-done') {
                                        setWaitingReply(false)
                                    } else if (ev.kind === 'reply') {
                                        setMsgs(m => [...m.slice(-19), { role:'assistant', text:ev.text }])
                                        if (!r.ignoreSpeech) setWaitingReply(false)
                                    } else if (ev.kind === 'task') {
										call(API.taskList).then((r2) => { if (r2?.ok) setTasks(r2.tasks || []) }).catch(() => {})
									} else if (ev.kind === 'other-done') {
										const item = { sessionId: String(ev.sessionId || ''), text: String(ev.text || '').slice(0, 300), time: ev.time || Date.now() }
										setOtherDones((d) => [item, ...d.filter((x) => !(x.sessionId === item.sessionId && x.time === item.time))].slice(0, 20))
										// 简要语音播报（可关闭）；只播报 2 分钟内的事件，避免刷新页面后重播旧记录
										if (!r.liveActive && !r.cueRun && s.announceOtherDone !== false && item.text && Date.now() - item.time < 120000) {
											const title = sessionTitle(r.list, item.sessionId)
											const announceText = '「' + title + '」完成任务：' + briefForTts(item.text, 80)
											const base = effectiveBase(s)
											if (!urlProblem(base)) {
												requestTts(announceText, ttsConfig(s), Math.max(3000, announceText.length * 160 + 1500))
											}
										}
									}
								}
							}
						})
						.catch(() => {})
						.finally(() => { r.pollBusy = false })
				}, 250)
				return dispose
			}, [])
			// 仅允许 https 或本机 http 地址，防止 API Key 通过明文/任意地址外发
			const urlProblem = (u) => {
				try {
					const url = new URL(String(u || '').trim())
					if (url.protocol === 'https:') return ''
					if (url.protocol === 'http:' && ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname)) return ''
					return '仅支持 https:// 或本机 http:// 地址'
				} catch { return 'URL 无效' }
			}
            const effectiveBase = () => 'https://tts.tencentcloudapi.com';
            const ttsConfig = s => ({speed:speechSpeed(s)});

			// 播报前压缩：优先取第一句（到句末标点），整体不超过 maxChars；过短时按 maxChars 截断
			const briefForTts = (text, maxChars) => {
				const t = String(text || '').replace(/\s+/g, ' ').trim()
				if (!t || !(maxChars > 0)) return ''
				if (t.length <= maxChars) return t
				const m = t.match(/^.*?[。！？!?…]/)
				if (m && m[0].length > 10 && m[0].length <= maxChars) return m[0]
				return t.slice(0, maxChars) + '…'
			}
// Fixed cues use their reviewed recordings and own output until completion or cancellation.
const startStageCue = (id) => {
  const cue = STAGE_CUES.find(item => item.id === id);
  if (!cue || refs.current.disposed) return;
  stopPlayback();
  unlockAudio();
  const r = refs.current;
  r.ignoreSpeech = true;
  const title = cue.title;
  const speed = speechSpeed(r.settings);
  const progress = { id, title, index:0, total:1, elapsedSeconds:0, durationSeconds:cue.durationSeconds / speed };
  const run = { id, title, epoch:r.audioEpoch, onStop:reason => setCuePlayback({ ...progress, phase:reason === 'error' ? 'error' : 'stopped' }) };
  r.cueRun = run;
  setWaitingReply(false);
  setCuePlayback({ ...progress, phase:'loading' });
  playAudioUrl(cue.audioUrl, cue.durationSeconds * 1000 / speed, {
    onStart:() => {
      if (r.cueRun !== run || r.disposed) return;
      setCuePlayback({ ...progress, phase:'playing', index:1 });
    },
    onProgress:elapsedSeconds => {
      if (r.cueRun !== run || r.disposed) return;
      setCuePlayback({ ...progress, phase:'playing', index:1, elapsedSeconds:elapsedSeconds / speed });
    },
    onEnd:() => {
      if (r.cueRun !== run || r.disposed) return;
      r.cueRun = null;
      setCuePlayback({ ...progress, phase:'done', index:1, elapsedSeconds:progress.durationSeconds });
    },
  }, speed);
};

React.useEffect(() => {
  let cancelled = false;
  storedBackgroundMusic().then(value => {
    if (cancelled || !value || !(value.blob instanceof window.Blob)) return;
    refs.current.bgmCustomUrl = window.URL.createObjectURL(value.blob);
    setBgmCustom({name:value.name || '自选音乐'});
  }).catch(cause => {
    if (!cancelled && refs.current.settings.bgmTrack === 'custom') setBgmState({phase:'error',error:'本地音乐读取失败，请重新选择文件',ducked:false});
  });
  return () => { cancelled = true; };
}, []);
const updateBgmSettings = values => {
  const next = {...refs.current.settings,...values};
  refs.current.settings = next; saveSettings(next); setSettings(next);
  refs.current.bgm?.setOptions({volume:next.bgmVolume,duck:next.bgmDucking});
};
const pauseBgm = () => refs.current.bgm?.pause();
const startBgm = () => {
  const r = refs.current;
  try {
    if (!r.bgm) r.bgm = createBackgroundMusic({onState:setBgmState});
    const url = r.settings.bgmTrack === 'custom' ? r.bgmCustomUrl : backgroundTrack(r.settings.bgmTrack).url;
    if (!url) throw new Error('请先选择自己的 BGM 音频文件');
    r.bgm.setOptions({volume:r.settings.bgmVolume,duck:r.settings.bgmDucking});
    r.bgm.setSource(url); r.bgm.setSpeaking(Boolean(r.audioBusy));
    void r.bgm.play();
  } catch (cause) { setBgmState({phase:'error',error:String(cause?.message || cause),ducked:false}); }
};
const selectBgmTrack = track => {
  const resume = ['playing','loading'].includes(refs.current.bgm?.state().phase);
  updateBgmSettings({bgmTrack:track});
  if (resume) startBgm();
};
const chooseBgmFile = async file => {
  if (!file) return;
  if (!file.size || file.size > 30 * 1024 * 1024 || (!file.type.startsWith('audio/') && !/\.(mp3|wav|m4a|ogg|flac|aac)$/i.test(file.name))) {
    setBgmState({phase:'error',error:'请选择 30 MB 以内的音频文件',ducked:false}); return;
  }
  const r = refs.current, previous = r.bgmCustomUrl;
  r.bgmCustomUrl = window.URL.createObjectURL(file);
  setBgmCustom({name:file.name}); selectBgmTrack('custom');
  if (previous) window.URL.revokeObjectURL(previous);
  try { await storedBackgroundMusic({name:file.name,blob:file}); }
  catch (cause) { if (!r.disposed) setBgmState(state => ({...state,error:'音乐可在本页播放，但未能保存；下次打开请重新选择'})); }
};
const renderBgmControls = () => e('div',{className:'va-set',role:'group','aria-label':'背景音乐',style:{padding:'12px',border:'1px solid #3a3f56',borderRadius:10}},
  e('strong',null,'背景音乐 BGM'),
  e('select',{className:'va-input','aria-label':'背景音乐曲目',value:settings.bgmTrack,onChange:event=>selectBgmTrack(event.target.value)},
    BGM_TRACKS.map(track => e('option',{key:track.id,value:track.id},track.title)),
    e('option',{value:'custom',disabled:!bgmCustom},bgmCustom ? '自选 · '+bgmCustom.name : '自选音乐（先选择文件）')
  ),
  e('div',{className:'va-row'},
    e('button',{className:'va-btn ghost',onClick:() => {
      if (['playing','loading'].includes(bgmState.phase)) pauseBgm();
      else { updateBgmSettings({bgmEnabled:true}); startBgm(); }
    }},['playing','loading'].includes(bgmState.phase) ? '暂停 BGM' : '播放 BGM'),
    e('span',{role:'status',className:'va-hint'},bgmState.phase === 'playing' ? (bgmState.ducked ? '播放中 · 已压低音乐' : '播放中 · 循环播放') : bgmState.phase === 'loading' ? '音乐加载中…' : '音乐已暂停')
  ),
  e('label',null,'音乐音量 · '+Math.round((Number(settings.bgmVolume)||0)*100)+'%'),
  e('input',{type:'range',min:0,max:50,step:1,value:Math.round((Number(settings.bgmVolume)||0)*100),'aria-label':'BGM 音量',onChange:event=>updateBgmSettings({bgmVolume:Number(event.target.value)/100}),style:{width:'100%'}}),
  e('label',null,e('input',{type:'checkbox',checked:settings.bgmDucking!==false,onChange:event=>updateBgmSettings({bgmDucking:event.target.checked})}),' 播报时自动压低音乐'),
  e('label',null,e('input',{type:'checkbox',checked:settings.bgmEnabled!==false,onChange:event=>{
    updateBgmSettings({bgmEnabled:event.target.checked});
    if (!event.target.checked) pauseBgm(); else if (refs.current.liveActive) startBgm();
  }}),' AI 直播开始时自动播放'),
  e('label',{htmlFor:'va-bgm-file'},'选择本地 BGM 文件'),
  e('input',{id:'va-bgm-file',type:'file',accept:'audio/*,.mp3,.wav,.m4a,.ogg,.flac,.aac','aria-label':'选择本地 BGM 文件',onChange:event=>chooseBgmFile(event.target.files?.[0]),style:{maxWidth:'100%'}}),
  e('div',{className:'va-hint'},'内置轻柔钢琴、Funk 律动、轻快鼓点和动感电子；音乐和语音独立播放，自选音乐保存在当前浏览器。'),
  settings.bgmTrack !== 'custom' ? e('a',{href:backgroundTrack(settings.bgmTrack).source,target:'_blank',rel:'noreferrer',className:'va-hint'},backgroundTrack(settings.bgmTrack).credit) : null,
  bgmState.error ? e('div',{role:'alert',className:'va-hint',style:{color:'#ffb4ae'}},bgmState.error) : null
);

const ensureOutputContext = () => {
  const r = refs.current;
  if (!r.outputContext || r.outputContext.state === 'closed') {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) throw new Error('浏览器不支持 Web Audio');
    r.outputContext = new AudioContext();
  }
  return r.outputContext;
};
const unlockAudio = () => {
  refs.current.outputAllowed = true;
  try { ensureOutputContext().resume().catch(() => {}); } catch {}
};
const idleStatus = () => refs.current.calling ? (refs.current.micMuted ? '已闭麦 · AI 会继续回复' : '聆听中…') : '空闲';
const stopPlayback = (reason = 'stopped') => {
  const r = refs.current;
  const cue = r.cueRun;
  r.cueRun = null;
  if (cue && !r.disposed) cue.onStop(reason);
  r.livePaused=false;r.livePreparingTurn='';r.livePauseBgmWanted=false;
  r.audioEpoch += 1;
  r.outputAllowed = false;
  r.audioQueue.length = 0;
  cancelSpeechRequests();
  if (r.cancelAudio) r.cancelAudio();
  r.audioBusy = false;
  r.ttsUntil = 0;
  setPlayback({ phase:'idle', analyser:null });
  setStatus(idleStatus());
};
const cancelSpeechRequests = () => {
  const r = refs.current;
  if (r.ttsJob) { r.ttsJob.controller.abort(); r.ttsJob.resolve(); r.ttsJob = null; }
  for (const job of r.ttsQueue) job.resolve();
  r.ttsQueue.length = 0;
};
const pumpSynthesis = async () => {
  const r = refs.current;
  if (r.disposed || r.livePaused || !r.outputAllowed || r.ttsJob || !r.ttsQueue.length || r.audioQueue.length >= 2) return;
  const job = r.ttsQueue.shift();
  r.ttsJob = job;
  if (!r.audioBusy) setPlayback({ phase:'loading', analyser:null });
  try {
    const result = await call(API.tts, { text:job.text, config:job.config }, job.controller.signal);
    if (r.disposed || job.epoch !== r.audioEpoch || !r.outputAllowed) return;
    if (!result?.ok || !result.audio) throw new Error(result?.error || '没有收到音频');
    playAudio(result.audio, result.mime || 'audio/mpeg', result.truncated, job.estMs, job.meta);
  } catch (error) {
    if (r.disposed || job.epoch !== r.audioEpoch) return;
    stopPlayback('error');
    setPlayback({ phase:'error', analyser:null });
    setStatus('语音回复失败: ' + String(error?.message || error).slice(0, 160));
  } finally {
    job.resolve();
    if (r.ttsJob === job) { r.ttsJob = null; pumpSynthesis(); }
  }
};
const requestTts = (text, config, estMs, meta) => {
  const r = refs.current;
  if (!r.outputAllowed || r.disposed || !text.trim()) return Promise.resolve();
  const parts=splitTencentSpeech(text);
  return Promise.all(parts.map((part,index)=>new Promise(resolve=>{
    r.ttsQueue.push({text:part,config,estMs:Math.max(2500,estMs*part.length/text.length),
      meta:index===parts.length-1?meta&&{...meta,onStart:index===0?meta.onStart:undefined}:index===0&&meta?.onStart?{onStart:meta.onStart}:undefined,resolve,epoch:r.audioEpoch,controller:new AbortController()});
    pumpSynthesis();
  })));
};
const previewVoice = async () => {
  if (refs.current.cueRun) stopPlayback();
  unlockAudio();
  setPreviewBusy(true);
  try { await requestTts('你好呀！我在这里陪你。你说话的时候，我会认真听；轮到我回答，嘴巴和小动作也会跟着声音一起动。', ttsConfig(refs.current.settings), 11000); }
  finally { if (!refs.current.disposed) setPreviewBusy(false); }
};
const playAudio = (b64, mime, truncated, estMs, meta) => {
  if (!refs.current.outputAllowed || refs.current.disposed) return;
  if (truncated) setMsgs((m) => [...m.slice(-19), { role:'notice', text:'语音回复已按长度限制截断。' }]);
  refs.current.audioQueue.push({ b64, mime, estMs, meta });
  nextAudio();
};
const playAudioUrl = (url, estMs, meta, playbackRate) => {
  if (!refs.current.outputAllowed || refs.current.disposed) return;
  refs.current.audioQueue.push({ url, estMs, meta, playbackRate });
  nextAudio();
};
const nextAudio = () => {
  const r = refs.current;
  if (r.disposed || r.livePaused || r.audioBusy || !r.audioQueue.length || !r.outputAllowed) return;
  const item = r.audioQueue.shift();
  r.audioBusy = true;
  pumpSynthesis();
  setPlayback({ phase:'loading', analyser:null });
  let audio, source, analyser;
  let settled = false;
  const finish = (error, advance = true) => {
    if (settled) return;
    settled = true;
    if(r.activeAudio===audio)r.activeAudio=null;
    if (audio) {
      audio.onplaying = audio.onpause = audio.onwaiting = audio.onended = audio.onerror = audio.onloadedmetadata = audio.ontimeupdate = null;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    if (source) source.disconnect();
    if (analyser) analyser.disconnect();
    r.cancelAudio = null;
    r.audioBusy = false;
    r.ttsUntil = 0;
    r.bgm?.setSpeaking(false);
    if (r.disposed) return;
    if (error) stopPlayback('error');
    setPlayback({ phase:error ? 'error' : (r.ttsJob || r.ttsQueue.length) ? 'loading' : 'idle', analyser:null });
    setStatus(error ? '语音播放失败: ' + error : idleStatus());
    if (advance && !error) { item.meta?.onEnd?.(); nextAudio(); pumpSynthesis(); }
  };
  r.cancelAudio = () => finish(null, false);
  try {
    const context = ensureOutputContext();
    audio = new window.Audio(item.url || 'data:' + item.mime + ';base64,' + item.b64);
    r.activeAudio=audio;
    audio.playbackRate = item.playbackRate || 1;
    audio.preservesPitch = true;
    source = context.createMediaElementSource(audio);
    analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    analyser.connect(context.destination);
    audio.onplaying = () => {
      if (settled) return;
      if(r.livePaused){audio.pause();return;}
      r.ttsUntil = Date.now() + (Number.isFinite(audio.duration) ? (audio.duration - audio.currentTime) * 1000 / audio.playbackRate : item.estMs || 4000) + 600;
      r.bgm?.setSpeaking(true);
      setPlayback({ phase:'playing', analyser });
      setStatus('正在播放语音回复…');
      item.meta?.onStart?.();
    };
    audio.ontimeupdate = () => { if (!settled) item.meta?.onProgress?.(audio.currentTime); };
    audio.onwaiting = () => { if (!settled) setPlayback({ phase:'loading', analyser:null }); };
    audio.onpause = () => { if (!settled) setPlayback({ phase:'idle', analyser:null }); };
    audio.onended = () => finish(null);
    audio.onerror = () => finish('音频无法解码');
    context.resume().then(() => {
      if (settled) return;
      if (context.state !== 'running') throw new Error('请点击「试听声音」或「开始通话」启用声音');
      if(!r.livePaused)return audio.play();
    }).catch((error) => finish(error?.name === 'NotAllowedError' ? '请点击「试听声音」或「开始通话」启用声音' : String(error?.message || error)));
  } catch (error) { finish(String(error?.message || error)); }
};

			const connectFunasr = () => new Promise((resolve, reject) => {
				const s = refs.current.settings
                const epoch = refs.current.micEpoch
				const ws = new window.WebSocket(s.asrUrl)
				const cancelTimeout = ctxRef.timeout(() => { try { ws.close() } catch {}; reject(new Error('FunASR 连接超时')) }, 8000)
				ws.onopen = () => {
					cancelTimeout()
                    if (refs.current.disposed || refs.current.micMuted || epoch !== refs.current.micEpoch) { ws.close(); reject(new Error('麦克风已关闭')); return }
					ws.send(JSON.stringify({ mode: '2pass', chunk_size: [5, 10, 5], wav_name: 'va', is_speaking: true, itn: true, hotword: '' }))
					refs.current.ws = ws
					setStatus('识别中…')
					resolve()
				}
				ws.onerror = () => { cancelTimeout(); reject(new Error('FunASR 连接失败（' + s.asrUrl + '）。若使用的是新版 FunASR Server（HTTP /v1），请在设置中切换为「FunASR Server HTTP」模式')) }
				ws.onmessage = (ev) => {
                    if (refs.current.disposed || refs.current.micMuted || epoch !== refs.current.micEpoch) return
					try {
						const d = JSON.parse(ev.data)
						const t = d.text || ''
						if (d.mode === '2pass-online') { setPartial(t); if (t) setTranscript(t) }
						else if (d.mode === '2pass-offline') {
							setTranscript(t)
							const r = refs.current
							if (t && r.settings.autoSend) {
								const now = Date.now()
								// 同一文本在短时间内重复下发（边界刷新/结束时）只发送一次
								if (!(t === r.lastStreamText && now - r.lastStreamAt < 3000)) {
									r.lastStreamText = t
									r.lastStreamAt = now
									handleRecognizedText(t)
								}
							}
						}
					} catch {}
				}
				ws.onclose = () => { if (refs.current.ws === ws) refs.current.ws = null }
			})
			const encodeWav = (pcm) => {
				const n = pcm.length
				const buf = new ArrayBuffer(44 + n * 2)
				const dv = new DataView(buf)
				const ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)) }
				ws(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); ws(8, 'WAVE')
				ws(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true)
				dv.setUint32(24, 16000, true); dv.setUint32(28, 32000, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true)
				ws(36, 'data'); dv.setUint32(40, n * 2, true)
				new Int16Array(buf, 44).set(pcm)
				const bytes = new Uint8Array(buf)
				let bin = ''
				for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
				return window.btoa(bin)
			}
			const concatInt16 = (arrs) => {
				let total = 0
				for (const a of arrs) total += a.length
				const out = new Int16Array(total)
				let off = 0
				for (const a of arrs) { out.set(a, off); off += a.length }
				return out
			}
			const transcribePcm = async (pcm, s) => {
				const r = refs.current
                if (r.disposed || r.micMuted) return
                const epoch = r.micEpoch
				r.vadBusy = true
				setBusy(true)
				setStatus('识别中…')
				try {
					const wav = encodeWav(pcm)
					const isFunasrHttp = s.asrMode === 'funasr-http'
					const base = isFunasrHttp ? s.funasrHttpBase : s.cloudAsrBase
					const urlErr = urlProblem(base)
					if (urlErr) { setStatus('识别失败: ' + urlErr); return }
					const config = isFunasrHttp
						? { baseUrl: base, apiKey: s.funasrHttpKey, model: s.funasrHttpModel || 'fun-asr-nano' }
						: { baseUrl: base, apiKey: s.cloudAsrKey, model: s.cloudAsrModel || 'whisper-1' }
					const res2 = await call(API.cloudAsr, { audioBase64: wav, mime: 'audio/wav', ext: 'wav', config })
                    if (r.disposed || r.micMuted || epoch !== r.micEpoch) return
					if (res2?.ok && res2.text) {
						const stripped = String(res2.text).trim()
						if (stripped.length <= 1) {
							setTranscript('')
							setStatus('聆听中…')
							return
						}
						setTranscript(stripped)
						if (s.autoSend) {
							handleRecognizedText(stripped)
						} else setStatus('聆听中…')
					} else setStatus('识别失败: ' + (res2?.error || '未知错误'))
				} finally {
					setBusy(false)
					r.vadBusy = false
					if (!r.disposed && !r.micMuted && r.pendingPcm.length) {
						const pp = r.pendingPcm.shift()
						await transcribePcm(pp, refs.current.settings)
					}
				}
			}
			const inputDeviceError = error => {
  if (error?.name === 'NotAllowedError') return '请在浏览器中允许访问麦克风，然后重试。';
  if (error?.name === 'NotFoundError' || error?.name === 'OverconstrainedError') return '所选麦克风不可用，请连接设备或重新选择。';
  if (error?.name === 'NotReadableError') return '无法打开麦克风，请检查设备连接或是否被其他应用独占。';
  return String(error?.message || error);
};
const refreshInputDevices = async () => {
  const r = refs.current;
  const media = window.navigator.mediaDevices;
  if (!media?.enumerateDevices) { setInputError('当前浏览器不支持麦克风设备选择。'); return; }
  const revision = ++r.deviceListRevision;
  try {
    const devices = (await media.enumerateDevices()).filter(device => device.kind === 'audioinput');
    if (r.disposed || revision !== r.deviceListRevision) return;
    const unique = devices.filter((device, i) => device.deviceId && devices.findIndex(other => other.deviceId === device.deviceId) === i);
    r.inputDevices = unique;
    setInputDevices(unique);
  } catch (error) {
    if (!r.disposed && revision === r.deviceListRevision) setInputError(inputDeviceError(error));
  }
};
const openInputStream = async (deviceId = refs.current.settings.audioInputDeviceId) => {
  const r = refs.current;
  const generation = r.inputGeneration;
  const media = window.navigator.mediaDevices;
  if (!media?.getUserMedia) throw new Error('请使用支持麦克风的浏览器，通过 HTTPS 打开页面。');
  const audio = { channelCount:1, sampleRate:16000, echoCancellation:true, noiseSuppression:true, autoGainControl:false };
  if (deviceId && deviceId !== 'default') audio.deviceId = { exact:deviceId };
  const stream = await media.getUserMedia({ audio });
  if (r.disposed || generation !== r.inputGeneration) {
    stream.getTracks().forEach(track => track.stop());
    const error = new Error('麦克风操作已取消'); error.name = 'AbortError'; throw error;
  }
  refreshInputDevices();
  setInputError('');
  return stream;
};
const stopInputMeter = () => {
  const r = refs.current;
  r.inputMeter?.dispose();
  r.inputMeter = null;
  if (!r.disposed) { setInputLevel(0); setInputTesting(false); }
};
const stopInputTest = () => {
  const r = refs.current;
  r.inputGeneration++;
  if (r.inputMeter?.ownedStream) stopInputMeter();
};
const startInputMeter = (stream, existingContext = null) => {
  stopInputMeter();
  const r = refs.current;
  const context = existingContext || new (window.AudioContext || window.webkitAudioContext)();
  let source, analyser, silent, stopTimer, stopSamples;
  const meter = { ownedStream:!existingContext, dispose() {
    stopTimer?.(); stopSamples?.();
    source?.disconnect(); analyser?.disconnect(); silent?.disconnect();
    if (!existingContext) { stream.getTracks().forEach(track => track.stop()); context.close().catch(() => {}); }
  }};
  try {
    source = context.createMediaStreamSource(stream);
    analyser = context.createAnalyser(); analyser.fftSize = 1024;
    silent = context.createGain(); silent.gain.value = 0;
    source.connect(analyser); analyser.connect(silent); silent.connect(context.destination);
    const samples = new Float32Array(analyser.fftSize);
    stopSamples = ctxRef.interval(() => {
      if (r.disposed) return;
      analyser.getFloatTimeDomainData(samples);
      const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
      setInputLevel(Math.min(1, rms * 5));
    }, 100);
    if (!existingContext) stopTimer = ctxRef.timeout(() => { if (r.inputMeter === meter) stopInputTest(); }, 15000);
    r.inputMeter = meter;
    setInputTesting(!existingContext);
    context.resume().catch(error => { if (!r.disposed && r.inputMeter === meter) { stopInputMeter(); setInputError(inputDeviceError(error)); } });
  } catch (error) { meter.dispose(); throw error; }
};
const watchInputTrack = stream => {
  for (const track of stream.getAudioTracks()) track.addEventListener('ended', () => {
    const r = refs.current;
    if (r.disposed || r.stream !== stream) return;
    discardMicInput();
    r.micMuted = true; setMicMuted(true);
    r.micSource?.disconnect();
    stream.getTracks().forEach(item => item.stop());
    r.stream = null;
    stopInputMeter();
    setInputError('麦克风已断开，请选择可用设备后开麦。');
    refreshInputDevices();
  }, { once:true });
};
const saveInputDevice = deviceId => {
  const r = refs.current;
  const next = { ...r.settings, audioInputDeviceId:deviceId };
  r.settings = next;
  setSettings(next);
  saveSettings(next);
};
const selectInputDevice = async deviceId => {
  const r = refs.current;
  if (r.deviceBusy || r.micToggleBusy) return;
  if (!r.calling && !r.inputMeter?.ownedStream) { saveInputDevice(deviceId); setInputError(''); return; }
  r.deviceBusy = true; setInputDeviceBusy(true);
  let stream;
  try {
    stream = await openInputStream(deviceId);
    if (r.calling) {
      stream.getAudioTracks().forEach(track => { track.enabled = !r.micMuted; });
      const source = r.actx ? r.actx.createMediaStreamSource(stream) : null;
      if (r.proc) source.connect(r.proc);
      const previous = r.stream;
      const previousSource = r.micSource;
      discardMicInput();
      if (r.recorder) { r.recorder.ondataavailable = null; r.recorder.stop(); r.recorder = null; }
      if (r.ws) { const ws = r.ws; r.ws = null; ws.close(); }
      r.stream = stream; r.micSource = source;
      previousSource?.disconnect();
      previous?.getTracks().forEach(track => track.stop());
      watchInputTrack(stream);
      startInputMeter(stream, r.actx);
      saveInputDevice(deviceId);
      if (!r.micMuted) {
        if (r.settings.asrMode === 'funasr') await connectFunasr();
        else if (r.settings.vadEnabled === false) startRecorderOnStream(stream);
      }
    } else {
      startInputMeter(stream);
      saveInputDevice(deviceId);
    }
  } catch (error) {
    if (stream && r.stream !== stream) stream.getTracks().forEach(track => track.stop());
    if (!r.disposed && error?.name !== 'AbortError') setInputError(inputDeviceError(error));
  } finally {
    r.deviceBusy = false;
    if (!r.disposed) setInputDeviceBusy(false);
  }
};
const toggleInputTest = async () => {
  const r = refs.current;
  if (r.calling || r.deviceBusy) return;
  if (r.inputMeter?.ownedStream) { stopInputTest(); return; }
  r.deviceBusy = true; setInputDeviceBusy(true);
  try { startInputMeter(await openInputStream()); }
  catch (error) { if (!r.disposed && error?.name !== 'AbortError') setInputError(inputDeviceError(error)); }
  finally { r.deviceBusy = false; if (!r.disposed) setInputDeviceBusy(false); }
};
const renderInputDevice = () => {
  const selected = settings.audioInputDeviceId || '';
  const defaultDevice = inputDevices.find(device => device.deviceId === 'default');
  const defaultName = defaultDevice?.label.replace(/^(Default|默认|系统默认)\s*[-—:]?\s*/iu, '');
  const devices = inputDevices.filter(device => device.deviceId !== 'default');
  const unavailable = selected && !devices.some(device => device.deviceId === selected);
  return e('section', { className:'va-input-device', 'aria-label':'麦克风设置' },
    e('label', { htmlFor:'va-input-device-select', className:'va-input-device-label' }, '麦克风'),
    e('div', { className:'va-input-device-row' },
      e('select', { id:'va-input-device-select', className:'va-select va-input', value:selected, disabled:inputDeviceBusy || busy || micToggleBusy, onChange:event => selectInputDevice(event.target.value) },
        e('option', {value:''}, defaultName ? `系统默认（${defaultName}）` : '系统默认'),
        devices.map((device,i) => e('option', {key:device.deviceId,value:device.deviceId}, device.label || `麦克风 ${i + 1}`)),
        unavailable ? e('option', {value:selected,disabled:true}, '上次选择的麦克风（未连接或待授权）') : null),
      e('button', {className:'va-btn ghost', disabled:calling || inputDeviceBusy || busy, onClick:toggleInputTest}, inputDeviceBusy ? '正在连接…' : inputTesting ? '停止检测' : '检测麦克风')),
    e('div', {className:'va-input-meter',role:'meter','aria-label':'麦克风输入音量','aria-valuemin':0,'aria-valuemax':100,'aria-valuenow':Math.round(inputLevel*100)},
      Array.from({length:20},(_,i) => e('span', {key:i,className:inputLevel*20 > i ? (i > 16 ? 'high' : 'lit') : ''}))),
    e('div', {className:'va-input-device-footer'},
      e('span', {className:'va-hint'}, calling ? (micMuted ? '已闭麦 · 输入音量为零' : '输入音量 · 通话中可切换设备') : inputTesting ? '请说话观察音量 · 15 秒后自动结束，不发送给 AI' : '检测后可显示完整设备名称，并查看输入音量'),
      e('button', {className:'va-input-refresh',disabled:inputDeviceBusy,onClick:refreshInputDevices}, '刷新设备')),
    inputError ? e('div', {className:'va-input-error',role:'alert'}, inputError) : null);
};

const discardMicInput = () => {
  const r = refs.current;
  r.micEpoch++;
  r.pendingPcm.length = 0;
  r.chunks.length = 0;
  r.vad?.reset();
  setTranscript('');
  setPartial('');
};
const toggleMicMuted = async () => {
  const r = refs.current;
  if (!r.calling || r.micToggleBusy || r.deviceBusy) return;
  if (r.micMuted && !r.stream) { setInputError('请先选择可用的麦克风。'); return; }
  r.micToggleBusy = true;
  setMicToggleBusy(true);
  const muted = !r.micMuted;
  r.micMuted = muted;
  setMicMuted(muted);
  discardMicInput();
  r.stream?.getAudioTracks().forEach(track => { track.enabled = !muted; });
  clearSleepTimer();
  try {
    if (muted) {
      if (r.ws) { const ws = r.ws; r.ws = null; ws.close(); }
      if (r.recorder) {
        const rec = r.recorder;
        r.recorder = null;
        rec.ondataavailable = null;
        if (rec.state !== 'inactive') rec.stop();
      }
      setBusy(false);
    } else if (r.settings.asrMode === 'funasr') {
      await connectFunasr();
    } else if (r.settings.vadEnabled === false) {
      startRecorderOnStream(r.stream);
    }
    if (!r.audioBusy && !r.ttsJob) setStatus(idleStatus());
  } catch (error) {
    r.micMuted = true;
    setMicMuted(true);
    r.stream?.getAudioTracks().forEach(track => { track.enabled = false; });
    setStatus('开麦失败: ' + String(error?.message || error));
  } finally {
    r.micToggleBusy = false;
    if (!r.disposed) setMicToggleBusy(false);
  }
};
const startVadMic = async () => {
  const r = refs.current;
  const stream = await openInputStream();
  if (r.disposed) { stream.getTracks().forEach(track => track.stop()); return; }
  stream.getAudioTracks().forEach(track => { track.enabled = !r.micMuted; });
  const actx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate:16000 });
  const src = actx.createMediaStreamSource(stream);
  const proc = actx.createScriptProcessor(2048, 1, 1);
  r.actx = actx;
  r.proc = proc;
  r.stream = stream;
  r.micSource = src;
  watchInputTrack(stream);
  startInputMeter(stream, actx);
  r.vad = createVoiceGate();
  proc.onaudioprocess = (event) => {
    if (r.disposed || r.micMuted || !r.vad) return;
    const result = r.vad.push(event.inputBuffer.getChannelData(0), r.settings);
    if (result.started && !r.audioBusy) setStatus('聆听中…（正在说话）');
    if (result.pcm) {
      if (r.vadBusy) r.pendingPcm.push(result.pcm);
      else transcribePcm(result.pcm, r.settings).catch(error => {
        if (!r.disposed && !r.micMuted) setStatus('识别失败: ' + String(error?.message || error));
      });
    }
  };
  src.connect(proc);
  const silent = actx.createGain();
  silent.gain.value = 0;
  proc.connect(silent);
  silent.connect(actx.destination);
  setTranscript('');
  setPartial('');
  setStatus(idleStatus());
};
const startRecorderOnStream = (stream) => {
  const r = refs.current;
  const epoch = r.micEpoch;
  const rec = new window.MediaRecorder(stream);
  r.recorder = rec;
  r.chunks = [];
  rec.ondataavailable = event => {
    if (!r.disposed && !r.micMuted && epoch === r.micEpoch && event.data.size) r.chunks.push(event.data);
  };
  rec.start(250);
};

const startRecorder = async () => {
                const r = refs.current
                const stream = await openInputStream()
                if (r.disposed) { stream.getTracks().forEach(track => track.stop()); return }
                r.stream = stream
                r.actx = new (window.AudioContext || window.webkitAudioContext)()
                watchInputTrack(stream)
                startInputMeter(stream, r.actx)
                stream.getAudioTracks().forEach(track => { track.enabled = !r.micMuted })
                if (!r.micMuted) startRecorderOnStream(stream)
            }
            const uploadAndAsr = async (s) => {
				const r = refs.current
                const epoch = r.micEpoch
                if (r.disposed || r.micMuted) return
				const rec = r.recorder
				if (!rec) return
				r.recorder = null
				await new Promise((res) => {
					rec.onstop = res
					try { rec.stop() } catch { res() }
				})
				const mime = rec.mimeType || 'audio/webm'
				const blob = new window.Blob(r.chunks, { type: mime })
				r.chunks = []
				if (blob.size === 0) return
				setStatus('识别中…')
				const ab = await blob.arrayBuffer()
				const bytes = new Uint8Array(ab)
				let bin = ''
				for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
				const b64 = window.btoa(bin)
				setBusy(true)
				try {
					const isFunasrHttp = s.asrMode === 'funasr-http'
					const base = isFunasrHttp ? s.funasrHttpBase : s.cloudAsrBase
					const urlErr = urlProblem(base)
					if (urlErr) { setStatus('识别失败: ' + urlErr); return }
					const ext = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : mime.includes('wav') ? 'wav' : 'webm'
					const config = isFunasrHttp
						? { baseUrl: base, apiKey: s.funasrHttpKey, model: s.funasrHttpModel || 'fun-asr-nano' }
						: { baseUrl: base, apiKey: s.cloudAsrKey, model: s.cloudAsrModel || 'whisper-1' }
					const res2 = await call(API.cloudAsr, { audioBase64: b64, mime, ext, config })
                    if (r.disposed || r.micMuted || epoch !== r.micEpoch) return
					if (res2?.ok && res2.text) {
						setTranscript(res2.text)
						if (s.autoSend) handleRecognizedText(res2.text)
					} else setStatus('识别失败: ' + (res2?.error || '未知错误'))
				} finally { setBusy(false) }
			}
			const startMic = async () => {
				const s = refs.current.settings
				if (s.asrMode === 'funasr') {
					await connectFunasr()
					const ws = refs.current.ws
					const stream = await openInputStream()
						.catch(async (e) => { try { if (ws) ws.close() } catch {}; throw e })
					const actx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 })
					const src = actx.createMediaStreamSource(stream)
					const proc = actx.createScriptProcessor(4096, 1, 1)
					proc.onaudioprocess = (ev) => {
						const ws = refs.current.ws
						if (!ws || ws.readyState !== 1) return
						if (refs.current.micMuted || refs.current.disposed) return
						const input = ev.inputBuffer.getChannelData(0)
						const buf = new Int16Array(input.length)
						for (let i = 0; i < input.length; i++) { const v = Math.max(-1, Math.min(1, input[i])); buf[i] = v < 0 ? v * 0x8000 : v * 0x7FFF }
						ws.send(buf.buffer)
					}
					refs.current.actx = actx
					refs.current.proc = proc
					refs.current.stream = stream
                    refs.current.micSource = src
                    watchInputTrack(stream)
                    startInputMeter(stream, actx)
					src.connect(proc)
					const silentGain = actx.createGain()
					silentGain.gain.value = 0
					proc.connect(silentGain)
					silentGain.connect(actx.destination)
					setTranscript('')
					setPartial('')
					refs.current.lastStreamText = ''
					refs.current.lastStreamAt = 0
				} else if (s.vadEnabled !== false) {
					await startVadMic()
				} else {
					await startRecorder()
					setStatus('录音中…（停止后识别）')
				}
				// 唤醒词模式：开始时处于休眠状态，只有听到唤醒词才唤醒对话
				if (s.wakeMode) {
					const ww = String(s.wakeWord || '').trim() || '小鲸鱼'
					refs.current.wake = 'asleep'
					setWake('asleep')
					clearSleepTimer()
					setStatus('😴 休眠中…（说出唤醒词「' + ww + '」唤醒）')
					if (s.asrMode === 'cloud') {
						setMsgs((m) => [...m.slice(-19), { role: 'notice', text: '💡 唤醒词模式建议使用本地部署的 ASR（如本机 FunASR Server）进行语音识别：语音不出本机、延迟低，唤醒更可靠；云端 ASR 会把每段语音上传，唤醒响应也受网络影响。可在设置页切换。' }])
					}
				}
			}
			const stopMic = async () => {
				const r = refs.current
                r.inputGeneration++; stopInputMeter();
                r.micSource?.disconnect(); r.micSource = null;
				r.vad?.reset()
				if (r.ws) {
					try {
						r.ws.send(JSON.stringify({ is_speaking: false }))
						// 等一拍再关闭，避免最终识别帧被连接关闭丢掉
						await new Promise((res) => ctxRef.timeout(res, 250))
						r.ws.close()
					} catch {}
					r.ws = null
				}
				if (r.proc) { try { r.proc.disconnect() } catch {} r.proc = null }
				if (r.actx) { try { r.actx.close() } catch {} r.actx = null }
				r.vad = null
				if (r.recorder) {
					await uploadAndAsr(refs.current.settings)
				}
				if (r.stream) { r.stream.getTracks().forEach((t) => t.stop()); r.stream = null }
				clearSleepTimer()
				refs.current.wake = 'asleep'
				setWake('asleep')
				setStatus('空闲')
			}
			const sendText = (t) => {
				const text0 = (t || '').trim()
				if (!text0) return
                stopPlayback()
                unlockAudio()
                refs.current.ignoreSpeech = true
                setWaitingReply(true)
                setStatus('思考中…')
				setMsgs((m) => [...m.slice(-19), { role: 'user', text: text0 }])
				call(API.sendText, { sessionId: refs.current.sessionId, text: text0 })
					.then((r) => {
						if (!r?.ok) {
							const err = String(r?.error || '未知错误')
							refs.current.ignoreSpeech = false
                        setWaitingReply(false)
                        setStatus('发送失败: ' + err)
							setMsgs((m) => [...m.slice(-19), { role: 'notice', text: '⚠ 消息发送失败: ' + err }])
						}
					})
					.catch((e) => {
						const err = String(e?.message || e)
						refs.current.ignoreSpeech = false
                        setWaitingReply(false)
                        setStatus('发送失败: ' + err)
						setMsgs((m) => [...m.slice(-19), { role: 'notice', text: '⚠ 消息发送失败: ' + err }])
					})
			}
			// ===== 唤醒词通话模式 =====
			const normWakeText = (t) => String(t || '').replace(/[，。！？、,.!?…\s]+/g, '')
			const cleanWakeRest = (s) => String(s || '').replace(/^[，。！？、,.!?…\s]+|[，。！？、,.!?…\s]+$/g, '').trim()
			// 在原始文本中定位唤醒词（容忍标点/空格插入），返回去除唤醒词后的指令内容；未命中返回 null
			const matchWakeWord = (raw, ww) => {
				const t = String(raw || '')
				const word = String(ww || '').trim()
				if (!t || !word) return null
				const i = t.indexOf(word)
				if (i >= 0) return { rest: cleanWakeRest(t.slice(0, i) + t.slice(i + word.length)) }
				const tn = normWakeText(t)
				const wn = normWakeText(word)
				const p = tn.indexOf(wn)
				if (p < 0) return null
				let start = -1, end = -1, k = 0
				for (let j = 0; j < t.length; j++) {
					if (/[，。！？、,.!?…\s]/.test(t[j])) continue
					if (k === p) start = j
					if (k === p + wn.length - 1) { end = j; break }
					k++
				}
				if (start < 0 || end < 0 || end < start) return null
				return { rest: cleanWakeRest(t.slice(0, start) + t.slice(end + 1)) }
			}
			const clearSleepTimer = () => {
				const r = refs.current
				if (r.sleepTimer) { try { r.sleepTimer() } catch {} r.sleepTimer = null }
			}
			// 沉默超过设定时间（从最后一次说话/发送算起）后休眠；语音回复播放期间顺延
			const scheduleSleep = () => {
				const r = refs.current
				clearSleepTimer()
				const s = r.settings
				const sleepMs = Math.max(1000, Number(s.sleepAfterMs) || 8000)
				const doSleep = () => {
					const r2 = refs.current
					r2.sleepTimer = null
					if (Date.now() < r2.ttsUntil) {
						r2.sleepTimer = ctxRef.timeout(doSleep, Math.max(500, r2.ttsUntil - Date.now()))
						return
					}
					if (r2.wake !== 'asleep') {
						r2.wake = 'asleep'
						setWake('asleep')
						setStatus('😴 休眠中…（说出唤醒词「' + (r2.settings.wakeWord || '小鲸鱼') + '」唤醒）')
					}
				}
				r.sleepTimer = ctxRef.timeout(doSleep, sleepMs)
			}
			// 唤醒：仅唤醒词 → 本地回应「我在」；唤醒词后带指令 → 去掉唤醒词直接发送
			const wakeUp = (rest) => {
				const r = refs.current
				const s = r.settings
				r.wake = 'awake'
				setWake('awake')
				if (rest) {
					sendText(rest)
					setStatus('🔔 已唤醒，思考中…')
				} else {
					setMsgs((m) => [...m.slice(-19), { role: 'assistant', text: '我在' }])
					setStatus('🔔 已唤醒，聆听中…')
					if (s.ttsEnabled) {
						const base = effectiveBase(s)
						if (!urlProblem(base)) {
							requestTts('我在', ttsConfig(s), 2500)
						}
					}
				}
				scheduleSleep()
			}
			// 语音识别结果的统一入口：唤醒词模式下，休眠时只有命中唤醒词才唤醒对话，否则忽略
			const handleRecognizedText = (text) => {
				const r = refs.current
                if (r.disposed || r.micMuted) return
				const s = r.settings
				const t = String(text || '').trim()
				if (!t) return
				if (!s.wakeMode) { sendText(t); setStatus('思考中…'); return }
				const ww = String(s.wakeWord || '').trim() || '小鲸鱼'
				if (r.wake === 'awake') {
					sendText(t)
					setStatus('思考中…')
					scheduleSleep()
					return
				}
				const m = matchWakeWord(t, ww)
				if (m) {
					wakeUp(m.rest)
				} else {
					setStatus('😴 休眠中…（未检测到唤醒词「' + ww + '」，已忽略）')
				}
			}
			const toggleCall = async () => {
				if (calling) { stopPlayback(); setCalling(false); refs.current.calling = false; setStatus('结束通话…'); await stopMic(); setStatus('空闲'); return }
				stopInputTest()
                unlockAudio()
				setBusy(true)
				try {
					await startMic()
                    refs.current.calling = true
					setCalling(true)
				} catch (err) {
					await stopMic()
					setInputError(inputDeviceError(err))
                    setStatus('启动失败: ' + inputDeviceError(err))
				} finally { setBusy(false) }
			}
			const createTask = (title, prompt) => {
				setBusy(true)
				call(API.createTask, { parentSessionId: refs.current.sessionId, title, prompt })
					.then((r) => {
						if (r?.ok) { call(API.taskList).then((r2) => { if (r2?.ok) setTasks(r2.tasks || []) }).catch(() => {}) }
						else setStatus('创建任务失败: ' + (r?.error || ''))
					})
					.catch(() => setStatus('创建任务失败'))
					.finally(() => setBusy(false))
			}
			const [taskTitle, setTaskTitle] = React.useState('')
			const [taskPrompt, setTaskPrompt] = React.useState('')
const [liveConfig, updateLiveConfig] = React.useState({ systemPrompt:'', sourceText:'', presentationUrl:'', commentFrequency:50, pageSeconds:45, commentSeconds:12,welcomeScript:'',closingScript:'',welcomeGuidance:'',closingGuidance:'',engagementMinTurns:3,engagementCooldownSeconds:90 });
const liveConfigFromStatus = state => ({systemPrompt:state.systemPrompt || '',sourceText:state.sourceText || '',presentationUrl:state.presentationUrl || '',commentFrequency:state.commentFrequency ?? 50,pageSeconds:state.pageSeconds ?? 45,commentSeconds:state.commentSeconds ?? 12,welcomeScript:state.welcomeScript||'',closingScript:state.closingScript||'',welcomeGuidance:state.welcomeGuidance||'',closingGuidance:state.closingGuidance||'',engagementMinTurns:state.engagementMinTurns??3,engagementCooldownSeconds:state.engagementCooldownSeconds??90});
const setLiveConfig = update => { refs.current.liveConfigDirty = true; updateLiveConfig(update); };
const [liveStatus, setLiveStatus] = React.useState(null);
const [automationDraft,setAutomationDraft]=React.useState(null);
const [deviceName,setDeviceName]=React.useState(()=>{try{return window.localStorage.getItem('dsh.live.deviceName')||'浏览器'}catch{return '浏览器'}});
const [lotteryKeyword,setLotteryKeyword] = React.useState('小云送大礼');
const [lotterySeconds,setLotterySeconds] = React.useState(10);
const [liveExportSession, setLiveExportSession] = React.useState('');
const [liveExportBusy, setLiveExportBusy] = React.useState(false);
const [liveError, setLiveError] = React.useState('');
const [liveNotice, setLiveNotice] = React.useState('');
const [liveBusy, setLiveBusy] = React.useState(false);
const [livePanelLayout, setLivePanelLayout] = React.useState(null);
React.useEffect(() => {
  if (!open || tab !== 'live') return;
  const anchor = mainPanelRef.current;
  if (!anchor) return;
  const measure = () => {
    const rect = anchor.getBoundingClientRect();
    const available = rect.left - 24;
    const compact = available < 320;
    const width = compact ? window.innerWidth - 24 : Math.min(620, available);
    const left = compact ? 12 : rect.left - width - 12;
    const top = compact ? 12 : Math.max(12, rect.top);
    const height = compact ? window.innerHeight - 24 : Math.min(rect.height, window.innerHeight - top - 12);
    setLivePanelLayout(previous => previous && previous.left === left && previous.top === top && previous.width === width && previous.height === height ? previous : {left,top,width,height});
  };
  measure();
  const observer = window.ResizeObserver ? new window.ResizeObserver(measure) : null;
  if (observer) observer.observe(anchor);
  window.addEventListener('resize', measure);
  return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
}, [open, tab, settings.pos.x, settings.pos.y]);
if (!refs.current.liveOwnerId) {
  try {
    refs.current.liveOwnerId = window.sessionStorage.getItem('dsh.voiceLive.ownerId') || window.crypto.randomUUID();
    window.sessionStorage.setItem('dsh.voiceLive.ownerId', refs.current.liveOwnerId);
  } catch { refs.current.liveOwnerId = 'owner-' + Math.random().toString(36).slice(2) + Date.now(); }
}
refs.current.liveDeviceName=deviceName;
if(refs.current.liveArmed===undefined){try{refs.current.liveArmed=window.sessionStorage.getItem('dsh.live.armed')==='true'}catch{refs.current.liveArmed=false}}
const liveCall = (path, body = {}) => call(path, body);
const updateLiveStatus=state=>{
  const r=refs.current;
  r.liveRetiredEpochs=r.liveRetiredEpochs||new Set();
  if(r.liveRetiredEpochs.has(state.serverEpoch)||r.liveEpoch===state.serverEpoch&&state.revision<r.liveRevision)return false;
  if(r.liveEpoch&&r.liveEpoch!==state.serverEpoch){r.liveRetiredEpochs.add(r.liveEpoch);if(r.liveRetiredEpochs.size>5)r.liveRetiredEpochs.delete(r.liveRetiredEpochs.values().next().value)}
  r.liveEpoch=state.serverEpoch;r.liveRevision=state.revision;
  setLiveStatus(state);return true;
};
const automationFromStatus=state=>({autoRecover:state.continuity?.autoRecover??true,silenceSeconds:state.continuity?.silenceSeconds??120,loopEnabled:state.continuity?.loopEnabled??true,contextMaxTurns:1,commentMaxAgeSeconds:state.continuity?.commentMaxAgeSeconds??120,lotterySchedule:state.lotterySchedule?.config||{enabled:false,fixedTimes:[],intervalMinutes:0,metric:'heat',threshold:0},fixedTimesText:(state.lotterySchedule?.config?.fixedTimes||[]).join(', '),prizeText:(state.lottery?.config?.prizes||[]).join('\n')});
const changeAutomation=fn=>{refs.current.automationDirty=true;setAutomationDraft(fn)};
const saveAutomation=async()=>{
  setLiveBusy(true);setLiveError('');
  try{const result=await liveCall(API.liveAutomation,{...automationDraft,lotterySchedule:{...automationDraft.lotterySchedule,fixedTimes:automationDraft.fixedTimesText.split(/[，,\s]+/).filter(Boolean)},prizes:automationDraft.prizeText.split(/\n/).map(text=>text.trim()).filter(Boolean)});if(!result?.ok)throw new Error(result?.error||'自动直播设置保存失败');refs.current.automationDirty=false;setAutomationDraft(automationFromStatus(result.status));updateLiveStatus(result.status);setLiveNotice('持续直播和自动抽奖规则已保存；发完奖品后停止触发，不自动补奖。')}
  catch(error){setLiveError(String(error?.message||error))}finally{setLiveBusy(false)}
};

const applyLivePause = paused => {
  const r=refs.current;
  if(Boolean(r.livePaused)===paused)return;
  r.livePaused=paused;r.livePreparingTurn='';
  if(paused){
    r.livePauseBgmWanted=['playing','loading'].includes(r.bgm?.state().phase);
    r.activeAudio?.pause();r.bgm?.setSpeaking(false);pauseBgm();
    return;
  }
  if(!r.liveActive||!r.outputAllowed)return;
  if(r.livePauseBgmWanted&&r.settings.bgmEnabled)startBgm();
  r.livePauseBgmWanted=false;
  if(r.activeAudio){
    ensureOutputContext().resume().then(()=>r.livePaused?undefined:r.activeAudio?.play()).then(()=>{
      if(r.livePaused||!r.liveActive||!r.liveTurnId||r.livePreparingTurn===r.liveTurnId)return;
      r.livePreparingTurn=r.liveTurnId;
      liveCall(API.livePrepare,{ownerId:r.liveOwnerId,turnId:r.liveTurnId,speed:speechSpeed(r.settings)}).catch(()=>{});
    }).catch(error=>{setPlayback({phase:'error',analyser:null});setStatus('继续播放失败：'+String(error?.message||error));});
  }else{nextAudio();pumpSynthesis();}
};
const exportLiveData = async format => {
  setLiveExportBusy(true);setLiveError('');
  try {
    const sessionId=liveExportSession||liveStatus?.analytics?.current?.id;
    if(!sessionId)throw new Error('尚未采集到直播数据');
    const query=new URLSearchParams({sessionId,format});
    const response=await fetch(API.liveExport+'?'+query.toString());
    if(!response.ok){const error=await response.json();throw new Error(error.error||'导出失败')}
    const url=URL.createObjectURL(await response.blob());
    const link=document.createElement('a');link.href=url;link.download='xiaoyun-live-'+sessionId+'.'+format;
    document.body.appendChild(link);link.click();link.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),30000);
    setLiveNotice('直播数据已导出；采集中导出的是当前阶段记录。');
  }catch(error){setLiveError(String(error?.message||error))}
  finally{setLiveExportBusy(false)}
};
React.useEffect(() => {
  let disposed = false,refreshPending=false;
  const refresh = () => {
    if(refreshPending)return;refreshPending=true;
    const r=refs.current,audio=r.activeAudio;
    return liveCall(API.liveHeartbeat,{clientId:r.liveOwnerId,name:r.liveDeviceName||'浏览器',progress:r.liveActive&&audio&&!audio.paused?{turnId:r.liveTurnId,piece:r.liveProgressPiece||0,seconds:audio.currentTime}:null}).then(result => {
    if (disposed) return;
    if (!result?.ok) { setLiveError(result?.error || '无法读取直播状态'); return; }
    const state = result.status;
    if(refs.current.liveEpoch===state.serverEpoch&&state.revision<refs.current.liveRevision)return;
    if(!updateLiveStatus(state))return;
    if(!refs.current.automationDirty)setAutomationDraft(automationFromStatus(state));
    if(refs.current.liveArmed&&refs.current.outputAllowed&&state.running&&state.ownerId===refs.current.liveOwnerId&&!refs.current.liveRestarting){
      refs.current.liveActive=true;refs.current.ignoreSpeech=true;
      if(state.currentSpeech&&state.currentSpeech.turnId!==refs.current.liveTurnId)handleLiveSpeech({...state.currentSpeech,ownerId:state.ownerId,paused:state.paused});
    }
    if(refs.current.liveActive&&state.ownerId===refs.current.liveOwnerId)applyLivePause(Boolean(state.paused));
    if(!refs.current.lotteryDraftLoaded&&state.lottery?.config){setLotteryKeyword(state.lottery.config.keyword);setLotterySeconds(state.lottery.config.waitSeconds);refs.current.lotteryDraftLoaded=true}
    setLiveError(previous => /^(HTTP 502|HTTP 404|TypeError: Failed to fetch)/.test(previous) ? '' : previous);
    if (!refs.current.liveConfigDirty) updateLiveConfig(liveConfigFromStatus(state));
    if (refs.current.liveActive && !refs.current.liveRestarting && (!state.running || state.ownerId !== refs.current.liveOwnerId)) {
      refs.current.liveActive = false;
      refs.current.ignoreSpeech = false;
      stopPlayback(); pauseBgm();
    }
  }).catch(error => { if (!disposed) setLiveError(String(error?.message || error)) }).finally(()=>{refreshPending=false});
  };
  refresh();
  const interval = window.setInterval(refresh, 2500);
  return () => { disposed = true; window.clearInterval(interval); };
}, []);
const handleLiveSpeech = ev => {
  const r = refs.current;
  if (!r.liveActive || ev.ownerId !== r.liveOwnerId || !ev.turnId || ev.turnId === r.liveTurnId) return;
  applyLivePause(ev.paused===true);
  r.liveTurnId = ev.turnId;
  const speech = String(ev.text || '').trim();
  if (!speech) { setLiveError('AI 返回空口播'); return; }
  const segments = Array.isArray(ev.segments) && ev.segments.length ? ev.segments : [speech];
  setLiveStatus(state => state ? {...state,phase:'awaiting-audio',currentSpeech:{turnId:ev.turnId,text:speech},stateMachine:state.stateMachine&&ev.stage?{...state.stateMachine,current:{...state.stateMachine.nodes.find(node=>node.id===ev.stage),execution:'正在合成 / 播放；等待整段完成',since:Date.now(),reason:'当前口播正在播放'}}:state.stateMachine} : state);
  const config = ttsConfig(r.settings);
  const prepare=()=>{
    if(r.livePreparingTurn===ev.turnId)return;
    r.livePreparingTurn=ev.turnId;
    liveCall(API.livePrepare,{ownerId:r.liveOwnerId,turnId:ev.turnId,speed:config.speed}).then(result=>{
      if(result?.ok&&r.liveActive&&r.liveTurnId===ev.turnId)updateLiveStatus(result.status);
    }).catch(()=>{});
  };
  const acknowledge=()=>liveCall(API.liveAck,{ownerId:r.liveOwnerId,turnId:ev.turnId}).then(result=>{
    if(r.liveTurnId!==ev.turnId)return;
    if(!result?.ok)setLiveError('播报已完成，但继续直播失败：'+(result?.error||'未知错误'));
    else updateLiveStatus(result.status);
  }).catch(error=>setLiveError('继续直播失败：'+String(error?.message||error)));
  if(Array.isArray(ev.audioSegments)&&ev.audioSegments.length&&ev.audioSpeed===config.speed){
    ev.audioSegments.forEach((piece,index)=>playAudio(piece.audio,piece.mime||'audio/mpeg',false,Math.max(3000,piece.text.length*160),{
      onStart:()=>{r.liveProgressPiece=index;if(index===0)prepare()},onEnd:index===ev.audioSegments.length-1?acknowledge:undefined
    }));
  }else segments.forEach((part,index)=>requestTts(part,config,Math.max(3000,part.length*160+1500),{
    onStart:()=>{r.liveProgressPiece=index;if(index===0)prepare()},onEnd:index===segments.length-1?acknowledge:undefined
  }));
};
React.useEffect(()=>{
  const r=refs.current;
  if(playback.phase!=='error'||!r.liveActive)return;
  r.liveActive=false;r.ignoreSpeech=false;pauseBgm();
  setLiveError('语音合成或播放失败，请检查语音设置后重新开始。');
  liveCall(API.livePlaybackError,{ownerId:r.liveOwnerId,turnId:r.liveTurnId,error:'当前音频未能完成播放'}).then(result=>{
    if(result?.ok)updateLiveStatus(result.status);
    else setLiveError('语音失败，暂停直播失败：'+(result?.error||'未知错误'));
  }).catch(error=>setLiveError('语音失败，暂停直播失败：'+String(error?.message||error)));
},[playback.phase]);
const saveLiveConfig = async () => {
  setLiveBusy(true); setLiveError('');
  try {
    const result = await liveCall(API.liveConfig, liveConfig);
    if (!result?.ok) throw new Error(result?.error || '保存失败');
    refs.current.liveConfigDirty = false;
    updateLiveConfig(liveConfigFromStatus(result.status));
    updateLiveStatus(result.status);
  } catch(error) { setLiveError(String(error?.message || error)); }
  finally { setLiveBusy(false); }
};
const connectLive = async () => {
  setLiveBusy(true); setLiveError('');
  try {
    const result = await liveCall(API.liveConnect);
    if (!result?.ok) throw new Error(result?.error || '无法打开视频号登录页');
    updateLiveStatus(result.status);
  } catch(error) { setLiveError(String(error?.message || error)); }
  finally { setLiveBusy(false); }
};
const startLive = async (takeover=false) => {
  setLiveBusy(true); setLiveError('');
  try {
    const latest = await liveCall(API.liveStatus);
    if (!latest?.ok) throw new Error(latest?.error || '无法读取最新直播设置');
    const state = latest.status;
    const draft = refs.current.liveConfigDirty ? liveConfig : liveConfigFromStatus(state);
    if (!refs.current.liveConfigDirty) updateLiveConfig(draft);
    if (!state.running) {
      const systemPrompt = draft.systemPrompt.trim();
      const sourceText = draft.sourceText.trim();
      const presentationUrl = draft.presentationUrl.trim();
      if (!systemPrompt || (!presentationUrl && !sourceText)) throw new Error('请填写直播系统提示词，以及 HTML 演示页地址或文字素材。');
      if (Object.keys(draft).some(key=>draft[key]!==liveConfigFromStatus(state)[key])) {
        const saved = await liveCall(API.liveConfig, {...draft,systemPrompt,sourceText,presentationUrl});
        if (!saved?.ok) throw new Error(saved?.error || '保存直播设置失败');
        refs.current.liveConfigDirty = false;
        updateLiveStatus(saved.status);
      }
    }
    if((state.running||state.continuity?.wanted)&&state.ownerId&&state.ownerId!==refs.current.liveOwnerId&&takeover!==true){
      if(!state.running){const restored=await liveCall(API.liveStart,{ownerId:refs.current.liveOwnerId});if(!restored?.ok)throw new Error(restored?.error||'请求恢复失败');updateLiveStatus(restored.status)}else updateLiveStatus(state);
      setLiveNotice('已保留原播报电脑，本机仅远程控制；点击「接管播报」才转移声音输出。');return
    }
    if (refs.current.calling) await toggleCall();
    stopPlayback(); unlockAudio();
    refs.current.livePaused=Boolean(state.paused);
    if (refs.current.settings.bgmEnabled&&!state.paused) startBgm();
    refs.current.ignoreSpeech = true;
    refs.current.liveActive = true;refs.current.liveArmed=true;try{window.sessionStorage.setItem('dsh.live.armed','true')}catch{}
    refs.current.liveTurnId = '';
    const result = await liveCall(API.liveStart, {ownerId:refs.current.liveOwnerId,takeover:takeover===true});
    if (!result?.ok) throw new Error(result?.error || '启动失败');
    updateLiveStatus(result.status);
  } catch(error) { refs.current.liveActive = false; stopPlayback(); pauseBgm(); setLiveError(String(error?.message || error)); }
  finally { setLiveBusy(false); }
};
const stopLive = async () => {
  refs.current.liveActive = false;
  refs.current.ignoreSpeech = false;
  stopPlayback(); pauseBgm(); setLiveBusy(true);
  try {
    const result = await liveCall(API.liveStop);
    if (!result?.ok) throw new Error(result?.error || '停止失败');
    updateLiveStatus(result.status); setLiveError('');
  } catch(error) { setLiveError(String(error?.message || error)); }
  finally { setLiveBusy(false); }
};
const toggleLivePause = async () => {
  const paused=Boolean(liveStatus?.paused);
  setLiveBusy(true);setLiveError('');
  try{
    if(paused&&liveStatus?.ownerId===refs.current.liveOwnerId&&!refs.current.liveActive){await startLive();refs.current.livePauseBgmWanted=Boolean(refs.current.settings.bgmEnabled);}
    if(refs.current.liveActive){if(paused)unlockAudio();else applyLivePause(true)}
    const result=await liveCall(paused?API.liveResume:API.livePause);
    if(!result?.ok)throw new Error(result?.error||'暂停或继续失败');
    if(refs.current.liveActive)applyLivePause(Boolean(result.status.paused));updateLiveStatus(result.status);
  }catch(error){if(!paused&&refs.current.liveActive)applyLivePause(false);setLiveError(String(error?.message||error));}
  finally{setLiveBusy(false);}
};
const restartLive = async () => {
  const r=refs.current;
  setLiveBusy(true);setLiveError('');r.liveRestarting=true;
  const previousTurn=r.liveTurnId;
  try{
    const result=await liveCall(API.liveRestart,{ownerId:r.liveOwnerId});
    if(!result?.ok)throw new Error(result?.error||'重新开始失败');
    const owned=result.status.ownerId===r.liveOwnerId;
    r.liveActive=owned;r.ignoreSpeech=owned;
    if(owned){if(r.liveTurnId===previousTurn){stopPlayback();pauseBgm();r.liveTurnId=''}r.liveArmed=true;try{window.sessionStorage.setItem('dsh.live.armed','true')}catch{};unlockAudio();if(r.settings.bgmEnabled)startBgm()}
    updateLiveStatus(result.status);setLiveNotice('已同步回到第一页，奖品池和已发记录保留；'+(owned?'本机继续播报。':'原播报电脑继续输出声音。'));
  }catch(error){setLiveError(String(error?.message||error));}
  finally{r.liveRestarting=false;setLiveBusy(false);}
};
const finishLive = async () => {
  setLiveBusy(true);setLiveError('');
  try {
    const result=await liveCall(API.liveFinish);
    if(!result?.ok)throw new Error(result?.error||'结束请求失败');
    updateLiveStatus(result.status);
  }catch(error){setLiveError(String(error?.message||error));}
  finally{setLiveBusy(false);}
};
const changeLiveSlide = async index => {
  setLiveBusy(true); setLiveError('');
  try {
    const result = await liveCall(API.liveSlide, {index});
    if (!result?.ok) throw new Error(result?.error || '翻页失败');
    updateLiveStatus(result.status);
    if (refs.current.liveActive) { refs.current.liveTurnId = ''; stopPlayback(); unlockAudio(); }
  } catch(error) { setLiveError(String(error?.message || error)); }
  finally { setLiveBusy(false); }
};
const changeLiveAuto = async enabled => {
  setLiveBusy(true); setLiveError('');
  try {
    const result = await liveCall(API.liveAuto, {enabled});
    if (!result?.ok) throw new Error(result?.error || '自动翻页设置失败');
    updateLiveStatus(result.status);
  } catch(error) { setLiveError(String(error?.message || error)); }
  finally { setLiveBusy(false); }
};
const openLivePresentation = async () => {
  setLiveBusy(true); setLiveError('');
  try {
    const result = await liveCall(API.livePresentationOpen,{url:liveConfig.presentationUrl.trim()});
    if (!result?.ok) throw new Error(result?.error || '打开演示页失败');
    updateLiveStatus(result.status);
    setLiveConfig(config=>({...config,presentationUrl:result.status.presentationUrl}));
    setLiveNotice('已向专用 Chrome 发送打开指令；OBS 可抓取这扇 Chrome 窗口。');
  } catch(error) { setLiveError(String(error?.message || error)); }
  finally { setLiveBusy(false); }
};
const navigateLivePresentation = async direction => {
  setLiveBusy(true); setLiveError('');
  try {
    const result = await liveCall(API.livePresentationNav,{direction});
    if (!result?.ok) throw new Error(result?.error || '翻页失败');
    updateLiveStatus(result.status);
  } catch(error) { setLiveError(String(error?.message || error)); }
  finally { setLiveBusy(false); }
};
const saveLivePace = async () => {
  setLiveError('');
  try {
    const result = await liveCall(API.livePace,{commentFrequency:liveConfig.commentFrequency,pageSeconds:liveConfig.pageSeconds,commentSeconds:liveConfig.commentSeconds,engagementMinTurns:liveConfig.engagementMinTurns,engagementCooldownSeconds:liveConfig.engagementCooldownSeconds});
    if (!result?.ok) throw new Error(result?.error || '节奏设置失败');
    if (['systemPrompt','sourceText','presentationUrl','welcomeScript','closingScript','welcomeGuidance','closingGuidance'].every(key => liveConfig[key] === result.status[key])) { refs.current.liveConfigDirty = false; updateLiveConfig(liveConfigFromStatus(result.status)); }
    updateLiveStatus(result.status);
  } catch(error) { setLiveError(String(error?.message || error)); }
};
const openLiveStage = () => {
  if (liveStatus?.stagePath) window.open(liveStatus.stagePath, '_blank', 'noopener,noreferrer');
};
const copyLiveStage = async () => {
  try {
    await navigator.clipboard.writeText(new URL(liveStatus.stagePath, window.location.origin).href);
    setLiveNotice('已复制直播画面链接，可粘贴到 OBS 浏览器源。');
  } catch { setLiveError('复制失败，请打开展示页后从地址栏复制链接。'); }
};
const liveCaptureRecent = Date.now() - Number(liveStatus?.captureAt || 0) < 30000;
const liveCommentCount = Number(liveStatus?.commentCount || 0);
const liveSlides = liveStatus?.slides || [];
const liveSlide = liveSlides[liveStatus?.slideIndex || 0];
const liveSummary = !liveStatus?.bridgeConnected
  ? '未连接到场控 Mac，尚未获取弹幕'
  : !liveStatus?.browserOpen
    ? '专用 Chrome 未打开，尚未获取弹幕'
  : liveCommentCount > 0
    ? '已获取 ' + liveCommentCount + ' 条文字弹幕'
    : liveCaptureRecent
      ? '已收到直播消息，当前 0 条文字弹幕'
      : liveStatus?.pagePath === '/platform/'
        ? '尚未获取弹幕：当前停在视频号后台首页'
        : '尚未获取弹幕：等待直播消息响应';
const renderLiveMachine = () => {
  const machine=liveStatus?.stateMachine;
  if(!machine)return e('div',{className:'va-hint'},'正在读取直播流程…');
  const metrics=machine.metrics;
  const label=id=>machine.nodes.find(node=>node.id===id)?.label||id;
  return e('section',{'aria-label':'直播状态与转移条件'},
    liveStatus?.generation?e('div',{className:'va-hint',role:'status'},'文案模型：'+liveStatus.generation.label+(liveStatus.generation.fallbackActive?' · 已自动切换备用':'')):null,
    e(LiveStateGraph,{machine}),
    e('div',{className:'va-live-map-metrics'},e('span',null,'未读弹幕 '+metrics.unreadCount+' 条'),e('span',null,'当前页已讲 '+metrics.sourceTurnsOnPage+' 段'),metrics.pageCount?e('span',null,'第 '+metrics.pageNumber+'/'+metrics.pageCount+' 页'):null),
    metrics.closingRequested?e('div',{style:{color:'#ffdba3',fontSize:13}},'已请求结束整场：播完当前整段后告别并停止，不再自动续播。'):null,
      liveStatus.preparation ? e('div',{className:'va-hint',role:'status'},'下一段：'+({generating:'正在提前生成文本',synthesizing:'正在提前合成音频 '+liveStatus.preparation.piecesReady+'/'+liveStatus.preparation.piecesTotal,ready:'文本和音频已就绪，等待本段播完',error:'预备未完成，本段结束后重试'}[liveStatus.preparation.phase]||'准备中')) : e('div',{className:'va-hint'},'本段开始播放后，自动准备下一段文本和音频；段末检查弹幕、抽奖和结束请求。'),
    e('details',{style:{marginTop:8}},e('summary',{style:{cursor:'pointer',color:'#c7c9ff',fontSize:12}},'详细条件与最近转移'),
      e('div',{className:'va-hint'},'当前：'+machine.current.reason),
    e('div',{className:'va-hint'},'互动间隔：'+metrics.engagementTurns+'/'+metrics.engagementMinTurns+' 段 · '+Math.min(metrics.engagementElapsedSeconds,metrics.engagementCooldownSeconds)+'/'+metrics.engagementCooldownSeconds+' 秒'),
      e('div',{className:'va-hint'},'整段口播结束后才调度。优先级从上到下：'),
      machine.transitions.map((rule,index)=>e('div',{key:index,style:{padding:'7px 0',borderBottom:'1px solid #373d56',fontSize:12}},e('strong',{style:{color:rule.selected?'#a2efc5':'#c8cde1'}},rule.label+' · '+(rule.ready?(rule.blocked?'条件已满足，等待前序':'条件已满足'):'条件未满足')),e('div',{style:{marginTop:3,color:'#aab2ce'}},rule.condition))),
      e('div',{className:'va-hint'},'连接或页面不可用时进入等待恢复；异常进入暂停，可处理后重新开始。'),
      machine.history.length?e('div',null,e('div',{style:{fontSize:13,marginTop:10}},'最近状态转移'),machine.history.slice(-6).reverse().map((entry,index)=>e('div',{key:index,className:'va-hint'},new Date(entry.at).toLocaleTimeString()+' · '+label(entry.from)+' → '+label(entry.to)+'：'+entry.reason))):null
    )
  );
};
const renderLiveActions = () => e('div',{className:'va-row',style:{flexWrap:'wrap',gap:6}},
  e('button',{className:'va-btn',disabled:liveBusy||liveStatus?.paused||liveStatus?.stateMachine?.metrics?.closingRequested||(!liveStatus?.running&&!liveStatus?.bridgeConnected),onClick:liveStatus?.running?finishLive:startLive,title:liveStatus?.running?'播完当前整段后告别并停止整场，不会自动续播':'开始播报；开启自动续播后，最后一页讲完会回到第一页'},liveStatus?.running?'结束整场并告别':'▶ 开始 AI 直播'),
  e('button',{className:'va-btn ghost',disabled:liveBusy||!liveStatus?.running&&!liveStatus?.continuity?.wanted,onClick:toggleLivePause},liveStatus?.paused?'▶ 继续':'⏸ 暂停'),
  e('button',{className:'va-btn ghost',disabled:liveBusy||!liveStatus?.bridgeConnected||!liveStatus?.browserOpen||!liveStatus?.systemPrompt,onClick:restartLive,title:'回到 PPT 第一页，保留奖品池和中奖记录；由原播报端继续输出'},'↻ 重新开始'),
  liveStatus?.running||liveStatus?.continuity?.wanted?e('button',{className:'va-btn danger',disabled:liveBusy,onClick:stopLive},'立即停止'):null,
  liveStatus?.flashSale?.configured?e('button',{className:'va-btn ghost',disabled:liveBusy||!liveStatus.running||liveStatus.paused||liveStatus.flashSale.active||liveStatus.flashSale.queued,onClick:()=>controlFlashSale('show')},liveStatus.flashSale.active?'秒杀展示中':liveStatus.flashSale.queued?'秒杀已排队':'展示秒杀码'):e('button',{className:'va-btn ghost',disabled:liveBusy||liveStatus?.paused||liveStatus?.lottery?.drawsUsed>=liveStatus?.lottery?.drawsTotal||['queued','announcing','waiting','result'].includes(liveStatus?.lottery?.current?.state)||!liveStatus?.running||liveStatus?.stateMachine?.metrics?.closingRequested||!lotteryKeyword.trim(),onClick:queueLiveLottery},liveStatus?.lottery?.current?.state==='queued'?'抽奖已排队':['announcing','waiting','result'].includes(liveStatus?.lottery?.current?.state)?'抽奖进行中':'开始抽奖'),
  (liveStatus?.running||liveStatus?.continuity?.wanted)&&liveStatus?.ownerId!==refs.current.liveOwnerId?e('button',{className:'va-btn ghost',disabled:liveBusy,onClick:()=>startLive(true)},'接管播报'):null,
  liveStatus?.running&&liveStatus?.ownerId===refs.current.liveOwnerId&&!refs.current.liveActive?e('button',{className:'va-btn ghost',disabled:liveBusy,onClick:startLive},'接回播报'):null
);
const queueLiveLottery = async () => {
  setLiveBusy(true);setLiveError('');
  try{
    const result=await liveCall(API.liveLottery,{keyword:lotteryKeyword,waitSeconds:lotterySeconds});
    if(!result?.ok)throw new Error(result?.error||'抽奖排队失败');
    updateLiveStatus(result.status);setLiveNotice('');
  }catch(error){setLiveError(String(error?.message||error))}
  finally{setLiveBusy(false)}
};
const controlFlashSale=async action=>{setLiveBusy(true);setLiveError('');try{const result=await liveCall(API.liveFlashSale,{action});if(!result.ok)throw new Error(result.error||'秒杀操作失败');updateLiveStatus(result.status)}catch(error){setLiveError(String(error.message||error))}finally{setLiveBusy(false)}};
const renderLiveLottery = () => {
  if(liveStatus?.flashSale)return e(FlashSalePanel,{status:liveStatus,request:body=>liveCall(API.liveFlashSale,body),onStatus:updateLiveStatus});
  const draw=liveStatus?.lottery?.current;
  const active=['queued','announcing','waiting','result'].includes(draw?.state);
  const names={queued:'已排队，等待当前整段播完',announcing:'正在说明参与方式',waiting:'参与倒计时',result:'正在播报开奖结果',completed:'本轮已结束',cancelled:'本轮已取消',interrupted:'本轮已中断，已有结果保留'};
  return e('div',{style:{border:'1px solid #60528d',borderRadius:10,padding:'12px',background:'#302c47'}},
    e('strong',null,'弹幕口令抽奖'),
    e('div',{className:'va-hint'},'奖品池共 '+(liveStatus?.lottery?.drawsTotal||0)+' 份，已送出 '+(liveStatus?.lottery?.drawsUsed||0)+' 份；'+(liveStatus?.lottery?.nextPrize?'下一份：'+liveStatus.lottery.nextPrize:'本场奖品已送完')+'。中奖后引导扫描屏幕右下方二维码进群领奖。'),
    e('label',{htmlFor:'va-lottery-keyword',style:{display:'block',marginTop:8}},'抽奖口令'),
    e('input',{id:'va-lottery-keyword',className:'va-input',value:lotteryKeyword,maxLength:60,disabled:active,onChange:event=>{refs.current.lotteryDraftLoaded=true;setLotteryKeyword(event.target.value)},placeholder:'观众需完整输入的文字'}),
    e('div',{className:'va-row'},e('label',{htmlFor:'va-lottery-seconds'},'参与时间'),e('input',{id:'va-lottery-seconds',className:'va-input',type:'number',min:5,max:60,step:1,value:lotterySeconds,disabled:active,style:{width:70},onChange:event=>{refs.current.lotteryDraftLoaded=true;setLotterySeconds(Number(event.target.value))}}),e('span',null,'秒'),
      e('span',{className:'va-hint'},'点击导演台顶部「开始抽奖」排队')),
    e('div',{className:'va-hint'},'播完当前整段后插入：说明本轮奖品与口令 → 限时互动 → 读弹幕开奖 → 继续直播。参与方式播完才计时；第一条完整匹配口令的新弹幕中奖。'),
    draw?e('div',{className:'va-hint',role:'status'},(names[draw.state]||draw.state)+(draw.state==='waiting'?' · 剩余 '+liveStatus.lottery.remainingSeconds+' 秒':'')):null,
    draw?.winner?e('div',{style:{color:'#f8dc8f',fontWeight:600,overflowWrap:'anywhere'}},'中奖 ID：'+draw.winner.nickname):null,
    draw?.outcome==='empty'?e('div',{className:'va-hint'},'未收到匹配口令，本轮没有中奖者。'):null,
    draw?.reason?e('div',{className:'va-hint'},draw.reason):null
  );
};
const renderLiveContinuity=()=>{
  const c=liveStatus?.continuity,p=liveStatus?.playback;
  if(!c||!p)return null;
  const local=p.ownerId===refs.current.liveOwnerId;
  return e('div',{className:'va-set',style:{marginBottom:10}},
    e('strong',null,!p.ownerId?'本机：待开播':local?'本机：声音播报端':'本机：远程监控端'),
    e('div',{className:'va-hint'},(p.ownerId?'声音输出：'+p.name+' · '+(p.online?'在线':'离线，等待原电脑连接'):'在 OBS 电脑点击开始 AI 直播，指定声音输出端')+' · 第 '+c.cycle+' 轮'),
    e('label',{style:{display:'flex',gap:6,alignItems:'center'}},'本机名称',e('input',{className:'va-input',value:deviceName,maxLength:60,onChange:event=>{setDeviceName(event.target.value);try{window.localStorage.setItem('dsh.live.deviceName',event.target.value)}catch{}}})),
    local&&liveStatus?.running&&!refs.current.outputAllowed?e('div',{className:'va-hint',role:'status'},'本机声音尚未启用，请点击「接回播报」恢复出声。'):null,
    e('div',{className:'va-hint'},'控制操作在所有电脑同步；监控端不出声，点击「接管播报」才转移声音。'),
    e('div',{className:'va-hint'},(c.autoRecover?'连续 '+c.silenceSeconds+' 秒无播放进度会自动恢复':'自动恢复已关闭')+' · '+(c.loopEnabled?'自然播完整轮自动回到第一页；手动结束整场会停止':'播完整轮后结束')+(liveStatus?.flashSale?.configured?' · 整点触发记录持续保留':' · 奖品池持续保留')),
    c.wanted&&!liveStatus?.paused?e('div',{className:'va-hint',role:'status'},'距上次声音进度 '+c.silentSeconds+' 秒 · 已恢复 '+c.recoveries+' 次'+(c.lastRecoveryReason?' · '+c.lastRecoveryReason:'')):null,
    e('div',{className:'va-hint'},'上下文：当前页 + 近期已播摘要；弹幕有效期 '+c.commentMaxAgeSeconds+' 秒，最多100条；过长时按输入预算取最新消息。'+(liveStatus?.context?.lastPromptCharacters?'最近一轮素材 '+liveStatus.context.lastPromptCharacters+' 字符。':'')),
    p.clients?.length?e('div',{className:'va-hint'},'在线控制端：'+p.clients.map(client=>client.name+'（'+(client.role==='playback'?'播报':'监控')+'）').join('、')):null
  );
};
const renderAutomationSettings=()=>{
  const draft=automationDraft;if(!draft)return null;
  const locked=liveBusy||liveStatus?.running;
  const setSchedule=(key,value)=>changeAutomation(old=>({...old,lotterySchedule:{...old.lotterySchedule,[key]:value}}));
  const input=(label,key,min,max)=>e('label',{style:{display:'flex',gap:6,alignItems:'center',marginTop:7}},label,e('input',{className:'va-input','aria-label':label,type:'number',min,max,value:draft.lotterySchedule[key],disabled:locked,onChange:event=>setSchedule(key,Number(event.target.value)),style:{width:100}}));
  return e('details',{className:'va-set',style:{marginTop:10}},
    e('summary',null,liveStatus?.flashSale?.configured?'持续直播设置（开播前设置）':'持续直播与自动抽奖（开播前设置）'),
    e('label',{style:{display:'block',marginTop:10}},e('input',{type:'checkbox',checked:draft.autoRecover,disabled:locked,onChange:event=>changeAutomation(old=>({...old,autoRecover:event.target.checked}))}),' 连续2分钟无声自动恢复'),
    e('label',{style:{display:'block',marginTop:8}},e('input',{type:'checkbox',checked:draft.loopEnabled,disabled:locked,onChange:event=>changeAutomation(old=>({...old,loopEnabled:event.target.checked}))}),' 本轮播完从第一页续播，保留奖品池'),
    !liveStatus?.flashSale?.configured?e(Fragment,null,
    e('label',{style:{display:'block',marginTop:8}},e('input',{type:'checkbox',checked:draft.lotterySchedule.enabled,disabled:locked,onChange:event=>setSchedule('enabled',event.target.checked)}),' 启用自动抽奖'),
    e('label',{style:{display:'block',marginTop:8}},'每天指定时间（北京时间，多个用逗号分隔）'),
    e('input',{className:'va-input','aria-label':'指定抽奖时间',placeholder:'例如 12:00, 19:30',value:draft.fixedTimesText,disabled:locked,onChange:event=>changeAutomation(old=>({...old,fixedTimesText:event.target.value}))}),
    input('间隔分钟（0关闭，60为每小时）','intervalMinutes',0,1440),
    e('label',{style:{display:'block',marginTop:8}},'人气指标',e('select',{className:'va-input',value:draft.lotterySchedule.metric,disabled:locked,onChange:event=>setSchedule('metric',event.target.value)},e('option',{value:'heat'},'热度 / 人气值'),e('option',{value:'onlineUsers'},'当前在线人数'))),
    input('达到阈值触发一次（0关闭）','threshold',0,1000000000),
    e('div',{className:'va-hint'},'条件达到后，在当前完整口播结束时插入。重复条件只触发一次，不抢断句子；不会用过期或未取得的人气值开奖。'),
    e('label',{style:{display:'block',marginTop:8}},'奖品池：一行一份，可重复名称'),
    e('textarea',{className:'va-input','aria-label':'奖品池',style:{minHeight:90,resize:'vertical'},value:draft.prizeText,disabled:locked,onChange:event=>changeAutomation(old=>({...old,prizeText:event.target.value}))}),
    e('div',{className:'va-hint'},'已发出 '+(liveStatus?.lottery?.drawsUsed||0)+' 份：已发部分必须保留原顺序，只能追加或调整未发部分。奖品发完自动跳过，重播、恢复和服务重启均不补奖。'),
    liveStatus?.lotterySchedule?.nextIntervalAt?e('div',{className:'va-hint'},'下一次间隔触发：'+new Date(liveStatus.lotterySchedule.nextIntervalAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})):null,
    liveStatus?.lotterySchedule?.lastReason?e('div',{className:'va-hint',role:'status'},liveStatus.lotterySchedule.lastReason):null):null,
    e('button',{className:'va-btn',disabled:locked,onClick:saveAutomation,style:{marginTop:8}},'保存持续直播设置')
  );
};
const renderLivePanel = () => e(Fragment, null,
  e('div',{className:'va-set'},
    renderLiveContinuity(),
    renderAutomationSettings(),
    renderLiveMachine(),
    e('div',{className:'va-hint'},'连接视频号会新开一扇专用 Chrome 窗口；出现二维码时扫码，再进入正在进行的直播大屏。'),
    e('button',{className:'va-btn ghost',disabled:liveBusy||liveStatus?.running||liveStatus?.loginPending,onClick:connectLive},'打开专用 Chrome · 连接视频号'),
    e('div',{role:'status',style:{padding:'12px 14px',borderRadius:10,border:'1px solid '+(liveCommentCount?'#2f9d71':'#d89039'),background:liveCommentCount?'#eaf8ef':'#fff4e5',color:'#243247'}},
      e('strong',null,liveSummary),
      e('div',{style:{fontSize:12,marginTop:6}},'Mac 监听：'+(liveStatus?.bridgeConnected?'在线':'离线')+' · Chrome 窗口：'+(liveStatus?.browserOpen?'已打开':'未打开')+' · 视频号消息响应：'+(liveCaptureRecent?'最近已收到':'未收到')+' · 弹幕：'+liveCommentCount+' 条'),
      liveStatus?.loginPending?e('div',{style:{fontSize:12,marginTop:4}},'打开指令已发送，等待 Mac 响应…'):null,
      liveStatus?.loginOpenedAt?e('div',{style:{fontSize:12,marginTop:4}},'专用 Chrome 已响应：'+new Date(liveStatus.loginOpenedAt).toLocaleTimeString()):null,
      liveStatus?.pagePath?e('div',{style:{fontSize:12,marginTop:4}},'当前页面：'+liveStatus.pagePath):null,
      liveStatus?.captureAt?e('div',{style:{fontSize:12,marginTop:4}},'最近消息响应：'+new Date(liveStatus.captureAt).toLocaleTimeString()):null
    ),
    e('div',{className:'va-hint'},liveStatus?.running?'暂停会保留音频进度；重新开始同步回到第一页，保留奖品池和中奖记录。结束整场并告别会等整段播完，然后停止，不再续播。':liveStatus?.continuity?.loopEnabled?'开始先欢迎；自然播完本轮从第一页续播。「结束整场并告别」会停止整场，不会续播。':'开始先欢迎；本轮播完后播放告别。'),
    renderLiveLottery(),
    e('details',{style:{border:'1px solid #373d56',borderRadius:10,padding:'10px 12px'}},
      e('summary',{style:{cursor:'pointer',fontSize:14}},'直播数据导出'),
      e('div',{className:'va-hint'},'后台数据默认每 5 秒采样，小云每轮可看到最新指标。视频号结束后自动生成报告；停止小云播报不会停止采集。'),
      e('select',{className:'va-input','aria-label':'直播数据记录',value:liveExportSession||liveStatus?.analytics?.current?.id||'',disabled:!liveStatus?.analytics?.sessions?.length,onChange:event=>setLiveExportSession(event.target.value)},
        liveStatus?.analytics?.sessions?.length?liveStatus.analytics.sessions.map(session=>e('option',{key:session.id,value:session.id},new Date(session.startedAt).toLocaleString()+' · '+(session.endedAt?'已结束':'采集中')+' · '+session.snapshotCount+' 个切片')):e('option',{value:''},'尚未采集到直播数据')
      ),
      e('div',{className:'va-row'},['json','csv','md'].map(format=>e('button',{key:format,className:'va-btn ghost',disabled:liveExportBusy||!liveStatus?.analytics?.sessions?.length,onClick:()=>exportLiveData(format)},format==='json'?'完整数据 JSON':format==='csv'?'时间切片 CSV':'汇总报告 Markdown'))),
      e('div',{className:'va-hint'},'JSON 含汇总、时间切片及弹幕/互动明细；CSV 含指标、采集时间和来源。未取得的指标为空，最高在线按采集窗口统计。')
    ),
    renderBgmControls(),
    e('label',null,'HTML 演示页地址'),
    e('input',{className:'va-input',type:'url',value:liveConfig.presentationUrl,onChange:event=>setLiveConfig(config=>({...config,presentationUrl:event.target.value})),placeholder:'http://127.0.0.1:8080/slides.html 或 https://…'}),
    e('div',{className:'va-hint'},'演示稿转成网页后填入地址。网页会在收弹幕的专用 Chrome 里打开第二个标签页；OBS 抓取该 Chrome 窗口。127.0.0.1 指这台 Mac。'),
    e('div',{className:'va-row'},
      e('button',{className:'va-btn ghost',disabled:liveBusy||liveStatus?.running||!liveConfig.presentationUrl.trim(),onClick:openLivePresentation},'在 Chrome 打开演示页'),
      e('button',{className:'va-btn ghost',disabled:liveBusy||!liveStatus?.presentation?.open,onClick:()=>navigateLivePresentation('prev')},'← 上一页'),
      e('button',{className:'va-btn ghost',disabled:liveBusy||!liveStatus?.presentation?.open,onClick:()=>navigateLivePresentation('next')},'下一页 →')
    ),
    e('div',{role:'status',style:{padding:'12px 14px',borderRadius:10,border:'1px solid #395d92',background:'#17203b',color:'#e5efff'}},
      e('strong',null,liveStatus?.presentation?.open ? (liveStatus.presentation.title||'当前演示页') : '演示页尚未打开'),
      e('div',{style:{fontSize:12,whiteSpace:'pre-wrap',maxHeight:120,overflow:'auto',marginTop:6}},liveStatus?.presentation?.visibleText?.slice(0,700)||'打开后，这里会显示 AI 实际读到的当前页文字。'),
      liveStatus?.presentation?.error?e('div',{style:{fontSize:12,color:'#ffb4ae',marginTop:5}},liveStatus.presentation.error):null,
      liveStatus?.presentation?.capturedAt?e('div',{style:{fontSize:11,opacity:.7,marginTop:5}},'读取时间：'+new Date(liveStatus.presentation.capturedAt).toLocaleTimeString()):null
    ),
    e('label',{style:{display:'flex',gap:8,alignItems:'center'}},e('input',{type:'checkbox',checked:liveStatus?.autoAdvance!==false,disabled:liveBusy,onChange:event=>changeLiveAuto(event.target.checked)}),'AI 讲完当前页后自动翻页'),
    e('label',null,'念弹幕频率 · '+liveConfig.commentFrequency+'%'),
    e('input',{type:'range','aria-label':'念弹幕频率',min:0,max:100,step:5,value:liveConfig.commentFrequency,onChange:event=>setLiveConfig(config=>({...config,commentFrequency:Number(event.target.value)})),onPointerUp:saveLivePace,onKeyUp:saveLivePace,onBlur:saveLivePace,style:{width:'100%'}}),
    e('div',{className:'va-hint'},'低频：约每 3 段讲解回应一轮弹幕；高频：每段讲解后可回应一轮。每轮最多读取最近 100 条未读弹幕，较早积压不再补读，可概括共同话题或点名回复；不会连续只聊弹幕。'),
    e('label',null,'每段口播目标 · '+liveConfig.pageSeconds+' 秒'),
    e('input',{type:'range','aria-label':'每段口播目标时长',min:10,max:60,step:5,value:liveConfig.pageSeconds,onChange:event=>setLiveConfig(config=>({...config,pageSeconds:Number(event.target.value)})),onPointerUp:saveLivePace,onKeyUp:saveLivePace,onBlur:saveLivePace,style:{width:'100%'}}),
    e('div',{className:'va-hint'},'一页可以连续讲多段；AI 认为讲完后才翻页。'+(liveStatus?.running?'当前页已讲 '+(liveStatus.pageSourceTurns||0)+' 段。':'')),
    e('label',null,'每轮弹幕回应目标 · '+liveConfig.commentSeconds+' 秒'),
    e('input',{type:'range','aria-label':'每轮弹幕回应目标时长',min:5,max:30,step:1,value:liveConfig.commentSeconds,onChange:event=>setLiveConfig(config=>({...config,commentSeconds:Number(event.target.value)})),onPointerUp:saveLivePace,onKeyUp:saveLivePace,onBlur:saveLivePace,style:{width:'100%'}}),
    liveStatus?.lastCommentBatchCount?e('div',{className:'va-hint'},'最近一轮 AI 已读取 '+liveStatus.lastCommentBatchCount+' 条新弹幕。'):null,
    e('label',null,'直播系统提示词'),
    e('textarea',{className:'va-input',style:{minHeight:100,resize:'vertical'},value:liveConfig.systemPrompt,onChange:event=>setLiveConfig(config=>({...config,systemPrompt:event.target.value})),placeholder:'小云的身份、话术、禁忌和互动目标'}),
    e('label',null,'固定开场口播（按原文播放）'),
    e('textarea',{className:'va-input',style:{minHeight:60,resize:'vertical'},value:liveConfig.welcomeScript,maxLength:1200,onChange:event=>setLiveConfig(config=>({...config,welcomeScript:event.target.value}))}),
    e('label',null,'固定结束口播（按原文播放）'),
    e('textarea',{className:'va-input',style:{minHeight:60,resize:'vertical'},value:liveConfig.closingScript,maxLength:1200,onChange:event=>setLiveConfig(config=>({...config,closingScript:event.target.value}))}),
    e('label',null,'互动至少间隔 '+liveConfig.engagementMinTurns+' 段讲解、'+liveConfig.engagementCooldownSeconds+' 秒（两项都满足）'),
    e('div',{className:'va-row'},e('input',{className:'va-input',type:'number','aria-label':'互动最少讲解段数',min:2,max:20,value:liveConfig.engagementMinTurns,style:{width:85},onChange:event=>setLiveConfig(config=>({...config,engagementMinTurns:Number(event.target.value)})),onBlur:saveLivePace}),e('span',{className:'va-hint'},'段'),e('input',{className:'va-input',type:'number','aria-label':'互动最短间隔秒数',min:30,max:600,value:liveConfig.engagementCooldownSeconds,style:{width:95},onChange:event=>setLiveConfig(config=>({...config,engagementCooldownSeconds:Number(event.target.value)})),onBlur:saveLivePace}),e('span',{className:'va-hint'},'秒')),
    e('div',{className:'va-hint'},'到间隔后仍由 AI 判断是否适合互动；弹幕优先，互动不算一段讲解。'),
    e('label',null,'补充口播素材（可选）'),
    e('div',{className:'va-hint'},'HTML 演示页为主要内容；这里可以填写背景信息和必须提到的要点。若没有演示页地址，这里的文字会按段落作为简易幻灯片。'),
    e('textarea',{className:'va-input',style:{minHeight:120,resize:'vertical'},value:liveConfig.sourceText,onChange:event=>setLiveConfig(config=>({...config,sourceText:event.target.value})),placeholder:'补充信息、活动规则、希望小云讲到的重点…'}),
    !liveConfig.presentationUrl.trim()&&liveSlides.length?e('div',{className:'va-row'},
      e('button',{className:'va-btn ghost',disabled:liveBusy||liveStatus.slideIndex===0,onClick:()=>changeLiveSlide(liveStatus.slideIndex-1)},'← 上一段'),
      e('button',{className:'va-btn ghost',disabled:liveBusy||liveStatus.slideIndex>=liveSlides.length-1,onClick:()=>changeLiveSlide(liveStatus.slideIndex+1)},'下一段 →'),
      e('button',{className:'va-btn ghost',onClick:openLiveStage},'打开展示页'),
      e('button',{className:'va-btn ghost',onClick:copyLiveStage},'复制 OBS 链接')
    ):null,
    e('div',{className:'va-row'},
      e('button',{className:'va-btn ghost',disabled:liveBusy||liveStatus?.running,onClick:saveLiveConfig},'保存设置')
    ),
    liveStatus?.currentSpeech?e('div',{className:'va-hint'},'当前口播：'+liveStatus.currentSpeech.text):null,
    liveStatus?.speechSegmentCount>1?e('div',{className:'va-hint'},'本轮口播已提前排队合成 '+liveStatus.speechSegmentCount+' 段音频；整轮播完后检查新弹幕。'):null,
    liveStatus?.recentComments?.length?e('div',null,
      e('label',null,'最近弹幕'),
      liveStatus.recentComments.slice().reverse().map((item,index)=>e('div',{className:'va-msg',key:index},
        e('span',{className:'va-tag'},item.nickname),item.content))
    ):null
  )
);
const renderLiveOperatorPanel = () => !livePanelLayout ? null : e('aside',{className:'va-cues',role:'region','aria-label':'直播导演台',style:livePanelLayout},
  e('div',{className:'va-cues-head',style:{flexWrap:'wrap'}},e('div',{className:'va-cues-heading',style:{minWidth:150}},e('h2',{className:'va-cues-title'},'直播导演台'),e('div',{className:'va-cues-caption'},'开场 → 讲解与互动 → 告别')),renderLiveActions()),
  e('div',{'aria-label':'直播操作反馈',style:{flexShrink:0,padding:'0 14px'}},
    (liveError||liveStatus?.error)?e('div',{role:'alert',style:{color:'#ffb4ae',background:'#562b35',padding:'8px 10px',borderRadius:8,fontSize:12}},liveError||liveStatus.error):null,
    ['queued','announcing','waiting','result'].includes(liveStatus?.lottery?.current?.state)?e('div',{role:'status',style:{padding:'8px 10px',background:'#393155',color:'#ddd0ff',borderRadius:8,fontSize:12}},({
      queued:liveStatus.phase==='waiting-bridge'?'抽奖已排队，等待 Mac 监听和专用 Chrome 恢复连接。':liveStatus.phase==='thinking'?'抽奖已排队，当前这段生成并完整播完后，下一步就开始抽奖。':'抽奖已排队，当前整段口播播完后，下一步就开始抽奖。',
      announcing:'抽奖已开始：正在说明参与方式，整段播完后开始计时。',
      waiting:liveStatus.lottery.remainingSeconds>0?'抽奖参与中：剩余 '+liveStatus.lottery.remainingSeconds+' 秒。':'参与时间已到，等待本段互动播完后公布结果。',
      result:'正在播报抽奖结果，播完后继续原来的直播内容。'
    })[liveStatus.lottery.current.state]):
    liveNotice?e('div',{role:'status',style:{fontSize:12,padding:'6px 0',color:'#c7c9ff'}},liveNotice):null,
    ['queued','announcing','waiting','result'].includes(liveStatus?.lottery?.current?.state)&&!liveCaptureRecent?e('div',{role:'status',style:{fontSize:12,padding:'6px 0',color:'#ffdba3'}},'尚未收到近期弹幕响应，请在专用 Chrome 打开直播大屏。抽奖按参与期间实际收到的弹幕判定，没有匹配弹幕就不产生中奖者。'):null
  ),
  e('div',{className:'va-cues-list'},renderLivePanel())
);
const renderLiveAvatar = () => e(Fragment,null,
  e(VoiceAvatar,{mode:avatarMode,analyser:playback.analyser,onPreview:previewVoice,onStop:liveStatus?.running?stopLive:stopPlayback,previewBusy,previewDisabled:liveStatus?.running}),
  e('div',{className:'va-hint'},'直播设置与翻页控制在左侧「直播导演台」；绿幕区域保持原位置。')
);

			const set = (k, v) => setSettings((s) => { const n = { ...s, [k]: v }; saveSettings(n); return n })
			const dragHandlers = {
				onPointerDown: (ev) => { if (open) return; setDrag({ sx: ev.clientX, sy: ev.clientY, ox: settings.pos.x < 0 ? window.innerWidth - 84 : settings.pos.x, oy: settings.pos.y < 0 ? window.innerHeight - 110 : settings.pos.y }); ev.currentTarget.setPointerCapture(ev.pointerId) },
				onPointerMove: (ev) => { if (!drag) return; const nx = Math.max(0, Math.min(window.innerWidth - 60, drag.ox + ev.clientX - drag.sx)); const ny = Math.max(0, Math.min(window.innerHeight - 60, drag.oy + ev.clientY - drag.sy)); set('pos', { x: nx, y: ny }) },
				onPointerUp: (ev) => { if (drag) { const moved = Math.hypot(ev.clientX - drag.sx, ev.clientY - drag.sy); if (moved > 5) refs.current.suppressClick = true } setDrag(null) },
			}
			const pos = settings.pos.x < 0 ? { right: 24, bottom: 24 } : { left: settings.pos.x, top: settings.pos.y }
			const avatarMode = playback.phase === 'playing' ? 'speaking' : playback.phase === 'error' ? 'error' : (waitingReply || busy || playback.phase === 'loading' || liveStatus?.running && ['thinking','starting'].includes(liveStatus.phase)) ? 'thinking' : calling && !micMuted ? 'listening' : 'idle'
            const panelPos = settings.pos.x < 0 ? { right: 24, bottom: 88 } : { left: Math.max(0, Math.min(settings.pos.x, window.innerWidth - 440)), top: Math.max(0, Math.min(settings.pos.y, window.innerHeight - 580)) }
			return e(Fragment, null,
				e('button', { className: 'va-fab' + (calling ? ' on' : ''), style: pos, ...dragHandlers, title: '语音通话助手', onClick: () => { if (refs.current.suppressClick) { refs.current.suppressClick = false; return } setOpen(!open) } }, calling ? '🔴' : '🎙'),
				open && tab !== 'live' ? e(StageCuePanel, {anchorRef:mainPanelRef, anchorKey:settings.pos.x+':'+settings.pos.y+':'+tab, playback:cuePlayback, speed:speechSpeed(settings), onPlay:(...args) => { if (refs.current.liveActive) { setLiveError('请先停止 AI 直播'); setTab('live'); return; } setTab('call'); startStageCue(...args); }, onStop:stopPlayback}) : null,
                open && tab === 'live' ? renderLiveOperatorPanel() : null,
                open ? e('div', { className: 'va-panel', style: panelPos, ref:mainPanelRef },
					e('div', { className: 'va-head' },
						e('span', { className: 'va-title' }, '📞 小云 Live · ' + (sessionId ? sessionTitle(list, sessionId) : '专属会话')),
						e('button', { className: 'va-tab' + (tab === 'call' ? ' on' : ''), onClick: () => setTab('call') }, '通话'),
						e('button', { className: 'va-tab' + (tab === 'tasks' ? ' on' : ''), onClick: () => setTab('tasks') }, '任务'),
e('button', { className: 'va-tab' + (tab === 'live' ? ' on' : ''), onClick: () => setTab('live') }, '直播'),
						e('button', { className: 'va-tab' + (tab === 'activity' ? ' on' : ''), onClick: () => setTab('activity') }, '动态'),
						e('button', { className: 'va-tab' + (tab === 'settings' ? ' on' : ''), onClick: () => setTab('settings') }, '设置'),
						e('button', { className: 'va-x', onClick: () => { stopPlayback(); pauseBgm(); if (calling) toggleCall(); setOpen(false) } }, '✕'),
					),
					e('div', { className: 'va-body' },
						tab === 'live' ? renderLiveAvatar() : tab === 'call' ? e(Fragment, null,
                            e(VoiceAvatar, { mode:avatarMode, analyser:playback.analyser, onPreview:previewVoice, onStop:stopPlayback, previewBusy }),
							renderInputDevice(),
                            e('div', { className: 'va-status' },
								e('span', { className: 'va-dot' + (calling && !micMuted ? ' live' : '') }),
								e('span', null, status),
                                calling ? e('span', {className:'va-badge ' + (micMuted ? 'failed' : 'completed'), role:'status'}, micMuted ? '麦克风已关闭' : '麦克风开启 · 可插话') : null,
								settings.wakeMode && calling ? e('span', { className: 'va-badge ' + (wake === 'awake' ? 'completed' : 'pending') }, wake === 'awake' ? '🔔 已唤醒' : '😴 休眠中') : null,
								e('span', null, dedicated?.ready ? ('专属工作区: ' + (dedicated.workspaceTitle || '语音通话') + ' · 会话: ' + (sessionId || '无')) : '⏳ 正在创建专属工作区/会话…'),
							),
							e('div', { className: 'va-row' },
								e('button', { className: 'va-btn' + (calling ? ' danger' : ''), disabled: busy || inputDeviceBusy, onClick: toggleCall }, calling ? '⏹ 结束通话' : '▶ 开始通话'),
                                e('button', {className:'va-btn ' + (micMuted ? 'danger' : 'ghost'), disabled:!calling || micToggleBusy || inputDeviceBusy, onClick:toggleMicMuted, 'aria-pressed':micMuted, title:'只关闭麦克风，AI 回复和播报继续'}, micMuted ? '开麦' : '闭麦'),
								e('button', { className: 'va-btn ghost', disabled: busy || !transcript, onClick: () => { if (transcript) { unlockAudio(); sendText(transcript) } } }, '📨 发送转写'),
								e('button', { className: 'va-btn ghost', disabled: !dedicated?.ready || !sessionId, onClick: () => { try { const svc = ctxRef.get('sessions'); if (svc) svc.open(sessionId) } catch {} } }, '📂 打开会话'),
							),
							e('div', { className: 'va-transcript' }, (transcript || partial || (micMuted ? '已闭麦，AI 会继续回复。点「开麦」后可继续插话。' : '（说点什么…）')) + (partial && partial !== transcript ? ' ▍' : '')),
							e('div', { className: 'va-sendwrap' },
								e('input', { className: 'va-input', placeholder: '文字输入（通话时也可输入）…', value: text, onChange: (ev) => setText(ev.target.value), onKeyDown: (ev) => { if (ev.key === 'Enter') { unlockAudio(); sendText(text); setText('') } } }),
								e('button', { className: 'va-btn', onClick: () => { unlockAudio(); sendText(text); setText('') } }, '发送'),
							),
							msgs.length ? e('div', null, msgs.map((m, i) => e('div', { key: i, className: 'va-msg ' + (m.role === 'user' ? 'user' : '') },
								e('span', { className: 'va-tag' }, m.role === 'user' ? '我' : m.role === 'assistant' ? '助手' : '提示'), m.text)))
							: e('div', { className: 'va-hint' }, '点击「开始通话」后直接说话，停顿 1.2 秒即自动识别发送并语音回复。所有访客共用一个语音房间，彼此可以看到对话记录，请轮流说话。语音内容保存在服务器的「语音通话」会话中，本体重启后保持同一会话；耗时任务自动分发给其他会话执行。' + (settings.wakeMode ? '\n🔔 已开启唤醒词模式：只有说出唤醒词「' + (settings.wakeWord || '小鲸鱼') + '」才开始对话（唤醒词后可直接跟指令），沉默超过设定时间自动休眠。建议使用本地部署的 ASR 进行语音识别。' : '')),
						) : tab === 'tasks' ? e(Fragment, null,
							e('div', { className: 'va-set' },
								e('label', null, '任务标题'),
								e('input', { className: 'va-input', value: taskTitle, onChange: (ev) => setTaskTitle(ev.target.value), placeholder: '例如：整理周报' }),
								e('label', null, '任务指令（在「语音通话」工作区任务会话中执行）'),
								e('textarea', { className: 'va-input', style: { minHeight: 64, resize: 'vertical' }, value: taskPrompt, onChange: (ev) => setTaskPrompt(ev.target.value), placeholder: '详细描述任务…' }),
								e('button', { className: 'va-btn', disabled: busy || !taskPrompt.trim(), onClick: () => { createTask(taskTitle, taskPrompt); setTaskTitle(''); setTaskPrompt('') } }, '📤 分发任务'),
							),
							tasks.length ? tasks.map((t) => e('div', { key: t.taskId, className: 'va-task' },
								e('div', { className: 'va-t' },
									e('strong', null, t.title + (t.rollovers ? '（续接 ' + t.rollovers + '）' : '')),
									e('span', { className: 'va-badge ' + t.status }, t.status === 'running' ? '执行中' : t.status === 'completed' ? '已完成' : (t.status === 'failed' || t.status === 'error') ? '失败' : '等待'),
								),
								e('div', { className: 'va-hint' }, (t.failReason ? '失败原因: ' + t.failReason + '\n' : '') + (t.result || t.progress || '（暂无进度）').slice(0, 300)),
								e('div', { className: 'va-row' },
									e('button', { className: 'va-btn ghost', onClick: () => { try { const svc = ctxRef.get('sessions'); if (svc) svc.open(t.sessionId || '') } catch {} } }, '📂 打开任务会话'),
									e('span', { className: 'va-hint' }, '创建于 ' + new Date(t.createdAt).toLocaleString()),
								),
							)) : e('div', { className: 'va-hint' }, '暂无任务。分发任务后，任务在「语音通话」工作区下的任务会话中执行（上下文将满时自动新开会话续接），主会话可随时查看进度与结果。'),
						) : tab === 'activity' ? e(Fragment, null,
							e('div', { className: 'va-hint' }, '其他会话任务完成记录（完成时可选语音播报，设置页可关闭）：'),
							otherDones.length ? otherDones.map((d, i) => e('div', { key: i, className: 'va-task' },
								e('div', { className: 'va-t' },
									e('strong', null, '「' + sessionTitle(list, d.sessionId) + '」'),
									e('span', { className: 'va-hint' }, new Date(d.time).toLocaleTimeString()),
								),
								e('div', { className: 'va-hint' }, (d.text || '').slice(0, 200)),
							)) : e('div', { className: 'va-hint' }, '暂无记录。其他会话完成任务时会显示在这里，并在设置开启时语音播报。'),
						) : e(Fragment, null,
							renderInputDevice(),
                            renderBgmControls(),
                            e('div', { className: 'va-hint' }, '声音：腾讯云 · 超自然大模型 · 爱小悠 · '+speechSpeed(settings)+' 倍速 · 按句合成，排队播放。麦克风开启时可随时插话。'),
							e('label', null, e('input', { type: 'checkbox', checked: settings.ttsEnabled, onChange: (ev) => set('ttsEnabled', ev.target.checked) }), ' 开启语音回复'),
                            e('div', { className: 'va-set' },
                                e('label', { htmlFor: 'va-speech-speed' }, '语音速度 · ' + Number(speechSpeed(settings).toFixed(2)) + ' 倍'),
                                e('input', { id: 'va-speech-speed', type: 'range', min: '0.7', max: '1.3', step: '0.05', value: speechSpeed(settings), onChange: (ev) => set('ttsSpeed', Number(ev.target.value)), style: { width: '100%' }, 'aria-label': '语音速度' }),
                                e('div', { className: 'va-hint' }, '实时回复、AI 直播和固定口播共用；调整后下一段生效。'),
                            ),
							e('div', { className: 'va-set' },
								e('label', null, '人格（留空用默认人格）'),
								e('textarea', { className: 'va-input', style: { minHeight: 64, resize: 'vertical' }, value: settings.persona, onChange: (ev) => set('persona', ev.target.value), placeholder: '例如：你是一位温柔耐心的语音助手…' }),
							),
							e('div', { className: 'va-set' },
								e('label', null, '唤醒词通话模式'),
								e('label', { style: { display: 'flex', alignItems: 'center', gap: 6 } }, e('input', { type: 'checkbox', checked: settings.wakeMode, onChange: (ev) => set('wakeMode', ev.target.checked) }), '启用：只有说出唤醒词才开始对话，沉默超时自动休眠'),
								settings.wakeMode ? e(Fragment, null,
									e('div', { className: 'va-row' },
										e('input', { className: 'va-input', value: settings.wakeWord, onChange: (ev) => set('wakeWord', ev.target.value), placeholder: '唤醒词，默认：小鲸鱼' }),
									),
									e('div', { className: 'va-row' },
										e('input', { className: 'va-input', type: 'number', min: '1', max: '120', step: '1', value: Math.round(Number(settings.sleepAfterMs) / 1000), onChange: (ev) => set('sleepAfterMs', (Number(ev.target.value) || 8) * 1000) }),
										e('span', { className: 'va-hint' }, '沉默多少秒后休眠（默认 8 秒）'),
									),
									e('div', { className: 'va-hint' }, '说出唤醒词即唤醒并回应「我在」；唤醒词后跟指令（如「小鲸鱼帮我打开QQ」）会去掉唤醒词后直接执行。'),
									e('div', { className: 'va-hint' }, '💡 建议使用本地部署的 ASR 进行语音识别（如本机 FunASR Server：http://127.0.0.1:10095）：语音不出本机、识别延迟低，唤醒更可靠；云端 ASR 会把每段语音上传识别，唤醒响应也受网络影响。'),
								) : null,
							),
							e('div', { className: 'va-set' },
								e('label', null, '其他'),
								e('label', { style: { display: 'flex', alignItems: 'center', gap: 6 } }, e('input', { type: 'checkbox', checked: settings.autoSend, onChange: (ev) => set('autoSend', ev.target.checked) }), '识别到文本自动发送'),
								e('label', { style: { display: 'flex', alignItems: 'center', gap: 6 } }, e('input', { type: 'checkbox', checked: settings.vadEnabled !== false, onChange: (ev) => set('vadEnabled', ev.target.checked) }), '实时监听（说话停顿后自动识别发送）'),
								e('label', { style: { display: 'flex', alignItems: 'center', gap: 6 } }, e('input', { type: 'checkbox', checked: settings.announceOtherDone !== false, onChange: (ev) => set('announceOtherDone', ev.target.checked) }), '播报其他会话任务完成（简要）'),
								settings.vadEnabled !== false ? e('div', { className: 'va-row' },
									e('input', { className: 'va-input', type: 'number', min: '300', max: '5000', step: '100', value: settings.vadSilenceMs, onChange: (ev) => set('vadSilenceMs', Number(ev.target.value) || 1200) }),
									e('span', { className: 'va-hint' }, '停顿判定毫秒（默认 1200）'),
								) : null,
								settings.vadEnabled !== false ? e('div', { className: 'va-row' },
									e('input', { className: 'va-input', type: 'number', min: '0.005', max: '0.2', step: '0.005', value: settings.vadRms, onChange: (ev) => set('vadRms', Number(ev.target.value) || 0.05) }),
									e('span', { className: 'va-hint' }, '声音触发门槛（越大越抗噪，默认 0.05）'),
                                    e('input', { className:'va-input', type:'number', min:'128', max:'1500', step:'64', value:settings.vadMinSpeechMs, onChange:ev => set('vadMinSpeechMs', Math.max(128, Number(ev.target.value) || 320)) }),
                                    e('span', {className:'va-hint'}, '持续发声毫秒（默认 320，过滤短促杂音）'),
								) : null,
								e('div', { className: 'va-hint' }, '音量、唤醒词等偏好保存在当前浏览器；语音服务密钥由服务器管理。'),
								e('div', { className: 'va-hint' }, '语音内容固定保存在专属工作区「' + (dedicated?.workspaceTitle || '语音通话') + '」的专属会话中，本体重启后依然延续同一会话；耗时任务会自动分发给其他会话执行。'),
							),
						),
					),
				) : null,
			)
		}
		function apply(ctx) {
			ctxRef = ctx
			const styleDisposer = (() => {
				const tag = document.createElement('style')
				tag.dataset.dyn = '@biliye/dsh-voice-call'
				tag.textContent = STYLE + AVATAR_STYLE + STAGE_CUE_STYLE
				document.head.append(tag)
				return () => tag.remove()
			})()
			const slots = ctx.get('slots')
			let slotDisposer = () => {}
			if (slots !== undefined) {
				slotDisposer = slots.inject('shell.overlay', () => slots.register(
					{ name: 'shell.overlay', id: 'voice-call-assistant' },
					(props) => React.createElement(Fab, props),
				))
			}
			ctx.effect(() => () => {
				styleDisposer()
				slotDisposer()
			}, 'voice-call: ui mounts')
		}
		exports.apply = apply
		exports.inject = inject
		return module.exports
	}
})
