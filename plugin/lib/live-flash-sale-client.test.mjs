import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
const source=readFileSync(new URL('./client.js',import.meta.url),'utf8').split('// BEGIN FLASH SALE SCHEDULE')[1].split('// END FLASH SALE SCHEDULE')[0]
const {flashSaleTimeInput,flashSaleTimeValue,flashSaleScheduleLabel}=runInNewContext(source+'\n({flashSaleTimeInput,flashSaleTimeValue,flashSaleScheduleLabel})')
test('Beijing datetime inputs round trip across midnight without using the browser timezone',()=>{
 const midnight=Date.parse('2026-10-24T00:00:00+08:00')
 assert.equal(flashSaleTimeInput(midnight),'2026-10-24T00:00');assert.equal(flashSaleTimeValue('2026-10-24T00:00'),midnight)
 assert.equal(flashSaleTimeValue(''),null);assert.equal(flashSaleTimeInput(null),'')
 assert.throws(()=>flashSaleTimeValue('2026-02-30T00:00'));assert.throws(()=>flashSaleTimeValue('invalid'))
})
test('the schedule distinguishes a future date from an ended or disabled campaign',()=>{
 const nextAt=Date.parse('2026-10-24T00:00:00+08:00')
 assert.match(flashSaleScheduleLabel({scheduleState:'waiting',nextAt}),/未到开始时间.*2026\/10\/24 00:00/)
 assert.match(flashSaleScheduleLabel({scheduleState:'ended',nextAt:null}),/已结束/)
 assert.match(flashSaleScheduleLabel({scheduleState:'disabled',nextAt:null}),/已关闭/)
 assert.match(flashSaleScheduleLabel({scheduleState:'complete',nextAt:null}),/没有待触发/)
})
