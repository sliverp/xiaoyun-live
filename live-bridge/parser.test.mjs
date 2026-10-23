import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { isLiveMessageResponse, extractLiveMessage } from './parser.mjs'

test('only WeChat Channels live message responses are inspected', () => {
  assert.equal(isLiveMessageResponse('https://channels.weixin.qq.com/mmfinderassistant-bin/live/msg'), true)
  assert.equal(isLiveMessageResponse('https://evil.example/mmfinderassistant-bin/live/msg'), false)
})

test('extracts comments and entry events without uploading account secrets or gift payloads', () => {
  const input = { data: { liveInfo: { liveId: 'live-1' }, msgList: [
    { type: 1, clientMsgId: 'm1', nickname: '观众甲', content: '你好', username: 'viewer-1', cookie: 'do-not-send' },
    { type: 10005, clientMsgId: 'm2', nickname: '观众乙', content: '进场' },
    { type: 1, clientMsgId: 'm3', nickname: '', content: '空昵称' },
  ], appMsgList: [{ msgType: 20009, payload: 'private' }] } }
  const out = extractLiveMessage({}, input)
  assert.deepEqual(out, { liveId: 'live-1', liveStatus: '', events: [{ type: 'comment', msgId: 'm1', nickname: '观众甲', content: '你好', viewerId: 'viewer-1' },{type:'enter',msgId:'m2',nickname:'观众乙',content:'',viewerId:''}] })
})
