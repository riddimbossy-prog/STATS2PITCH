import {state,api,localToday} from './core.js?v=2.2.3'
import {shell,renderBoard,showRefresh,renderLive,stopLive,setTabActive,setDateActive} from './boardView.js?v=2.2.13'
import {openFilters,openProfile} from './dialogs.js?v=2.2.2'
export async function loadBoard(){state.board=await api(`/api/board?date=${encodeURIComponent(state.date)}`);showRefresh(state.board?.meta?.refresh);renderBoard()}
export async function manualRefresh(){const host=document.getElementById('refresh-status');if(host)host.innerHTML='<div class="refreshing">Loading the latest saved Stats2Pitch board…</div>';try{await loadBoard()}catch{showRefresh({state:'failed'})}}
export function switchTab(tab){state.tab=tab;setTabActive();if(tab==='live')renderLive();else{stopLive();renderBoard()}}
export async function selectDate(date){if(!date||date===state.date)return;state.date=date;history.replaceState(null,'',`?date=${encodeURIComponent(date)}`);setDateActive();await loadBoard()}
export async function startDashboard(){document.body.classList.remove('auth-page');document.body.classList.add('board-page');state.date=new URLSearchParams(location.search).get('date')||localToday();shell({openFilters:()=>openFilters({loadBoard,renderBoard}),openProfile,manualRefresh,switchTab,selectDate});await loadBoard()}
