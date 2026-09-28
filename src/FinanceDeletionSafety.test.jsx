import { describe, expect, it } from "vitest";
import fs from "node:fs";

const app = fs.readFileSync("src/AllbeeApp.jsx", "utf8");

describe("finance deletion safety contract", () => {
  it("does not treat a missing transaction in a partial client snapshot as delete authority", () => {
    expect(app).toContain('if (t === "transactions" && deletes.length)');
    expect(app).toContain('entry?.table === "transactions"');
    expect(app).toContain("recycledTransactionIds.has(deletes[i])");
  });
});

const restoreMigration = fs.readFileSync("supabase/migrations/20260929123000_prevent_partial_backup_mass_delete.sql", "utf8");

describe("backup restore deletion safety contract", () => {
  it("replaces legacy collections only when they are explicitly present", () => {
    expect(restoreMigration).toContain("if p_backup ? v_table then");
    expect(restoreMigration).toContain("execute format('delete from public.%I', v_table)");
  });
});
