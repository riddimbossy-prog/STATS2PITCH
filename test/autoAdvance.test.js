import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {hasRemainingTips,firstOpenDate,addDays,isSrlPick} from '../public/net.js'

const read=p=>readFile(new URL(`../${p}`,import.meta.url),'utf8')
const future=new Date(Date.now()+6*3600000).toISOString()
const past=new Date(Date.now()-6*3600000).toISOString()

test('remaining tips are kickoffs still in the future',()=>{
  assert.equal(hasRemainingTips([]),false)
  assert.equal(hasRemainingTips([{kickoff:past}]),false)
  assert.equal(hasRemainingTips([{kickoff:future}]),true)
  assert.equal(hasRemainingTips([{kickoff:past},{kickoff:future}]),true)
})

test('empty days hop forward and never leave a past date',()=>{
  const today='2026-08-27'
  const boards={
    '2026-08-26':[{kickoff:future}],
    '2026-08-27':[{kickoff:past}],
    '2026-08-28':[{kickoff:past}],
    '2026-08-29':[{kickoff:future}]
  }
  assert.equal(firstOpenDate('2026-08-26',boards,today),null)
  assert.equal(firstOpenDate('2026-08-27',boards,today),'2026-08-29')
  assert.equal(firstOpenDate('2026-08-29',boards,today),null)
  assert.equal(addDays(today,1),'2026-08-28')
})

test('All Picks, Filter, VAR and Goals auto-advance empty days',async()=>{
  const files=await Promise.all(['public/appCrests.js','public/filterTips.js','public/varTips.js','public/goalsBankers.js','public/net.js'].map(read))
  for(const src of files.slice(0,4)){
    assert.match(src,/hopIfEmpty/)
    assert.match(src,/nextDateWithTips/)
    assert.match(src,/hasRemainingTips/)
    assert.match(src,/isSrlPick/)
  }
  assert.match(files[0],/view==='results'/)
  assert.match(files[4],/firstOpenDate/)
  assert.match(files[4],/nextDateWithTips/)
})

test('SRL simulated picks are dropped on public boards',()=>{
  assert.equal(isSrlPick({league:'K-League 1 SRL',home:'Seoul',away:'Bucheon'}),true)
  assert.equal(isSrlPick({home:'Daejeon Citizen FC (Srl)',away:'Ulsan Hyundai SRL'}),true)
  assert.equal(isSrlPick({league:'Premier League',home:'Arsenal',away:'Chelsea'}),false)
})
