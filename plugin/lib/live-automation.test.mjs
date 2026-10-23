import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createLotterySchedule,validateLotterySchedule} from './live-automation.js'
function fixture(t){const dir=mkdtempSync(join(tmpdir(),'live-schedule-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));return {dir,schedule:createLotterySchedule(dir)}}
const evaluate=(schedule,options={})=>schedule.evaluate({active:false,remaining:2,...options})
test('schedule settings reject invalid clocks, empty enabled rules, negative thresholds, and unsupported metrics',()=>{
  for(const value of [{enabled:true},{fixedTimes:['25:00']},{fixedTimes:['19:61']},{intervalMinutes:-1},{threshold:-1},{metric:'invented'}])assert.throws(()=>validateLotterySchedule(value))
  assert.deepEqual(validateLotterySchedule({fixedTimes:['19:30','19:30']}).fixedTimes,['19:30'])
})
test('hourly triggers remain claimed across repeats, a service restart, and 48 hours',t=>{
  let now=Date.parse('2026-10-21T10:00:00+08:00');t.mock.method(Date,'now',()=>now)
  const {dir,schedule}=fixture(t);schedule.configure({enabled:true,intervalMinutes:60});schedule.start()
  assert.equal(evaluate(schedule),null)
  for(let hour=1;hour<=48;hour++){
    now+=3600000
    assert.match(evaluate(schedule),/60分钟/)
    assert.equal(evaluate(schedule),null)
  }
  const restored=createLotterySchedule(dir);restored.start()
  assert.equal(evaluate(restored),null);assert.equal(restored.status().claimedCount,48)
  now+=3600000;assert.match(evaluate(restored),/60分钟/)
})
test('daily clocks use Beijing time; a manual restart does not replay an already claimed slot',t=>{
  let now=Date.parse('2026-10-21T19:29:00+08:00');t.mock.method(Date,'now',()=>now)
  const {schedule}=fixture(t);schedule.configure({enabled:true,fixedTimes:['19:30']});schedule.start()
  now+=60000;assert.match(evaluate(schedule),/19:30/)
  schedule.start();assert.equal(evaluate(schedule),null)
  now+=24*3600000;assert.match(evaluate(schedule),/19:30/)
})
test('only a fresh observed popularity value can trigger; simultaneous rules coalesce and exhausted pools cannot award',t=>{
  let now=100000;t.mock.method(Date,'now',()=>now)
  const {schedule}=fixture(t);schedule.configure({enabled:true,intervalMinutes:1,metric:'heat',threshold:100});schedule.start();now+=60000
  const snapshot={fields:{heat:{value:101,at:now}}}
  assert.equal(evaluate(schedule,{snapshot,active:true}),null)
  assert.match(evaluate(schedule,{snapshot}),/分钟.*热度/)
  assert.equal(evaluate(schedule,{snapshot}),null)
  now+=60000;assert.equal(evaluate(schedule,{remaining:0}),null)
  assert.match(schedule.status().lastReason,/奖品已发完/)
  now+=60000;assert.equal(evaluate(schedule,{snapshot:{fields:{heat:{value:999,at:now-31000}}},remaining:0}),null)
})
test('a missing or stale online count never substitutes the historical peak',t=>{
  let now=100000;t.mock.method(Date,'now',()=>now)
  const {schedule}=fixture(t);schedule.configure({enabled:true,metric:'onlineUsers',threshold:10});schedule.start()
  assert.equal(evaluate(schedule,{snapshot:{fields:{peakOnlineUsers:{value:100,at:now}}}}),null)
  assert.equal(evaluate(schedule,{snapshot:{fields:{onlineUsers:{value:100,at:now-31000}}}}),null)
  assert.match(evaluate(schedule,{snapshot:{fields:{onlineUsers:{value:10,at:now}}}}),/在线人数/)
})

test('a popularity crossing observed during another draw remains pending even after the value drops',t=>{
  let now=100000;t.mock.method(Date,'now',()=>now)
  const {dir,schedule}=fixture(t);schedule.configure({enabled:true,threshold:100});schedule.start()
  assert.equal(evaluate(schedule,{active:true,snapshot:{fields:{heat:{value:101,at:now}}}}),null)
  now+=180000
  const restored=createLotterySchedule(dir)
  assert.match(evaluate(restored,{snapshot:{fields:{heat:{value:10,at:now}}}}),/热度达到100/)
  assert.equal(evaluate(restored),null)
})
