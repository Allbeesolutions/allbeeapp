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


const REQUIRED_COUNTS = ['visits24h','visits7d','visitors7d','returningUsers7d','views7d','taps7d','activeMinutes7d'];
// An incomplete RPC response is not an empty dashboard. Reject rather than
// manufacturing zero-valued engagement metrics on schema/auth/network errors.
export function verifiedCustomerUsageReport(report) {
 if(!report || typeof report !== 'object' || Array.isArray(report)) throw Error('Verified usage analytics report unavailable');
 for(const key of REQUIRED_COUNTS) {
  const v=report[key];
  if(typeof v!=='number' || !Number.isSafeInteger(v) || v<0) throw Error('Usage report missing valid '+key);
 }
 for(const key of ['daily','screens','users']) {
  if(!Array.isArray(report[key])) throw Error('Usage report missing '+key);
 }
 const validCount = v => typeof v==='number' && Number.isSafeInteger(v) && v>=0;
 const validDay = day => typeof day==='string' && /^\d{4}-\d{2}-\d{2}$/.test(day);
 if(!report.daily.every(r=>r && validDay(r.day) && ['visits','views','users'].every(k=>validCount(r[k])))) throw Error('Usage report has invalid daily results');
 if(!report.screens.every(r=>r && typeof r.screen==='string' && validCount(r.views))) throw Error('Usage report has invalid screens');
 if(!report.users.every(r=>r && typeof r.actor==='string' && validCount(r.visits) && validCount(r.days_active))) throw Error('Usage report has invalid user summary');
 return report;
}
