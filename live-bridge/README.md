# 本机浏览器桥

桥接器运行在有 Google Chrome 的 Mac 上。它读取场控已扫码登录的视频号直播后台可见数据，不自行登录，不上传 Cookie、请求头或完整网络响应。演示页开在同一个专用 Chrome 的另一个标签中，供 OBS 捕获。

```bash
cd live-bridge
npm ci --ignore-scripts
swiftc -O -o ocr-tool ocr.swift
cp config.example.json config.json
# 编辑 config.json 后启动，文件权限设为 0600。
node bridge.mjs
```

在已授权的控制台中获取本部署的弹幕接收密钥，将 `endpoint` 和 `ingestToken` 填入本地 `config.json`。密钥不是微信密码，不能放进仓库。控制台的“连接视频号”打开专用 Chrome 后，由本人扫码并进入当前直播间。桥接器不会操作平台的开始或结束直播按钮。

`chrome-profile/` 保存本机登录状态，`metrics-outbox.json` 保存尚未确认的指标时间切片；两者均已加入忽略列表。纯文字演示页读取 DOM，图片页面可由 macOS Vision 进行 OCR。支持 Reveal.js、remark、页面的翻页函数和左右方向键。网页协议变化后可能需要更新解析器；平台未提供的指标保持为空。

开始小云 AI 播报前，先在控制台核对“收到消息响应”和真实测试评论。没有直播或没有评论时，连接正常也可能没有弹幕。
