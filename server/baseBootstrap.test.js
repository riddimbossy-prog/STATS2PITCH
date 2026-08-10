import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')
const assert=(condition,message)=>{if(!condition)throw new Error(`base bootstrap regression: ${message}`)}

const app=read('public/app.v1.5.0.js')

assert(!app.includes("root.innerHTML='<div class=\"splash\""),'showDashboard must never replace the signed-in shell with a splash')
assert(app.includes('loadBoard({silent:true})'),'board loading must continue asynchronously after the shell is rendered')
assert(app.includes('showDashboard({validated:true})'),'initial bootstrap must not validate the same session twice')

console.log('base bootstrap regression checks passed')
