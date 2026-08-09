import assert from 'node:assert/strict'
import { statusGroup, fixtureLifecycle, buildLifecycleMap, KICKOFF_STATUS_GRACE_MS } from './lifecycle.js'

const now=Date.parse('2026-08-09T23:07:00Z')

assert.equal(statusGroup('NS','2026-08-09T17:00:00Z',now),'pending','A kickoff six hours in the past cannot remain Upcoming.')
assert.equal(statusGroup('TBD','2026-08-09T22:40:00Z',now),'pending','A TBD fixture beyond the grace window cannot remain Upcoming.')
assert.equal(statusGroup('NS','2026-08-09T23:00:00Z',now),'upcoming','A fixture seven minutes past scheduled kickoff remains in the short provider grace window.')
assert.equal(statusGroup('NS','2026-08-09T23:30:00Z',now),'upcoming','A future fixture remains Upcoming.')
assert.equal(statusGroup('1H','2026-08-09T17:00:00Z',now),'live','Provider live status remains authoritative.')
assert.equal(statusGroup('FT','2026-08-09T17:00:00Z',now),'settled','Provider settled status remains authoritative.')
assert.equal(statusGroup('PST','2026-08-09T17:00:00Z',now),'postponed','Provider postponed status remains authoritative.')
assert.equal(statusGroup('UNKNOWN','2026-08-09T17:00:00Z',now),'pending','Unknown provider states fail closed instead of being called Upcoming.')
assert.equal(KICKOFF_STATUS_GRACE_MS,15*60*1000)

const fixture={
  fixture:{id:77,date:'2026-08-09T17:00:00Z',status:{short:'NS',long:'Not Started',elapsed:null}},
  goals:{home:null,away:null}
}
const life=fixtureLifecycle(fixture,{now})
assert.equal(life.statusGroup,'pending')
assert.equal(life.statusDerived,'kickoff-passed-provider-pending')
assert.equal(life.homeScore,null)
assert.equal(life.awayScore,null)

const map=buildLifecycleMap([fixture],{now})
assert.equal(map['77'].statusGroup,'pending')

console.log('lifecycle.test.js: all kickoff/status integrity tests passed')
