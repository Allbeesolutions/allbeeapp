export const TABLES = ["transactions", "withdrawals", "tasks", "projects", "students", "marketing", "concepts", "audit", "attendance", "leave", "updates", "recycle",
  "leads", "clients", "quotations", "planned", "announcements", "documents", "knowledge", "chat", "rewards", "vault", "portal_posts", "notifications", "invoices", "resignations", "prompts", "sheets", "inhouse", "payroll", "teams", "team_chat", "testing", "class_students",
  // APN — ALLBEE Partner Network (logically separate from employee operations)
  "apn_users", "apn_attendance", "apn_targets", "apn_training", "apn_quizzes", "apn_leads", "apn_quotations", "apn_commissions", "apn_commission_projects", "apn_revenue_collections", "apn_achievements", "apn_notifications", "apn_documents", "apn_timeline", "apn_warnings", "apn_notes", "apn_activity", "apn_transfer_history", "apn_communications",
  // WP4 — admin hub consoles/notes + partner zone requests
  "apn_admin_notes", "apn_admin_consoles", "apn_zone_requests"];

// PR2 referral data is relational and intentionally does not participate in
// the legacy JSON-row diff writer. Referral mutations go through audited RPCs.
export const REFERRAL_READS = {
  apn_referral_codes: "partner_id,code,rename_count,created_at,renamed_at,active",
  apn_referral_relationships: "id,referrer_id,referred_id,referral_code,linked_at,created_at,status,linked_by,disabled_at",
  apn_referral_earnings: "id,relationship_id,referrer_id,referred_id,source_collection_id,project_id,revenue_amount,referral_percent,referral_amount,status,collection_at,created_at,approved_at,paid_at,snapshot",
  apn_referral_wallets: "partner_id,pending,approved,withdrawable,paid,lifetime,monthly,updated_at",
  apn_referral_withdrawals: "id,partner_id,amount,status,requested_at,reviewed_at,reviewed_by,paid_at,note",
  apn_referral_timeline: "id,partner_id,event_type,title,description,related_id,created_at,created_by",
  apn_referral_activities: "id,partner_id,actor_id,event_type,title,description,metadata,created_at",
  apn_referral_monthly_summary: "partner_id,month_start,referral_count,active_count,revenue,earnings,updated_at",
  apn_referral_analytics_monthly: "partner_id,month_start,conversion_rate,referral_count,active_count,revenue,earnings,updated_at",
  apn_referral_settings: "id,enabled,default_percent,updated_at,updated_by",
  apn_referral_snapshots: "id,earning_id,referral_percent,settings_enabled,captured_at,snapshot",
  apn_consolidated_wallets: "partner_id,earned,pending,eligible,total_balance,reserved,withdrawable,withdrawn,reversed,recovery_outstanding,recovery_recovered,recovery_remaining,commission_breakdown,updated_at",
};

// APN admin action badges use a per-user watermark. The source records remain
// unchanged; opening a tab only marks the current admin's action stream seen.
export const APN_ACTION_BADGE_MAP = Object.freeze([
  Object.freeze({ actionType: "partner_pending", tab: "partners", label: "Partners" }),
  Object.freeze({ actionType: "commission_pending", tab: "commissions", label: "Commissions" }),
  Object.freeze({ actionType: "withdrawal_pending", tab: "withdrawals", label: "Withdrawals" }),
  Object.freeze({ actionType: "referral_pending", tab: "referrals", label: "Referrals" }),
  Object.freeze({ actionType: "target_action", tab: "targets", label: "Targets" }),
  Object.freeze({ actionType: "training_action", tab: "content", label: "Training" }),
  Object.freeze({ actionType: "material_action", tab: "docs", label: "Materials" }),
  Object.freeze({ actionType: "notification_unread", tab: "notify", label: "Notify" }),
]);
export const APN_ACTION_BADGE_READS = "user_id,action_type,seen_at";

// PR3 withdrawal and settlement data is normalized and changed only through
// transactional RPCs. It deliberately stays outside the legacy JSON diff writer.
export const WITHDRAWAL_READS = {
  apn_withdrawal_bank_accounts: "id,partner_id,account_holder,bank_name,account_number,ifsc,upi_id,branch,verification_status,active,created_at,updated_at",
  apn_withdrawal_wallets: "partner_id,wallet_type,pending,approved,withdrawable,locked,paid,lifetime,monthly,today,total_requested,total_approved,total_rejected,total_processing,last_paid_at,next_settlement_date,updated_at",
  apn_withdrawal_requests: "id,partner_id,wallet_type,requested_amount,approved_amount,preferred_method,bank_account_id,bank_snapshot,status,reason,notes,review_reason,requested_at,reviewed_at,reviewed_by,processing_at,paid_at,cancelled_at,expires_at,batch_id,settlement_reference,updated_at",
  apn_withdrawal_status_history: "id,request_id,from_status,to_status,amount,reason,notes,actor_id,actor_name,actor_role,created_at",
  apn_withdrawal_settlements: "id,request_id,batch_id,partner_id,wallet_type,amount,payment_method,payment_reference,paid_at,paid_by,receipt_snapshot",
  apn_withdrawal_batches: "id,batch_code,frequency,status,scheduled_for,created_by,created_at,processed_at,notes",
  apn_wallet_transactions: "id,partner_id,wallet_type,request_id,entry_type,amount,balance_effect,description,metadata,created_at,created_by",
  apn_withdrawal_finance_transactions: "id,request_id,settlement_id,partner_id,wallet_type,transaction_type,amount,reference,created_at,created_by,metadata",
  apn_withdrawal_audit: "id,request_id,partner_id,action,actor_id,metadata,created_at",
  apn_withdrawal_exports: "id,exported_by,format,filters,row_count,created_at",
};

// PR4 normalized CRM reads. Writes go through transactional CRM RPCs so the
// lead, follow-up, quotation, project, revenue, finance, audit, and notification
// records remain consistent with the existing ERP and APN engines.
export const CRM_READS = {
  crm_clients: "id,client_key,customer_name,company,mobile,email,location,address,city,district,state,country,pincode,business_type,notes,created_by,created_at,updated_at",
  crm_leads: "id,lead_number,source,lead_owner_id,assigned_employee_id,assigned_partner_id,assigned_district_head_id,assigned_state_head_id,company,customer_name,mobile,email,location,address,city,district,state,country,pincode,business_type,project_category,expected_budget,expected_closing_date,priority,lead_score,status,remarks,tags,created_by,created_at,updated_at,converted_at,client_id,quotation_id,project_id",
  crm_lead_assignments: "id,lead_id,employee_id,partner_id,district_head_id,state_head_id,assigned_by,created_at",
  crm_follow_ups: "id,lead_id,follow_up_date,follow_up_time,reminder_at,priority,notes,outcome,next_follow_up,completed_by,completed_at,status,created_by,created_at,updated_at",
  crm_quotations: "id,quote_number,lead_id,client_id,service_type,title,items,subtotal,discount,tax,gst,grand_total,validity_until,status,version,approval_status,approved_by,approved_at,created_by,created_at,updated_at",
  crm_quotation_versions: "id,quotation_id,version,snapshot,created_by,created_at",
  crm_projects: "id,project_number,lead_id,quotation_id,client_id,name,service_type,project_value,status,assigned_employee_id,assigned_partner_id,apn_project_id,created_by,created_at,updated_at",
  crm_revenue_collections: "id,project_id,received_amount,received_at,commission_generated,incentive,status,remarks,created_by,created_at",
  crm_project_milestones: "id,project_id,proposal_id,name,sort_order,due_date,percentage,status,created_at",
  crm_activities: "id,lead_id,project_id,event_type,title,description,actor_id,actor_name,metadata,created_at",
  crm_files: "id,lead_id,project_id,quotation_id,file_name,file_url,file_type,file_size,uploaded_by,created_at",
  crm_reminders: "id,lead_id,reminder_day,due_at,priority,status,created_at",
  crm_audit: "id,lead_id,project_id,quotation_id,action,actor_id,actor_name,metadata,created_at",
};

// PR5 deterministic intelligence records. Dashboard calculations are returned
// by the admin-only ai_get_dashboard RPC; these tables provide realtime alerts,
// recommendations, history, cached snapshots, and generated report metadata.
export const AI_READS = {
  ai_settings: "id,enabled,sensitivity,forecast_period,prediction_model,updated_by,updated_at",
  ai_insights: "id,category,severity,title,message,recommendation,entity_type,entity_id,score,metadata,status,generated_by,created_at,updated_at,last_seen_at",
  ai_predictions: "id,prediction_type,entity_id,value,confidence,explanation,factors,generated_at",
  ai_cache: "key,payload,generated_at,expires_at",
  ai_history: "id,period,summary,metrics,created_by,created_at",
  ai_recommendations: "id,category,title,description,impact,priority,entity_type,entity_id,action_route,metadata,status,created_at,updated_at",
  ai_reports: "id,report_type,format,title,payload,generated_by,created_at",
  business_automation_queue: "id,rule_id,entity,entity_id,status,payload,requested_at,requested_by,reviewed_at,reviewed_by,executed_at,failure_reason",
};

// WP4 — client = level / product / prescription / loyalty. Normalized reads;
// writes go through the audited prescription & loyalty RPCs only.
export const CLIENT_READS = {
  apn_target_client_levels: "partner_id,record_id,level_key,label,goal,progress,status,notes,created_by,created_at,updated_at",
  apn_target_client_products: "partner_id,record_id,product_key,label,category,price,quantity,status,created_by,created_at,updated_at",
  apn_target_client_prescriptions: "partner_id,prescription_id,client_key,patient_name,doctor_name,condition_name,phase,balance,submit_count,last_submitted,status,created_by,created_at,updated_at",
  apn_target_client_prescription_items: "partner_id,item_id,prescription_id,item_key,label,quantity,unit,amount,condition_item,embed_order,created_at,updated_at",
  apn_target_client_loyalty: "partner_id,loyalty_id,client_key,points,tier,status,created_by,created_at,updated_at",
  apn_target_client_loyalty_rewards: "partner_id,reward_id,loyalty_id,reward_key,label,points_cost,redeemed,redeemed_at,created_at,updated_at",
};

// Helpdesk — client portal support tickets. Normalized reads; writes go through
// the audited, identity-checked RPCs in supabase/helpdesk.sql only.
export const HELPDESK_READS = {
  support_tickets: "id,ticket_no,client_id,client_name,client_email,client_company,subject,description,category,priority,status,assignee_id,created_at,updated_at,closed_at",
  support_ticket_messages: "id,ticket_id,author_id,author_name,author_role,author_public,body,created_at",
  support_ticket_audit: "id,ticket_id,author_id,author_name,action,metadata,created_at",
};

// PR-APN agreements — versioned legal documents + per-partner acceptance
// evidence. Normalized reads; writes go exclusively through the audited
// apn_agreement_save_draft / publish / accept RPCs (see
// supabase/pr-apn-partner-agreements.sql). The finalized schema also exposes
// the Simple-English rendering (body_simple), the material/editorial
// classification (material, change_summary, supersedes_id) and the
// centralized legal-entity row (apn_agreement_company).
export const AGREEMENT_READS = {
  apn_agreements: "id,code,version,title,category,body,body_simple,content_hash,status,mandatory,reason,effective_from,published_at,published_by,created_by,created_at,updated_at,material,supersedes_id,change_summary",
  apn_agreement_acceptances: "id,partner_id,agreement_id,version,content_hash,accepted_at,accepted_by,method,terms_view,ip,user_agent",
  apn_hierarchy_assignments: "partner_id,district_head_id,state_head_id,status,assigned_by,effective_from,assigned_at",
  apn_agreement_company: "id,legal_name,trade_name,address_line1,address_line2,city,state,country,postal_code,email,governance_framework,governing_law,jurisdiction_place,signatories,updated_at",
};


export function createDataReaders({ supabase, emptyDB, loadTableRows }) {
  async function fetchReferralData() {
    const out = {};
    const entries = await mapWithConcurrency(Object.entries(REFERRAL_READS), TABLE_FETCH_CONCURRENCY, async ([table, columns]) => [table, await loadTableRows(supabase, table, columns, undefined, TABLE_FETCH_TIMEOUT_MS, 1, true, 500, tableFetchLimit(table))]);
    for (const [table, rows] of entries) out[table] = rows;
    return out;
  }

  async function fetchApnActionBadgeReads() {
    return loadTableRows(supabase, "apn_action_badge_reads", APN_ACTION_BADGE_READS);
  }

  async function fetchWithdrawalData() {
    const out = {};
    const entries = await mapWithConcurrency(Object.entries(WITHDRAWAL_READS), TABLE_FETCH_CONCURRENCY, async ([table, columns]) => [table, await loadTableRows(supabase, table, columns, undefined, TABLE_FETCH_TIMEOUT_MS, 1, true, 500, tableFetchLimit(table))]);
    for (const [table, rows] of entries) out[table] = rows;
    return out;
  }

  async function fetchCRMData() {
    const out = {};
    const entries = await mapWithConcurrency(Object.entries(CRM_READS), TABLE_FETCH_CONCURRENCY, async ([table, columns]) => [table, await loadTableRows(supabase, table, columns, "created_at", TABLE_FETCH_TIMEOUT_MS, 1, true, 500, tableFetchLimit(table))]);
    for (const [table, rows] of entries) out[table] = rows;
    return out;
  }

  async function fetchAIData() {
    const out = {};
    const entries = await mapWithConcurrency(Object.entries(AI_READS), TABLE_FETCH_CONCURRENCY, async ([table, columns]) => [table, await loadTableRows(supabase, table, columns, table === "ai_settings" ? "updated_at" : "created_at", TABLE_FETCH_TIMEOUT_MS, 1, true, 500, tableFetchLimit(table))]);
    for (const [table, rows] of entries) out[table] = rows;
    return out;
  }

  // WP7 — the partner portal's authoritative financial facts. Reads ONE
  // read-only, auth-scoped snapshot RPC that serves the exact engine values the
  // ALLBEE AI uses (consolidated wallet, ledger, rule ladder, reversals,
  // withdrawal wallets). Returns null when the RPC is absent or fails so the
  // portal degrades to the legacy projection instead of white-screening.
  async function fetchPartnerFinancialSnapshot() {
    const { data, error } = await supabase.rpc("apn_partner_financial_snapshot");
    if (error) return null;
    return data || null;
  }

  async function fetchClientData() {
    const out = {};
    const entries = await mapWithConcurrency(Object.entries(CLIENT_READS), TABLE_FETCH_CONCURRENCY, async ([table, columns]) => [table, await loadTableRows(supabase, table, columns, undefined, TABLE_FETCH_TIMEOUT_MS, 1, true, 500, tableFetchLimit(table))]);
    for (const [table, rows] of entries) out[table] = rows;
    return out;
  }

  async function fetchHelpdeskData() {
    const out = {};
    const entries = await mapWithConcurrency(Object.entries(HELPDESK_READS), TABLE_FETCH_CONCURRENCY, async ([table, columns]) => [table, await loadTableRows(supabase, table, columns, undefined, TABLE_FETCH_TIMEOUT_MS, 1, true, 500, tableFetchLimit(table))]);
    for (const [table, rows] of entries) out[table] = rows;
    return out;
  }

  async function fetchAgreementData() {
    const out = {};
    const entries = await mapWithConcurrency(Object.entries(AGREEMENT_READS), TABLE_FETCH_CONCURRENCY, async ([table, columns]) => [table, await loadTableRows(supabase, table, columns, undefined, TABLE_FETCH_TIMEOUT_MS, 1, true, 500, tableFetchLimit(table))]);
    for (const [table, rows] of entries) out[table] = rows;
    return out;
  }

  // ── resilient table loader ───────────────────────────────────────────────
  // Every screen used to load all tables through a single Promise.all that
  // RE-THREW on the first non-"table does not exist" error AND had NO timeout.
  // Under connection-pool pressure (60+ tables queried at once) a single slow,
  // erroring, or hanging table would leave Promise.all unsettled or throw — so
  // fetchAll never returned, `db` stayed null, and the loading screen was shown
  // forever with no retry. Each table now loads independently with its own
  // timeout + one retry; a failing table degrades to an empty collection instead
  // of bricking the whole workspace. RLS still protects the data (an error simply
  // yields no rows); we only stop a transient failure from locking the app out.
  // Startup is deliberately split into a small critical payload and a background
  // hydration pass. The old boot path waited for 70+ database reads before showing
  // the workspace; on mobile/slow networks that made the premium loader sit there
  // for 30+ seconds even though the shell itself was ready.
  const TABLE_FETCH_TIMEOUT_MS = 8000;
  const TABLE_FETCH_CONCURRENCY = 10;
  // Historical/event-heavy collections are deliberately bounded per screen.
  // Users can request older history from the module itself instead of paying the
  // network cost at sign-in or on every realtime refresh.
  const TABLE_FETCH_LIMITS = Object.freeze({
    // High-volume/event streams: newest bounded window; dedicated screens can page deeper history.
    audit: 500, chat: 250, team_chat: 250, notifications: 300, updates: 500,
    attendance: 1000, leave: 500, tasks: 1000, transactions: 2000,
    projects: 1000, clients: 1000, leads: 1000, quotations: 1000, invoices: 1000,
    documents: 500, knowledge: 500, vault: 500, rewards: 500,
    apn_activity: 300, apn_timeline: 300, apn_communications: 250,
    apn_warnings: 250, apn_notes: 250, apn_admin_notes: 250,
    apn_withdrawal_status_history: 300, apn_withdrawal_audit: 300, apn_wallet_transactions: 500,
    crm_activities: 500, crm_audit: 500, crm_files: 300, support_ticket_messages: 500, support_ticket_audit: 300,
    ai_history: 200, ai_insights: 300, ai_recommendations: 300, business_automation_queue: 300,
  });
  const tableFetchLimit = (table) => TABLE_FETCH_LIMITS[table] || Infinity;
  const BOOTSTRAP_TABLES = Object.freeze([
    "transactions", "tasks", "attendance", "leave", "updates", "announcements",
    "notifications", "chat", "projects", "clients", "invoices", "payroll"
  ]);
  const BOOTSTRAP_TIMEOUT_MS = 4500;

  // Screen-scoped data policy. The workspace is intentionally NOT hydrated with
  // every collection at sign-in. Common dashboard data is loaded first; deeper
  // datasets are fetched only when the user opens the corresponding module.
  const ROUTE_DATASETS = Object.freeze({
    dashboard: ["transactions","tasks","attendance","leave","updates","announcements","notifications","projects","clients","invoices","payroll","teams"],
    tasks: ["tasks","projects","team_chat"],
    attendance: ["attendance"],
    leave: ["leave"],
    updates: ["updates","teams"],
    announcements: ["announcements"],
    notifications: ["notifications"],
    chat: ["chat","team_chat"],
    teamchat: ["team_chat"],
    clients: ["clients","crm_clients","crm_activities","crm_files"],
    leads: ["leads","crm_leads","crm_lead_assignments","crm_follow_ups","crm_activities","crm_audit"],
    quotations: ["quotations","crm_quotations","crm_quotation_versions","crm_activities"],
    projects: ["projects","crm_projects","crm_project_milestones","crm_activities","crm_files","crm_revenue_collections"],
    invoices: ["invoices","transactions"],
    finance: ["transactions","invoices","payroll","crm_revenue_collections", ...Object.keys(WITHDRAWAL_READS), ...Object.keys(CRM_READS)],
    payroll: ["payroll","teams"],
    documents: ["documents","vault","apn_documents","crm_files"],
    knowledge: ["knowledge","documents"],
    vault: ["vault","documents"],
    rewards: ["rewards"],
    testing: ["testing"],
    marketing: ["marketing"],
    inhouse: ["inhouse"],
    sheets: ["sheets"],
    courses: ["students","class_students"],
    performance: ["attendance","tasks","updates","rewards","teams"],
    crm: [...Object.keys(CRM_READS),"clients","leads","quotations","projects"],
    enterprisecrm: [...Object.keys(CRM_READS),"clients","leads","quotations","projects"],
    apn: ["apn_users","apn_attendance","apn_targets","apn_training","apn_quizzes","apn_leads","apn_quotations","apn_commissions","apn_commission_projects","apn_revenue_collections","apn_achievements","apn_notifications","apn_documents","apn_timeline","apn_warnings","apn_notes","apn_activity","apn_transfer_history","apn_communications","apn_admin_notes","apn_admin_consoles","apn_zone_requests", ...Object.keys(REFERRAL_READS), ...Object.keys(WITHDRAWAL_READS), ...Object.keys(CRM_READS), ...Object.keys(AI_READS), ...Object.keys(CLIENT_READS), ...Object.keys(HELPDESK_READS), ...Object.keys(AGREEMENT_READS), "apn_action_badge_reads"],
    apnwallet: ["apn_users", ...Object.keys(WITHDRAWAL_READS), ...Object.keys(REFERRAL_READS)],
    apnadmin: ["apn_users","apn_targets","apn_training","apn_quizzes","apn_commissions","apn_commission_projects","apn_revenue_collections","apn_notifications","apn_documents","apn_timeline","apn_warnings","apn_notes","apn_activity","apn_admin_notes","apn_admin_consoles","apn_zone_requests", ...Object.keys(REFERRAL_READS), ...Object.keys(WITHDRAWAL_READS), ...Object.keys(AGREEMENT_READS), "apn_action_badge_reads"],
    support: ["support_tickets","support_ticket_messages","support_ticket_audit"],
    portal: ["portal_posts","support_tickets","support_ticket_messages","support_ticket_audit"],
    ai: [...Object.keys(AI_READS),"clients","leads","quotations","projects"],
    automation: ["business_automation_queue", ...Object.keys(AI_READS)],
  });
  const routeDataTables = (route) => {
    const base = ROUTE_DATASETS[route] || ROUTE_DATASETS.dashboard;
    // The initial shell bootstrap is loaded separately. Route refreshes must stay truly scoped\n    // so a navigation event does not silently re-fetch the global bootstrap payload.\n    return [...new Set(["notifications", ...base])];
  };

  async function mapWithConcurrency(items, limit, fn) {
    const out = new Array(items.length);
    let i = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx], idx);
      }
    });
    await Promise.all(workers);
    return out;
  }

  async function fetchBootstrapData() {
    const db = emptyDB();
    const loaded = await mapWithConcurrency(BOOTSTRAP_TABLES, BOOTSTRAP_TABLES.length, async (t) => [
      t, await loadTableRows(supabase, t, "id,data", "created_at", BOOTSTRAP_TIMEOUT_MS, 0, true, 500, 500)
    ]);
    for (const [t, rows] of loaded) {
      db[t] = (rows || [])
        .map((r) => r.data)
        .filter((x) => x && typeof x === "object")
        .sort((a, b) => (a?.createdAt || a?.ts || 0) - (b?.createdAt || b?.ts || 0));
    }
    return db;
  }

  async function fetchAll({ excludeTables = [], includeTables = null } = {}) {
    const db = emptyDB();
    const excluded = new Set(excludeTables);
    const included = includeTables == null ? null : new Set(includeTables);
    const shouldLoad = (table) => !excluded.has(table) && (!included || included.has(table));
    // `audit` is intentionally excluded from the shared scheduler. Supabase/PostgREST
    // caps an un-ranged select at the API row limit, so audit has its own paginated
    // newest-first loader below. Every other normalized read shares ONE concurrency
    // pool; previously each feature group created its own pool and sequential group
    // waits made hydration slower while still allowing bursts of 10 requests/group.
    const jobs = [];
    for (const t of TABLES) if (t !== "audit" && shouldLoad(t)) jobs.push([t, "id,data", undefined, false]);
    for (const [table, columns] of Object.entries(REFERRAL_READS)) if (shouldLoad(table)) jobs.push([table, columns, undefined, true]);
    for (const [table, columns] of Object.entries(WITHDRAWAL_READS)) if (shouldLoad(table)) jobs.push([table, columns, undefined, true]);
    for (const [table, columns] of Object.entries(CRM_READS)) if (shouldLoad(table)) jobs.push([table, columns, "created_at", true]);
    for (const [table, columns] of Object.entries(AI_READS)) if (shouldLoad(table)) jobs.push([table, columns, table === "ai_settings" ? "updated_at" : "created_at", true]);
    for (const [table, columns] of Object.entries(CLIENT_READS)) if (shouldLoad(table)) jobs.push([table, columns, undefined, true]);
    for (const [table, columns] of Object.entries(HELPDESK_READS)) if (shouldLoad(table)) jobs.push([table, columns, undefined, true]);
    for (const [table, columns] of Object.entries(AGREEMENT_READS)) if (shouldLoad(table)) jobs.push([table, columns, undefined, true]);
    if (shouldLoad("apn_action_badge_reads")) jobs.push(["apn_action_badge_reads", APN_ACTION_BADGE_READS, undefined, true]);

    const loaded = await mapWithConcurrency(jobs, TABLE_FETCH_CONCURRENCY, async ([table, columns, orderColumn]) => [
      table, await loadTableRows(supabase, table, columns, orderColumn, TABLE_FETCH_TIMEOUT_MS, 1, true, 500, tableFetchLimit(table))
    ]);
    for (const [table, rows] of loaded) {
      if (TABLES.includes(table)) {
        db[table] = (rows || [])
          .map((r) => r.data)
          .filter((x) => x && typeof x === "object")
          .sort((a, b) => (a?.createdAt || a?.ts || 0) - (b?.createdAt || b?.ts || 0));
      } else {
        db[table] = rows || [];
      }
    }
    // Audit has its own paginated loader and realtime channel. Do not reload it
    // during ordinary scoped table refreshes; audit events are handled separately.
    if (includeTables == null || included.has("audit")) db.audit = await fetchAuditRows();
    return db;
  }

  // Build a backup from a fresh normalized read as well as the legacy in-memory
  // collections. This keeps exports complete even when a user exports before a
  // background hydration/realtime refresh has populated every normalized key.
  async function buildBackupSnapshot(db) {
    const snapshot = { ...(db || {}) };
    Object.assign(snapshot,
      await fetchReferralData(), await fetchWithdrawalData(), await fetchCRMData(),
      await fetchAIData(), await fetchClientData(), await fetchHelpdeskData(),
      await fetchAgreementData(),
      { apn_action_badge_reads: await fetchApnActionBadgeReads() }
    );
    return snapshot;
  }

  async function fetchAuditRows(limit = TABLE_FETCH_LIMITS.audit) {
    const { data, error } = await supabase
      .from("audit")
      .select("id,data,updated_at")
      .order("updated_at", { ascending: false })
      .range(0, Math.max(0, limit - 1));
    if (error) throw new Error(`Loading audit: ${error.message}`);
    return (data || [])
      .map((r) => ({ ...(r.data || {}), id: r.id }))
      .filter((x) => x && typeof x === "object")
      .sort((a, b) => (a?.ts || 0) - (b?.ts || 0));
  }

  return { fetchReferralData, fetchApnActionBadgeReads, fetchWithdrawalData, fetchCRMData, fetchAIData, fetchPartnerFinancialSnapshot, fetchClientData, fetchHelpdeskData, fetchAgreementData, fetchBootstrapData, fetchAll, buildBackupSnapshot, fetchAuditRows, routeDataTables };
}
