import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const gate=await readFile(new URL('../public/gate.js',import.meta.url),'utf8')
const auth=await readFile(new URL('../supabase/functions/stats2pitch-auth/index.ts',import.meta.url),'utf8')
const sw=await readFile(new URL('../public/sw.js',import.meta.url),'utf8')
const net=await readFile(new URL('../public/net.js',import.meta.url),'utf8')
const pwa=await readFile(new URL('../public/pwa.js',import.meta.url),'utf8')

test('sign-in of a new member switches to sign up with email and password kept',()=>{
  assert.match(gate,/err\.code=data\?\.code/)
  assert.match(gate,/ex\.code==='new_user'/)
  assert.match(gate,/showAuth\('signup'/)
  assert.match(gate,/No account for this email yet/)
  assert.match(gate,/invalid login credentials/)
  assert.match(gate,/\{email,password\}/)
  assert.match(gate,/draft\.email\)emailEl\.value=draft\.email/)
  assert.match(gate,/draft\.password\)passEl\.value=draft\.password/)
  assert.match(gate,/signup\?'Sign up':'Sign in'/)
  assert.match(gate,/readDraft\(host\)/)
})

test('existing email on sign up returns to sign in with the same details',()=>{
  assert.match(gate,/ex\.code==='exists'/)
  assert.match(gate,/showAuth\('login'/)
  assert.match(gate,/already has an account/)
})

test('auth service marks unknown emails as new_user instead of a dead login error',()=>{
  assert.match(auth,/code:'new_user'/)
  assert.match(auth,/async function userExists/)
  assert.match(auth,/code:'exists'/)
  assert.match(auth,/Wrong email or password/)
})

test('successful sign-in opens the boards even if /me cannot be confirmed',()=>{
  assert.match(gate,/function finishAuth\(fallbackEmail/)
  assert.match(gate,/function openBoards/)
  assert.match(gate,/if\(!getToken\(\)\)/)
  assert.match(gate,/hideAuth\(\)/)
  assert.match(gate,/keepSession:true/)
  assert.match(gate,/emailFromToken/)
  assert.match(gate,/friendlyAuthError/)
  assert.match(gate,/directGrant/)
  assert.match(gate,/grant_type=password/)
  assert.doesNotMatch(gate,/await finishAuth/)
  assert.match(net,/keepSession/)
  assert.match(net,/credentials:'omit'/)
})

test('service worker self-destructs so iPhone sign-in is not cached stale',()=>{
  assert.match(sw,/stats2pitch-shell-v5\.15\.0/)
  assert.match(sw,/registration\.unregister/)
  assert.match(sw,/clients\.map\(c=>c\.navigate/)
  assert.doesNotMatch(sw,/addEventListener\('fetch'/)
  assert.doesNotMatch(sw,/functions\/v1/)
  assert.match(pwa,/s2p-sw-kill-/)
  assert.match(pwa,/unregister\(\)/)
  assert.doesNotMatch(pwa,/serviceWorker\.register/)
  assert.match(pwa,/v=5\.15\.0/)
})
