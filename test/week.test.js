import test from 'node:test'
import assert from 'node:assert/strict'
import {accraWeek,addIsoDays} from '../server/week.js'

test('Accra week runs Monday through Sunday',()=>{
  const week=accraWeek(new Date('2026-08-26T15:00:00Z'))
  assert.equal(week.timezone,'Africa/Accra')
  assert.equal(week.monday,'2026-08-24')
  assert.equal(week.sunday,'2026-08-30')
  assert.deepEqual(week.dates,['2026-08-24','2026-08-25','2026-08-26','2026-08-27','2026-08-28','2026-08-29','2026-08-30'])
  assert.equal(addIsoDays(week.monday,6),week.sunday)
})

test('Sunday still belongs to the week that started the previous Monday',()=>{
  const week=accraWeek(new Date('2026-08-30T21:00:00Z'))
  assert.equal(week.monday,'2026-08-24')
  assert.equal(week.sunday,'2026-08-30')
})
