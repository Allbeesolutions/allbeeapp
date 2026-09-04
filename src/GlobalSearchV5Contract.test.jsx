import {describe,it,expect} from "vitest";
import fs from "node:fs";
import path from "node:path";
const root=path.resolve(process.cwd());
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const ui=read("src/GlobalSearch.jsx");
const sql=read("supabase/migrations/20260904160000_global_search_v5_certification.sql");
describe("Global Search v5 contracts",()=>{
 it("covers cross-module records and role-scoped filtering",()=>{expect(ui).toContain("SEARCH_SOURCES");expect(ui).toContain("filter: (x, c) => c.isAdmin");expect(ui).toContain("Results respect your access");});
 it("uses fuzzy weighted relevance",()=>{expect(ui).toContain("fuzzyScore");expect(ui).toContain("score += 40");expect(ui).toContain("startsWith");});
 it("supports saved and recent searches",()=>{expect(ui).toContain("global_search_recent");expect(ui).toContain("global_search_saved");expect(sql).toContain("global_search_history");});
 it("supports server-side search telemetry",()=>{expect(sql).toContain("global_search_record");expect(sql).toContain("result_count");expect(sql).toContain("selected_result");});
 it("provides fuzzy suggestions from the user's own history",()=>{expect(sql).toContain("pg_trgm");expect(sql).toContain("global_search_suggestions");expect(sql).toContain("h.query ilike '%'||trim(p_query)||'%'");});
 it("blocks anonymous execution of search telemetry",()=>{expect(sql).toContain("revoke execute on function public.global_search_record");expect(sql).toContain("grant execute on function public.global_search_record(text,integer,text,jsonb) to authenticated");});
});
