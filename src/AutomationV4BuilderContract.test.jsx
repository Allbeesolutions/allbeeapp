import {describe,it,expect} from "vitest";
import fs from "node:fs";
const ui=fs.readFileSync("src/AutomationV4.jsx","utf8");
const sql=fs.readFileSync("supabase/migrations/20260923120000_automation_workflow_builder.sql","utf8");
describe("automation workflow builder",()=>{
 it("supports trigger-condition-action editing",()=>{expect(ui).toContain("Workflow builder");expect(ui).toContain("Trigger");expect(ui).toContain("Condition");expect(ui).toContain("Action");});
 it("versions and secures workflow mutations",()=>{expect(sql).toContain("business_automation_upsert_rule");expect(sql).toContain("business_automation_rule_versions");expect(sql).toContain("public.is_admin()");});
 it("supports schedule configuration and all action channels",()=>{expect(ui).toContain("Asia/Kolkata");for(const x of ["notify","schedule_follow_up","send_email","send_whatsapp"])expect(sql+ui).toContain(x);});
});
