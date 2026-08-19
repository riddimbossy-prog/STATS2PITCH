import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const workflow=readFileSync(new URL('../.github/workflows/refresh-board.yml',import.meta.url),'utf8')
const config=readFileSync(new URL('../server/config.js',import.meta.url),'utf8')

test('production refresh uses exact last five venue matches',()=>{
  assert.match(workflow,/ENGINE_FORM_SAMPLE:\s*["']5["']/)
  assert.match(config,/ENGINE_FORM_SAMPLE\|\|5/)
})
