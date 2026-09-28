import fs from 'node:fs';
import path from 'node:path';
const roots=['src','scripts','supabase/functions'];
const exts=new Set(['.js','.jsx','.ts','.tsx']);
const rpc=/\.rpc\(\s*['\"]([^'\"]+)['\"]/g;
const internalOnly=new Set([
'apn_withdrawal_notify','apn_withdrawal_refresh_wallet','apn_withdrawal_source_totals',
'apn_consolidated_wallet_refresh','apn_referral_audit','apn_referral_notify','apn_referral_refresh_wallet',
'apn_rule_audit','apn_withdrawal_add_timeline','apn_withdrawal_audit_event','crm_log_event','knowledge_log_change'
]);
const hits=new Map();
function walk(dir){if(!fs.existsSync(dir))return;for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,ent.name);if(ent.isDirectory())walk(p);else if(exts.has(path.extname(p))){const s=fs.readFileSync(p,'utf8');for(const m of s.matchAll(rpc)){if(!hits.has(m[1]))hits.set(m[1],new Set());hits.get(m[1]).add(p);}}}}
for(const r of roots)walk(r);
const violations=[...internalOnly].filter(n=>hits.has(n));
const report={generatedAt:new Date().toISOString(),rpcCount:hits.size,internalOnlyCount:internalOnly.size,violations,frontendRpcNames:[...hits.keys()].sort()};
fs.mkdirSync('.ai',{recursive:true});
fs.writeFileSync('.ai/RPC_SURFACE_AUDIT.json',JSON.stringify(report,null,2)+'\n');
console.log(`RPC surface: ${hits.size} referenced; protected internal helpers: ${internalOnly.size}; violations: ${violations.length}`);
if(violations.length){console.error(`Internal-only RPC referenced by client/runtime: ${violations.join(', ')}`);process.exit(1);}
