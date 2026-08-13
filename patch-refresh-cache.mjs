import fs from 'node:fs'

const path='server/refresh.js'
let s=fs.readFileSync(path,'utf8')
const old=`  reconcilePublishedBoard(board,previous,raw)`
const replacement=`  const compatiblePrevious=previous?.meta?.engineVersion===ENGINE_VERSION?previous:null
  reconcilePublishedBoard(board,compatiblePrevious,raw)`
if(!s.includes(replacement)){
  if(!s.includes(old))throw new Error('Could not find reconcilePublishedBoard call in server/refresh.js')
  s=s.replace(old,replacement)
  fs.writeFileSync(path,s)
  console.log('Patched server/refresh.js stale-engine cache gate')
}else console.log('server/refresh.js already patched')
