# 本机浏览器桥

桥接器运行在有 Google Chrome 的 Mac 上。它读取场控已扫码登录的视频号直播后台可见数据，不自行登录，不上传 Cookie、请求头或完整网络响应。演示页开在同一个专用 Chrome 的另一个标签中，供 OBS 捕获。

```bash
cd live-bridge
npm ci --ignore-scripts
swiftc -O -o ocr-tool ocr.swift
cd ..
python3 scripts/pair_bridge.py --ssh ubuntu@YOUR_SERVER --identity ~/.ssh/YOUR_KEY --url https://YOUR_HOST
cd live-bridge
node bridge.mjs
```

配对命令通过已有 SSH 权限读取本部署的桥接凭据，自动写入权限为 0600 的本地 `config.json`，不会显示或要求用户复制密钥。默认服务器目录为 `/opt/xiaoyun-live`，其他目录可指定 `--remote-dir`；已配对时不会直接覆盖。控制台的“连接视频号”打开专用 Chrome 后，由本人扫码并进入当前直播间。桥接器不会操作平台的开始或结束直播按钮。

`chrome-profile/` 保存本机登录状态，`metrics-outbox.json` 保存尚未确认的指标时间切片；两者均已加入忽略列表。纯文字演示页读取 DOM，图片页面可由 macOS Vision 进行 OCR。支持 Reveal.js、remark、页面的翻页函数和左右方向键。网页协议变化后可能需要更新解析器；平台未提供的指标保持为空。

开始小云 AI 播报前，先在控制台核对“收到消息响应”和真实测试评论。没有直播或没有评论时，连接正常也可能没有弹幕。
