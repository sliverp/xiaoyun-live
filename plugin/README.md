# 小云 Live 语音与直播插件

这是 biliye/dsh-voice-call 0.2.1 的扩展版本，保留上游 MIT 声明。完整部署入口见[项目 README](../README.md)；请使用本仓库的插件与部署配置，不要用上游安装命令替换当前版本。

服务端导出 `.`，浏览器导出 `./client`，由 DSH web profile 装载。所有语音和直播接口保留 DSH 登录及来源检查。插件需要 DSH 的 Agent、工作区、工具、持久化、计时器、子进程和 Web 服务。

腾讯云 TTS 凭据通过 `tencentTtsCredentialsFile` 指定的服务端文件读取；默认音色 602003 爱小悠。支持 `tencentTtsRegion`、`tencentTtsSampleRate`、`tencentTtsTimeoutSeconds`，实时语速在控制台设置。后台识别固定使用回环 SenseVoice 服务。

当前语音通话所有运营者共用一个房间。麦克风关闭不打断 AI 播报，AI 回复和播报期间持续识别以支持插话。固定口播直接播放匹配录音；自由回复实时合成。演示资产中的活动稿属于样例，需要改成自己业务的文本和匹配录音。

- [状态与转换](LIVE-STATE.md)
- [持续直播与多端控制](LIVE-CONTINUITY.md)
- [直播数据](LIVE-DATA.md)
- [弹幕选人与活动](LIVE-LOTTERY.md)

模型主备参数由 web profile 配置：`liveGenerationFreshSession`、`liveGenerationPrimaryTimeoutMs`、`liveGenerationTimeoutMs`、`liveGenerationCooldownMs`、`liveGenerationFallbacks`。每轮直播模型只负责结构化口播与导航建议，调度器负责确认整轮播完、切换与执行。

音频切片最多 150 个 Unicode 字符、450 UTF-8 字节，尽量沿句末切分；整轮结束后才插入弹幕和活动。浏览器驱动实际播放，嘴部根据播放音量变化。

测试在仓库根目录执行 `npm test`，不请求付费 API。
