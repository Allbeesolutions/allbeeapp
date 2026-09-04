import {describe,it,expect} from "vitest";
import fs from "node:fs";
import path from "node:path";
const root=path.resolve(process.cwd());
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const sql=read("supabase/migrations/20260904151000_ai_intelligence_v5_certification.sql");
const view=read("supabase/migrations/20260904092000_ai_intelligence_v3.sql");
const ui=read("src/AIExecutiveV5.jsx");
describe("AI Intelligence v5 contracts",()=>{
 it("uses the next forward forecast and explicit data quality",()=>{expect(sql).toContain("period_type='forward'");expect(sql).toContain("nextf.forecast_revenue");expect(sql).toContain("data_quality");});
 it("uses real finance and commission evidence",()=>{expect(sql).toContain("transactions");expect(sql).toContain("apn_commission_ledger");expect(sql).toContain("commission_type in ('partner','referral','district','state')");});
 it("excludes terminal lead outcomes from predictions",()=>{expect(sql).toContain("lower(coalesce(status,'')) not in ('won','lost','cancelled','converted','closed')");expect(view).toContain("ai_lead_scores");});
 it("does not manufacture lead probabilities when no active evidence exists",()=>{expect(ui).toContain("No active lead scoring evidence is currently available");});
 it("keeps validation admin-scoped",()=>{expect(sql).toContain("if not public.is_admin() then raise exception 'Admin access required.'");expect(sql).toContain("ai_intelligence_v5_validation");});
 it("keeps public and anonymous execution revoked",()=>{expect(sql).toContain("revoke execute on function public.ai_intelligence_v5_dashboard() from public,anon");expect(sql).toContain("grant execute on function public.ai_intelligence_v5_dashboard() to authenticated");});
});
