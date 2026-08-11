import {state,api,localToday} from './core.js'
import {shell,renderBoard,showRefresh,renderLive,stopLive,setTabActive} from './boardView.js'
import {openFilters,openProfile} from './dialogs.js'
export async function loadBoard(){state.board=await api(`/api/board?date=${encodeURIComponent(state.date)}`);showRefresh(state.board?.meta?.refresh);renderBoard();if(state.board?.meta?.refresh?.state==='running'||state.board?.meta?.requiresRefresh||Number(state.board?.meta?.sourceFixtures||0)===0)pollRefresh()}
export function pollRefresh(){clearInterval(state.refreshTimer);state.refreshTimer=setInterval(async()=>{try{const j=await api(`/api/refresh-status?date=${encodeURIComponent(state.date)}`);showRefresh(j);if(j.state==='complete'){clearInterval(state.refreshTimer);state.refreshTimer=null;await loadBoard()}else if(j.state==='failed'){clearInterval(state.refreshTimer);state.refreshTimer=null}}catch{}},2500)}
export async function manualRefresh(){try{const x=await api('/api/refresh',{method:'POST',body:JSON.stringify({date:state.date})});showRefresh(x.job);pollRefresh()}catch{showRefresh({state:'failed'})}}
export function switchTab(tab){state.tab=tab;setTabActive();if(tab==='live')renderLive();else{stopLive();renderBoard()}}
export async function startDashboard(){state.date=new URLSearchParams(location.search).get('date')||localToday();shell({openFilters:()=>openFilters({loadBoard,renderBoard}),openProfile,manualRefresh,switchTab});await loadBoard()}
