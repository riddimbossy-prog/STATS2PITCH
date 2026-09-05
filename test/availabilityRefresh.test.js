import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {publicBoard,compactResultRows} from '../server/publicBoard.js'

const read=p=>readFile(new URL(`../${p}`,import.meta.url),'utf8')

test('refresh fills the public availability window, not only the Accra week',async()=>{
  const [script,workflow]=await Promise.all([read('scripts/refreshBoards.js'),read('.github/workflows/refresh-board.yml')])
  assert.match(script,/availabilityWindow/)
  assert.match(script,/refreshDates/)
  assert.match(script,/Goals Bankers/)
  assert.doesNotMatch(script,/accraWeek\(\)\.dates/)
  assert.match(workflow,/SPORTYBET_TIMELINE:\s*"192"/)
  assert.match(workflow,/BOARD_DAY_PAUSE_MS:\s*"800"/)
  assert.match(workflow,/timeout-minutes:\s*60/)
  assert.match(workflow,/cron: "7 4 \* \* \*"/)
})

test('public board drops internals and keeps only the requested view',()=>{
  const board={
    meta:{date:'2026-08-27',generatedAt:'2026-08-27T10:00:00Z',engineVersion:'stats2pitch-v5-var-tips',diagnostics:{secret:true},bankerRules:{x:1},varTipsEngine:'away-fav-streak-v1',goalsBankersEngine:'goals-bankers-v3'},
    bestPicks:[{fixtureId:1,market:'match-winner'}],
    varTips:[{fixtureId:2,market:'both-teams-score'}],
    filterTips:[{fixtureId:3,market:'total-goals'}],
    goalsBankers:[{fixtureId:4,market:'both-teams-score'}],
    priority:[{fixtureId:9,market:'hidden'}],
    bankers:[{fixtureId:8,odds:1.32}],
    fixtures:[{fixtureId:1}]
  }
  const all=publicBoard(board,'all')
  assert.equal(all.bestPicks.length,1)
  assert.equal(all.varTips.length,0)
  assert.equal(all.priority.length,0)
  assert.equal(all.bankers.length,1)
  assert.equal(all.meta.diagnostics,undefined)
  const varBoard=publicBoard(board,'var')
  assert.equal(varBoard.varTips.length,1)
  assert.equal(varBoard.bestPicks.length,0)
  const goals=publicBoard(board,'goals')
  assert.equal(goals.goalsBankers.length,1)
  assert.equal(goals.filterTips.length,0)
})

test('result rows compact to fixture, market and outcome',()=>{
  const rows=compactResultRows([{fixtureId:11,home:'A',away:'B',market:'combo-home-gg',selection:'Home Team or GG',why:{x:1},result:{outcome:'won'}}])
  assert.deepEqual(rows,[{fixtureId:11,market:'combo-home-gg',selection:'Home Team or GG',result:{outcome:'won'}}])
})

test('settle job includes Goals Bankers',async()=>{
  const [src,engine]=await Promise.all([read('scripts/settleResults.js'),read('server/settlement.js')])
  assert.match(src,/boardPicks/)
  assert.match(engine,/postponed/)
  assert.match(engine,/goalsBankers/)
  assert.match(engine,/safestBankers/)
  assert.match(engine,/valueBankers/)
  assert.match(engine,/h2hPicks/)
})

test('public boards show won lost void and postponed',async()=>{
  const files=await Promise.all(['public/appCrests.js','public/varTips.js','public/filterTips.js','public/goalsBankers.js'].map(read))
  for(const src of files){
    assert.match(src,/POSTPONED/)
    assert.match(src,/pick-result/)
    assert.match(src,/outcomeLabel/)
  }
})

test('public clients request a slim board view and reuse a cached board',async()=>{
  const files=await Promise.all(['public/appCrests.js','public/varTips.js','public/filterTips.js','public/goalsBankers.js','public/net.js','public/sw.js'].map(read))
  for(const src of files.slice(0,4)){
    assert.match(src,/from '\.\/net\.js'/)
    assert.match(src,/view=/)
    assert.match(src,/readBoardCache/)
    assert.match(src,/warmNeighbors/)
  }
  assert.match(files[4],/sessionStorage/)
  assert.match(files[5],/registration\.unregister/)
  assert.doesNotMatch(files[5],/addEventListener\('fetch'/)
})

test('public board slims pick internals, unused results and fixture extras',()=>{
  const board={
    meta:{date:'2026-08-27',generatedAt:'2026-08-27T10:00:00Z'},
    bestPicks:[{
      fixtureId:1,
      market:'match-winner',
      over25Filter:{huge:true},
      transitionSafety:{x:1},
      why:{
        lastMatchesHome:[{result:'W',home:'A',away:'B',hs:1,as:0,date:'2026-01-01',league:'X',extra:1}],
        last5Home:[{result:'W',secret:'x'}],
        h2h:[]
      }
    }],
    results:{
      1:{outcome:'won',matchState:'settled',homeScore:1,awayScore:0,secret:true},
      99:{outcome:'lost'}
    },
    fixtures:[{fixtureId:1,homeLogo:'http://x',awayLogo:'http://y',availability:'qualified',league:'L'}]
  }
  const all=publicBoard(board,'all')
  assert.equal(all.bestPicks[0].over25Filter,undefined)
  assert.equal(all.bestPicks[0].transitionSafety,undefined)
  assert.equal(all.bestPicks[0].why.lastMatchesHome.length,1)
  assert.equal(all.bestPicks[0].why.lastMatchesHome[0].extra,undefined)
  assert.equal(all.results['99'],undefined)
  assert.equal(all.results['1'].outcome,'won')
  assert.equal(all.results['1'].secret,undefined)
  assert.equal(all.fixtures[0].availability,undefined)
  assert.equal(all.fixtures[0].homeLogo,'http://x')
})
