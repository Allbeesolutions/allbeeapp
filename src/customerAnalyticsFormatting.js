/** 30 UTC reporting days, with explicit empty calendar days. */
export function fillCustomerDays(rows,now=new Date(),length=30){
 if(!Number.isInteger(length)||length<1||length>90||!Number.isFinite(now.valueOf()))throw Error('Invalid range');
 const end=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate());
 const real=new Map(rows.map(x=>[x.day,x]));
 return Array.from({length},(_,i)=>{
  const day=new Date(end-(length-1-i)*86400000).toISOString().slice(0,10);
  const row=real.get(day);
  return {day,visits:Number(row?.visits||0),views:Number(row?.views||0),users:Number(row?.users||0)};
 });
}
