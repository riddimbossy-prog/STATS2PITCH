const ZONE='Africa/Accra'
export const AVAILABILITY_PAST=6
export const AVAILABILITY_FUTURE=6

const dateInZone=(date=new Date(),tz=ZONE)=>new Intl.DateTimeFormat('en-CA',{
  timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'
}).format(date)

const weekdayInZone=(date=new Date(),tz=ZONE)=>{
  const label=new Intl.DateTimeFormat('en-US',{timeZone:tz,weekday:'short'}).format(date)
  return {Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[label]
}

export function addIsoDays(iso,n){
  const date=new Date(`${iso}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate()+n)
  return date.toISOString().slice(0,10)
}

export function accraWeek(anchor=new Date()){
  const today=dateInZone(anchor)
  const dow=weekdayInZone(anchor)
  const monday=addIsoDays(today,dow===0?-6:1-dow)
  const dates=Array.from({length:7},(_,index)=>addIsoDays(monday,index))
  return {timezone:ZONE,today,monday,sunday:dates[6],dates}
}

export function availabilityWindow(anchor=new Date()){
  const today=dateInZone(anchor)
  const dates=Array.from({length:AVAILABILITY_PAST+AVAILABILITY_FUTURE+1},(_,i)=>addIsoDays(today,i-AVAILABILITY_PAST))
  const upcoming=dates.filter(d=>d>=today)
  const past=dates.filter(d=>d<today).reverse()
  return {
    timezone:ZONE,
    today,
    from:dates[0],
    to:dates[dates.length-1],
    dates,
    upcoming,
    past,
    refreshDates:[...upcoming,...past]
  }
}
