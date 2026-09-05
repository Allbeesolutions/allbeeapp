import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "src");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const sql = fs.readFileSync(path.resolve(process.cwd(), "supabase/migrations/20260905050000_admin_page_runtime_fixes.sql"), "utf8");

describe("admin page runtime regression coverage", () => {
  it("wires every formerly missing lazy-module runtime dependency", () => {
    const app = read("AllbeeApp.jsx");
    expect(app).toContain("Tasks: LazyTasks");
    expect(app).toContain("HELP_STATUS_LABEL, HELP_STATUS_TONE");
    expect(app).not.toContain("runtime={{ useState, useEffect, useRef, supabase, uid, Avatar, Empty, emitToast, fmtDateTime, isOnline, withinMinutes, uploadAttachment, AlertTriangle, ArrowLeft, Attach,");
    expect(app).toContain("function Concepts({ db, mutate, openModal, removeItem })");
    expect(app).toContain("function AuditLog({ db, isSuper, onOpenActivity })");
    expect(app).toContain("function Settings({ db, mutate, replaceDB");
    expect(app).toContain("apnPartnerProfileForm");
    expect(app).not.toMatch(/runtime=\{\{[^}]*\bVaultCategories\b/);
  });

  it("keeps extracted document modules self-contained", () => {
    for (const name of ["Documents.jsx", "Knowledge.jsx", "Sheets.jsx"]) {
      expect(read(name)).toMatch(/^import React, \{ useState(?:, useMemo, useEffect)? \} from "react";/);
    }
  });

  it("removes stale undefined runtime destructuring", () => {
    expect(read("Chat.jsx")).not.toContain(", Attach,");
    expect(read("Quotations.jsx")).not.toContain("VaultCategories");
    expect(read("Vault.jsx")).not.toContain("VaultCategories");
  });

  it("fixes Finance uuid/text reconciliation and CRM CTE scope", () => {
    expect(sql).not.toContain("union all");
    expect(sql.match(/with calc as \(/g)?.length).toBeGreaterThanOrEqual(2);
    expect(sql).toContain("with scoped as (");
    expect(sql).toContain("create or replace function public.finance_v5_dashboard()");
    expect(sql).toContain("create or replace function public.crm_v5_dashboard()");
  });
});
