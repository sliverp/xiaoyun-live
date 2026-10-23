import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createGenerationFailover} from './generation-failover.js'
const fallbacks=[{provider:'tokenhub',model:'hy4-preview',label:'混元'},{provider:'tokenhub',model:'deepseek/deepseek-flash',label:'DeepSeek'}]

test('healthy backups are reused until the primary recovery probe is due',t=>{
  let now=10000;t.mock.method(Date,'now',()=>now)
  const pool=createGenerationFailover({fallbacks,cooldownMs:5000})
  const primary=pool.begin();assert.equal(primary.index,0);assert.equal(primary.timeoutMs,10000)
  const backup=pool.next(primary,'primary timeout');assert.equal(backup.index,1);assert.equal(backup.timeoutMs,30000)
  pool.success(backup);assert.equal(pool.begin().index,1)
  now+=5000;assert.equal(pool.begin().index,0)
  pool.success(pool.begin());assert.equal(pool.status().fallbackActive,false)
})

test('all failed routes exhaust the chain and invalid declarations fail before any request',t=>{
  const pool=createGenerationFailover({fallbacks})
  const one=pool.next(pool.begin(),'503'),two=pool.next(one,'429')
  assert.equal(two.index,2);assert.equal(pool.next(two,'network'),null)
  assert.throws(()=>createGenerationFailover({fallbacks:[{provider:'tokenhub',model:''}]}),/配置无效/)
  assert.throws(()=>createGenerationFailover({primaryTimeoutMs:0}),/主模型生成时限/)
})

test('the live policy reaches TokenHub Flash after the primary and first backup fail',()=>{
  const policy=JSON.parse(readFileSync(new URL('../../profile-overrides/lkeap-primary.json',import.meta.url),'utf8'))
  const pool=createGenerationFailover({fallbacks:policy.fallbacks,primaryTimeoutMs:policy.primaryTimeoutMs,timeoutMs:policy.fallbackTimeoutMs,cooldownMs:policy.cooldownMs})
  assert.equal(policy.provider,'lkeap-plan-live')
  const primary=pool.begin();assert.equal(primary.timeoutMs,10000)
  const first=pool.next(primary,'primary timeout')
  assert.equal(first.route.provider,'deepseek-official')
  const second=pool.next(first,'first backup timeout')
  assert.equal(second.route.provider,'tokenhub-live')
  assert.equal(second.route.model,'deepseek/deepseek-flash')
  assert.equal(second.timeoutMs,30000)
  const third=pool.next(second,'second backup error')
  assert.equal(third.route.model,'hy4-preview')
  assert.equal(pool.next(third,'third backup error'),null)
})
