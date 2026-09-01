import React, { useState, useEffect, useMemo, useCallback } from "react";
const LazyAPNAdminWithdrawals = React.lazy(() => import("./APNAdminWithdrawals.jsx"));

const LazyAPNCommissionEntry = React.lazy(() => import("./APNCommissionEntry.jsx"));

export default function APNAdmin(props) {
  const { db, people = [], mutate, isSuper, isAdmin, currentUser, currentUserId, currentUserAvatar, currentUserDesignation, refreshPeople, focusPartnerId, onFocusConsumed, onOpenRelated, onRefresh, onCommissionDeleted, onActionBadgeSeen } = props;
  const { supabase, todayISO, money, fmtDate, fmtDateTime, uid, emitToast, Confirm, Modal, Field, SelectOther, Empty, Avatar, ...rest } = props.runtime || {};
  const { APNAdminActivityLog, APNAdminHub, APNAdminPartners, APNAdminLeads, APNAdminCommissions, APNAdminWithdrawals, APNAdminReferrals, APNAdminSupport, APNAdminContent, APNAdminDocs, APNAdminAgreements, APNAdminLeaderboard, Search, Plus, Trash2, Pencil, Save, Check, X, ChevronRight, ChevronDown, ArrowRight, Download, FileText, Activity, Filter, Send, Eye, MoreVertical } = rest;
  const [tab, setTab] = useState("partners");
  const [modal, setModal] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [actionError, setActionError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const partners = (db.apn_users || []).filter((u) => !["rejected", "deleted"].includes(u.status));
  const M = (action, partnerId, previousValue = null, newValue = null) => ({ action, module: "APN", ...(partnerId ? { partnerId } : {}), previousValue, newValue, ip: null, device: typeof navigator !== "undefined" ? navigator.userAgent : null });
  const withSender = (notification) => ({ ...notification, senderId: notification.senderId || currentUserId, senderName: notification.senderName || currentUser, senderRole: notification.senderRole || (isSuper ? "Super Admin" : "Admin"), senderDesignation: notification.senderDesignation || currentUserDesignation || (isSuper ? apnApproverFor(currentUser).designation : "Admin"), senderAvatar: notification.senderAvatar || currentUserAvatar });
  const removeRow = (table, id, action) => mutate((d) => ({ ...d, [table]: (d[table] || []).filter((x) => x.id !== id) }), M(action));
  const appendTimeline = (next, entries) => {
    const rows = Array.isArray(entries) ? entries : entries ? [entries] : [];
    if (!rows.length) return next;
    const existing = new Set((next.apn_timeline || []).map((x) => x.id));
    const add = rows.filter((x) => x && !existing.has(x.id));
    return add.length ? { ...next, apn_timeline: [...(next.apn_timeline || []), ...add] } : next;
  };
  const mutateApn = (updater, audit, entries) => mutate((d) => appendTimeline(updater(d), entries), audit);
  const timeline = (p, type, title, description, at = Date.now(), by = currentUser || "Super Admin") => apnTimelineEntry(p.id, `${type}:${at}`, title, description, by, null, at);
  const openProfile = (partner, section = "summary") => {
    const derived = apnDerivedTimeline(db, partner);
    const existing = new Set((db.apn_timeline || []).filter((x) => x.partnerId === partner.id).map((x) => x.id));
    const missing = derived.filter((x) => !existing.has(x.id));
    if (missing.length) mutate((d) => appendTimeline(d, missing), null);
    setModal({ type: "apnPartnerProfile", partner, section });
  };
  useEffect(() => {
    if (!focusPartnerId) return;
    const partner = partners.find((p) => p.id === focusPartnerId) || (db.apn_users || []).find((p) => p.id === focusPartnerId);
    if (partner) { setTab("partners"); openProfile(partner); }
    onFocusConsumed?.();
  }, [focusPartnerId]);
  const withActionError = async (fn) => {
    setActionError("");
    try { await fn(); return true; }
    catch (e) { const message = e?.message || "That APN action could not be completed."; setActionError(message); emitToast(message, "error"); return false; }
  };
  const updateProfileStatus = async (partner, active, status) => {
    const { error } = await supabase.from("profiles").update({ active, status }).eq("id", partner.id);
    if (error) throw new Error(error.message);
    if (refreshPeople) await refreshPeople();
  };
  const saveProfileNow = async (partner, next) => {
    if (!isSuper) return;
    apnPercent(next.commissionPct, "Commission %");
    apnPercent(next.attendanceScore, "Attendance score");
    const changes = [];
    const labels = { name: "Changed Name", username: "Changed Username", email: "Changed Email", mobile: "Changed Mobile Number", district: "Changed District", level: "Changed Level", status: "Changed Status", target: "Changed Target", commissionPct: "Changed Commission", attendanceScore: "Changed Attendance", notes: "Changed Notes" };
    for (const [key, label] of Object.entries(labels)) if (String(partner[key] ?? "") !== String(next[key] ?? "")) changes.push(label);
    if (next.email && next.email.toLowerCase() !== String(partner.email || "").toLowerCase()) {
      const { data, error } = await supabase.functions.invoke("admin-users", { body: { action: "update_email", userId: partner.id, email: next.email.trim().toLowerCase() } });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
    }
    const { error } = await supabase.from("profiles").update({ name: next.name, email: next.email, mobile: next.mobile, username: next.username, dob: next.dob || null, active: next.status !== "suspended", status: next.status === "suspended" ? "suspended" : "active" }).eq("id", partner.id);
    if (error) throw new Error(error.message);
    const persistedNext = { ...partner, ...next, updatedAt: Date.now() };
    const profileEvents = [timeline(partner, "profile-edited", "Profile Edited", changes.length ? changes.join(" · ") : "Partner profile reviewed.")];
    if (String(partner.district || "") !== String(next.district || "")) profileEvents.push(timeline(partner, "district-changed", "District Changed", `${partner.district || "Unassigned"} → ${next.district || "Unassigned"}.`));
    const districtChanged = String(partner.district || "") !== String(next.district || "");
    mutateApn((d) => ({ ...d, apn_users: (d.apn_users || []).map((u) => u.id === partner.id ? persistedNext : u), apn_transfer_history: districtChanged ? [...(d.apn_transfer_history || []), { id: uid(), partnerId: partner.id, previousDistrict: partner.district || "Unassigned", newDistrict: persistedNext.district || "Unassigned", effectiveDate: Date.now(), changedBy: currentUser, reason: "Profile edit", createdAt: Date.now() }] : d.apn_transfer_history }), M(`Super Admin updated partner profile${changes.length ? ` · ${changes.join(" · ")}` : ""}`, partner.id, partner, next), profileEvents);
    if (refreshPeople) await refreshPeople();
    setModal(null);
  };
  const deletePartnerNow = async (partner, reason) => withActionError(async () => {
    const { data, error } = await supabase.functions.invoke("admin-users", { body: { action: "delete", userId: partner.id, archive: true, archiveReason: reason } });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    const at = Date.now();
    mutateApn((d) => ({ ...d, apn_users: d.apn_users.map((u) => u.id === partner.id ? { ...u, status: "deleted", deletedAt: at, deletedBy: currentUser, deleteReason: reason, archivedAt: at, updatedAt: at } : u) }), M(`deleted APN partner "${partner.name}" and archived business history`, partner.id), timeline(partner, "deleted", "Deleted (Archived)", reason, at));
    if (refreshPeople) await refreshPeople();
  });
  const permanentDeleteNow = async (partner, reason) => withActionError(async () => {
    const { data, error } = await supabase.functions.invoke("admin-users", { body: { action: "permanent_delete", userId: partner.id, reason } });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    const at = Date.now();
    // The service-role function removed only the auth identity. Keep the APN
    // row as an immutable business-history marker for reports and audit joins.
    mutateApn((d) => ({ ...d, apn_users: (d.apn_users || []).map((row) => row.id === partner.id ? { ...row, status: "deleted", permanentlyDeleted: true, deleteReason: reason, deletedAt: at, updatedAt: at } : row) }), M(`permanently deleted APN partner "${partner.name}"`, partner.id, { status: partner.status }, { status: "deleted", permanentlyDeleted: true, reason }), timeline(partner, "permanently-deleted", "Login Identity Removed", "APN history preserved; email and username released.", at));
    if (refreshPeople) await refreshPeople();
  });
  const confirmAction = async () => {
    const item = pendingAction;
    setPendingAction(null);
    if (!item) return;
    await withActionError(async () => {
      const p = item.partner;
      if (item.kind === "saveProfile") return saveProfileNow(p, item.next);
      if (item.kind === "deactivate") return mutateApn((d) => ({ ...d, apn_users: d.apn_users.map((u) => u.id === p.id ? { ...u, status: "inactive", updatedAt: Date.now() } : u) }), M(`deactivated APN partner "${p.name}"`, p.id), timeline(p, "deactivated", "Deactivated", "Partner account was deactivated."));
      if (item.kind === "reactivate") {
        await updateProfileStatus(p, true, "active");
        const at = Date.now();
        return mutateApn((d) => ({ ...d, apn_users: d.apn_users.map((u) => u.id === p.id ? { ...u, status: "active", reactivatedAt: at, reactivatedBy: currentUser, reactivationReason: item.reason, reactivationRequested: null, reactivationRecommended: null, updatedAt: at } : u), apn_notifications: [...(d.apn_notifications || []), withSender(apnNotify({ title: "Account reactivated", body: "Your APN account is active again. Remember to check in daily.", audience: "partner:" + p.id }))] }), M(`reactivated APN partner "${p.name}" · ${item.reason}`, p.id), timeline(p, "reactivated", "Reactivated", item.reason));
      }
      if (item.kind === "promote" || item.kind === "demote") {
        const at = Date.now();
        const promoting = item.kind === "promote";
        const toState = promoting && (p.role === "district_head" || p.level === "District Head");
        const targetLevel = promoting ? (toState ? "State Head" : "District Head") : (p.role === "state_head" || p.level === "State Head" ? "District Head" : "Senior Partner");
        const targetRole = targetLevel === "State Head" ? "state_head" : targetLevel === "District Head" ? "district_head" : "partner";
        return mutateApn((d) => ({ ...d, apn_users: d.apn_users.map((u) => u.id === p.id ? { ...u, role: targetRole, level: targetLevel, ...(promoting ? { promotedAt: at, promotedBy: currentUser } : { demotedAt: at, demotedBy: currentUser }), updatedAt: at } : u) }), M(`${promoting ? "promoted" : "demoted"} APN partner "${p.name}" to ${targetLevel}`, p.id), timeline(p, item.kind, promoting ? "Promoted" : "Demoted", `Partner hierarchy changed to ${targetLevel}.`, at));
      }
      if (item.kind === "resetQuiz") return mutateApn((d) => ({ ...d, apn_users: d.apn_users.map((u) => u.id === p.id ? { ...u, quizPasses: {}, unlocked: {}, updatedAt: Date.now() } : u) }), M(`reset quiz status for APN partner "${p.name}"`, p.id));
      if (item.kind === "resetTraining") return mutateApn((d) => ({ ...d, apn_users: d.apn_users.map((u) => u.id === p.id ? { ...u, unlocked: {}, updatedAt: Date.now() } : u) }), M(`reset training status for APN partner "${p.name}"`, p.id));
      if (item.kind === "resetAttendance") return mutateApn((d) => ({ ...d, apn_attendance: (d.apn_attendance || []).filter((a) => a.partnerId !== p.id), apn_users: d.apn_users.map((u) => u.id === p.id ? { ...u, attendanceScore: null, attendanceResetAt: Date.now(), updatedAt: Date.now() } : u) }), M(`reset attendance for APN partner "${p.name}"`, p.id));
      if (item.kind === "resetTarget") return mutateApn((d) => ({ ...d, apn_targets: (d.apn_targets || []).filter((t) => t.partnerId !== p.id), apn_users: d.apn_users.map((u) => u.id === p.id ? { ...u, target: 0, targetResetAt: Date.now(), updatedAt: Date.now() } : u) }), M(`reset target for APN partner "${p.name}"`, p.id));
      if (item.kind === "resetCommission") return mutateApn((d) => ({ ...d, apn_users: d.apn_users.map((u) => u.id === p.id ? { ...u, commissionPct: null, commissionResetAt: Date.now(), updatedAt: Date.now() } : u) }), M(`reset commission settings for APN partner "${p.name}"`, p.id));
      if (item.kind === "deleteWarning") return mutateApn((d) => ({ ...d, apn_warnings: (d.apn_warnings || []).filter((w) => w.id !== item.warning.id) }), M(`deleted warning for APN partner "${p.name}"`, p.id));
    });
  };
  const approvePartner = (partner) => withActionError(async () => {
    const { error } = await supabase.from("profiles").update({ role: "partner", approved: true, active: true, status: "active" }).eq("id", partner.id);
    if (error) throw new Error(error.message);
    const at = Date.now();
    mutateApn((d) => ({ ...d, apn_users: d.apn_users.map((u) => u.id === partner.id ? { ...u, status: "active", approvedAt: at, approvedBy: currentUser, rejectedAt: null, rejectReason: null } : u), apn_notifications: [...(d.apn_notifications || []), withSender(apnNotify(apnApprovalNotification(partner, currentUser)))] }), M(`approved APN partner "${partner.name}"`, partner.id), timeline(partner, "approved", "Approved by Admin", "The APN application was approved.", at));
  });
  const rejectPartner = (partner, reason) => withActionError(async () => {
    const at = Date.now();
    const { error } = await supabase.from("profiles").update({ approved: false, active: false, status: "terminated" }).eq("id", partner.id);
    if (error) throw new Error(error.message);
    mutateApn((d) => ({ ...d, apn_users: d.apn_users.map((u) => u.id === partner.id ? { ...u, status: "rejected", rejectReason: reason, rejectedBy: currentUser, rejectedAt: at } : u) }), M(`rejected APN application "${partner.name}"${reason ? ` · ${reason}` : ""}`, partner.id), timeline(partner, "rejected", "Application Rejected", reason || "The APN application was rejected.", at));
  });
  const banPartner = (partner, reason) => withActionError(async () => {
    // profiles_status_check has no "banned"; the ban lives on apn_users and the
    // auth profile is switched to suspended so login is blocked.
    await updateProfileStatus(partner, false, "suspended");
    const at = Date.now();
    mutateApn((d) => ({ ...d, apn_users: d.apn_users.map((u) => u.id === partner.id ? { ...u, status: "banned", banReason: reason, bannedBy: currentUser, bannedAt: at, updatedAt: at } : u), apn_notifications: [...(d.apn_notifications || []), withSender(apnNotify({ title: "Account banned", body: "Your APN account has been banned by the administration.", audience: "partner:" + partner.id }))] }), M(`banned APN partner "${partner.name}" · ${reason}`, partner.id), timeline(partner, "banned", "Banned", reason, at));
  });
  const runAction = (action, partner) => {
    if (action === "View details") return openProfile(partner);
    if (action === "Edit Profile" || action === "Change Username" || action === "Change Email" || action === "Change Phone" || action === "Transfer District") return openProfile(partner);
    if (action === "View Timeline") return openProfile(partner, "timeline");
    if (["View Activity Log", "View Activity"].includes(action)) return openProfile(partner, "activity");
    if (action === "Send Notification") return setModal({ type: "apnCommunication", partner });
    if (action === "Generate Report") return exportApnPartnerReport(partner);
    if (action === "Reset Password") return setModal({ type: "apnResetPassword", partner });
    if (action === "Suspend") return setModal({ type: "apnSuspend", partner });
    if (action === "Ban") return setModal({ type: "apnBan", partner });
    if (action === "Reactivate") return setModal({ type: "apnReactivate", partner });
    if (action === "Delete Partner") return setModal({ type: "apnDelete", partner });
    if (action === "Permanent Delete") return setModal({ type: "apnPermanentDelete", partner });
    const kind = { Approve: "approve", Reject: "reject", Deactivate: "deactivate", Reactivate: "reactivate", Promote: "promote", Demote: "demote", "Reset Quiz": "resetQuiz", "Reset Training": "resetTraining", "Reset Attendance": "resetAttendance", "Reset Target": "resetTarget", "Reset Commission": "resetCommission", "Delete Partner": "delete" }[action];
    if (kind === "approve") return approvePartner(partner);
    if (kind === "reject") return setModal({ type: "apnReject", partner });
    if (kind) return setPendingAction({ kind, partner });
  };

  const act = {
    approve: approvePartner,
    reject: rejectPartner,
    deactivate: (p) => mutate((d) => ({ ...d, apn_users: d.apn_users.map((u) => u.id === p.id ? { ...u, status: "inactive" } : u) }), M(`deactivated APN partner "${p.name}"`)),
    reactivate: (p) => mutate((d) => ({ ...d, apn_users: d.apn_users.map((u) => u.id === p.id ? { ...u, status: "active", reactivatedAt: Date.now(), reactivationRequested: null, reactivationRecommended: null } : u), apn_notifications: [...(d.apn_notifications || []), withSender(apnNotify({ title: "Account reactivated", body: "Your APN account is active again. Remember to check in daily.", audience: "partner:" + p.id }))] }), M(`reactivated APN partner "${p.name}"`)),
    setHead: (p, on) => mutate((d) => ({ ...d, apn_users: d.apn_users.map((u) => u.id === p.id ? { ...u, role: on ? "district_head" : "partner" } : u) }), M(`${on ? "appointed" : "removed"} district head "${p.name}"`)),
    bulk: (action, selectedPartners) => setModal({ type: "apnBulk", action, partners: selectedPartners }),
    run: runAction,
  };
  const saveLead = (lead) => {
    const previous = (db.apn_leads || []).find((x) => x.id === lead.id) || null;
    const action = previous?.status !== lead.status && lead.status ? `marked APN lead ${lead.status.toLowerCase()}` : `updated APN lead "${lead.clientName}"`;
    return mutate((d) => {
    let next = { ...d, apn_leads: (d.apn_leads || []).map((x) => x.id === lead.id ? lead : x) };
    const hasComm = (d.apn_commissions || []).some((c) => c.leadId === lead.id);
    if (lead.status === "Converted" && lead.paymentReceived && lead.projectCompleted && !hasComm) next.apn_commissions = [...(d.apn_commissions || []), ...apnBuildCommissions(next, lead)];
    return next;
    }, { ...M(action, lead.partnerId, previous, lead), entity: "APN Lead", entityId: lead.id, metadata: { status: lead.status } });
  };
  const setCommStatus = (c, status) => {
    if (status === APN_COMM_REVERSED) return; // reversals go through the audited RPC only
    mutate((d) => {
    let next = { ...d, apn_commissions: d.apn_commissions.map((x) => x.id === c.id ? { ...x, status, ...(status === "Approved" ? { approvedAt: Date.now() } : {}), ...(status === "Paid" ? { paidAt: Date.now() } : {}) } : x) };
    if (status === "Approved" && c.kind !== "district") next.apn_notifications = [...(d.apn_notifications || []), withSender(apnNotify({ title: "Commission approved ✅", body: `${money(c.amount)} for ${c.project} is approved and added to your wallet.`, audience: "partner:" + c.partnerId, level: "Important" }))];
    return next;
  }, { ...M(`${status === "Paid" ? "paid" : status === "Approved" ? "approved" : "updated"} APN commission for ${c.project}`, c.partnerId, c.status, status), entity: "APN Commission", entityId: c.id });
  };
  const saveCommissionProject = ({ project, collections }) => withActionError(async () => {
    const projectRows = (db.apn_commission_projects || []).some((row) => row.id === project.id) ? (db.apn_commission_projects || []).map((row) => row.id === project.id ? project : row) : [...(db.apn_commission_projects || []), project];
    const collectionRows = collections || [];
    const { error: rpcError } = await supabase.rpc("upsert_apn_commission_project", { p_project: project, p_collections: collectionRows });
    if (rpcError) throw new Error(rpcError.message);
    const partner = partners.find((p) => p.id === project.partnerId);
    const eventAt = Date.now();
    const collectionEvents = collectionRows.map((row) => timeline(partner || { id: project.partnerId }, "revenue-collected", "Revenue Collection Added", `Received ${money(row.receivedAmount)} · commission credited ${money(row.commissionGenerated)}${Number(row.incentive) ? ` · incentive ${money(row.incentive)}` : ""}.`, row.createdAt || eventAt));
    const statusEvent = timeline(partner || { id: project.partnerId }, project.status === "Completed" ? "project-completed" : "project-updated", project.status === "Completed" ? "Project Completed" : "Commission Project Updated", `${project.projectName} · received ${money(project.totalReceived)} · pending commission ${money(project.remainingCommission)}.`, eventAt);
    const notification = collectionRows.length
      ? { title: "Revenue collection recorded", body: `${money(project.totalReceived)} received for ${project.projectName}. Commission credited: ${money(project.commissionEarned)}.` }
      : { title: "Commission project created", body: `${project.projectName} was added with a maximum commission of ${money(project.maximumCommission)}.` };
    mutateApn((d) => ({ ...d, apn_commission_projects: projectRows, apn_revenue_collections: [...(d.apn_revenue_collections || []).filter((row) => row.projectId !== project.id), ...collectionRows], apn_notifications: [...(d.apn_notifications || []), withSender(apnNotify({ ...notification, metadata: { projectId: project.id }, audience: `partner:${project.partnerId}`, level: "Important" }))] }), { ...M(`${project.createdAt === project.updatedAt ? "created" : "updated"} APN commission project "${project.projectName}"`, project.partnerId, null, project), entity: "APN Commission Project", entityId: project.id }, [statusEvent, ...collectionEvents]);
  });
  const deleteCommissionProject = (project) => withActionError(async () => {
    if (!isSuper) throw new Error("Only a Super Admin can delete commission projects.");
    try {
      // Cancelled projects have already had their finance impact reversed. They
      // use the explicit purge path so the project, collections, reversal
      // transaction, notifications and projections disappear together.
      const rpcName = project.status === "Cancelled"
        ? "apn_delete_cancelled_commission_project"
        : "apn_delete_commission_project";
      const { data, error } = await supabase.rpc(rpcName, { p_project_id: project.id });
      if (error) throw new Error(error.message);
      if (!data?.deleted) throw new Error("The production delete operation did not confirm deletion.");
      onCommissionDeleted?.(project);
      // The RPC is the source of truth. A transient refresh failure must not
      // turn a successful deletion into a false failure or leave the dialog up.
      try { await onRefresh?.(); } catch (refreshError) { console.warn("APN commission refresh after delete failed", refreshError); }
      emitToast("Commission project deleted successfully.", "success");
    } catch (error) {
      throw new Error(`Unable to delete commission project: ${error?.message || "The production operation failed."}`);
    }
  });
  const requestCommissionDelete = (project) => {
    setActionError("");
    const partnerName = (db.apn_users || []).find((row) => row.id === project.partnerId)?.name || project.partnerName || "—";
    setModal({
      type: "confirm",
      title: "Delete commission project?",
      body: `Partner: ${partnerName}\nProject: ${project.projectName || "—"}\nValue: ${money(project.projectValue)}\nReceived: ${money(project.totalReceived)}\nCommission: ${money(project.commissionEarned)}\nStatus: ${project.status || "—"}\n\nThis action cannot be undone.`,
      confirmLabel: "Delete permanently",
      onConfirm: () => deleteCommissionProject(project),
    });
  };
  const requestCommissionReverse = (entry) => {
    setActionError("");
    const partnerName = (db.apn_users || []).find((row) => row.id === entry.partnerId)?.name || "—";
    setModal({
      type: "apnCommissionReverse",
      commission: entry,
      partnerName,
      isSuper,
    });
  };
  const reverseCommissionNow = (entry, reason, unlockPaid) => withActionError(async () => {
    const { error: rpcError } = await supabase.rpc("apn_commission_reverse_legacy", { p_commission_id: entry.id, p_reason: reason.trim(), p_unlock_paid: !!unlockPaid });
    if (rpcError) throw new Error(rpcError.message);
    mutateApn((d) => ({ ...d, apn_commissions: (d.apn_commissions || []).map((x) => x.id === entry.id ? { ...x, status: APN_COMM_REVERSED, reversedAt: Date.now(), reversedBy: currentUser, reversalReason: reason.trim(), unlockPaid: !!unlockPaid } : x) }), M(`reversed APN commission ${money(entry.amount)} for "${entry.project}"${unlockPaid ? " (paid unlock)" : ""} · ${reason.trim()}`, entry.partnerId, entry.status, APN_COMM_REVERSED), timeline((db.apn_users || []).find((u) => u.id === entry.partnerId) || { id: entry.partnerId }, "commission-reversed", "Commission Reversed", `${money(entry.amount)} for ${entry.project || "project"}: ${reason.trim()}${unlockPaid ? " (paid amount unlocked by super admin)" : ""}.`, Date.now(), currentUser));
    emitToast("Commission reversed and wallet updated.", "success");
    setModal(null);
  });
  const saveTarget = (t) => mutate((d) => ({ ...d, apn_targets: [...(d.apn_targets || []), t], apn_notifications: [...(d.apn_notifications || []), withSender(apnNotify({ title: "New target assigned 🎯", body: `${t.title} — ${t.goal} ${apnMetricLabel(t.metric)}.`, audience: "partner:" + t.partnerId, level: "Important" }))] }), M(`assigned APN target "${t.title}"`));
  const saveRow = (table, row, action) => mutate((d) => ({ ...d, [table]: (d[table] || []).some((x) => x.id === row.id) ? d[table].map((x) => x.id === row.id ? row : x) : [...(d[table] || []), row] }), M(action));
  const sendNotif = (n) => mutate((d) => ({ ...d, apn_notifications: [...(d.apn_notifications || []), withSender(n)] }), M(`sent APN notification "${n.title}"`));
  const saveWarning = (partner, value) => {
    const at = Date.now();
    const row = { id: uid(), partnerId: partner.id, type: value.type, reason: value.notes, notes: value.notes, issuedBy: currentUser, issuedAt: at, status: "Active", createdAt: at, updatedAt: at };
    mutateApn((d) => ({ ...d, apn_warnings: [...(d.apn_warnings || []), row] }), M(`issued ${value.type} warning for APN partner "${partner.name}"`, partner.id), timeline(partner, "warning", "Warning Issued", `${value.type}: ${value.notes}`, at));
    setModal(null);
  };
  const resolveWarning = (partner, warning) => {
    const at = Date.now();
    mutateApn((d) => ({ ...d, apn_warnings: (d.apn_warnings || []).map((w) => w.id === warning.id ? { ...w, status: "Resolved", resolvedBy: currentUser, resolvedAt: at, updatedAt: at } : w) }), M(`resolved warning for APN partner "${partner.name}"`, partner.id), timeline(partner, "warning-resolved", "Warning Resolved", warning.type, at));
  };
  const saveNote = (partner, initial, bodyHtml) => {
    const at = Date.now();
    const row = initial
      ? { ...initial, bodyHtml: apnSafeHtml(bodyHtml), updatedAt: at, history: [...(initial.history || []), { bodyHtml: initial.bodyHtml || initial.body || "", editedAt: at, editedBy: currentUser }] }
      : { id: uid(), partnerId: partner.id, bodyHtml: apnSafeHtml(bodyHtml), author: currentUser, authorId: null, createdAt: at, updatedAt: at, history: [] };
    mutateApn((d) => ({ ...d, apn_notes: (d.apn_notes || []).some((n) => n.id === row.id) ? d.apn_notes.map((n) => n.id === row.id ? row : n) : [...(d.apn_notes || []), row] }), M(`${initial ? "edited" : "added"} internal note for APN partner "${partner.name}"`, partner.id), timeline(partner, initial ? "note-edited" : "note-added", initial ? "Internal Note Edited" : "Internal Note Added", "An internal administrator note was saved.", at));
    setModal(null);
  };
  const saveTags = (partner, tags) => {
    if (!isSuper) return;
    const nextTags = [...new Set((tags || []).map((x) => String(x).trim()).filter(Boolean))];
    mutateApn((d) => ({ ...d, apn_users: (d.apn_users || []).map((u) => u.id === partner.id ? { ...u, tags: nextTags, updatedAt: Date.now() } : u) }), M(`updated tags for APN partner "${partner.name}"`, partner.id), timeline(partner, "tags-updated", "Tags Updated", nextTags.join(", ") || "Tags cleared."));
    setModal(null);
  };
  const savePartnerDocument = (partner, value, initial) => withActionError(async () => {
    if (!isSuper) return;
    let storagePath = initial?.storagePath || "";
    if (value.file) {
      const safeName = value.file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      storagePath = `${partner.id}/${Date.now()}-${safeName}`;
      const { error } = await supabase.storage.from("apn-private").upload(storagePath, value.file, { upsert: false, contentType: value.file.type || undefined });
      if (error) throw new Error(error.message);
    }
    if (!storagePath) throw new Error("Choose a private document file.");
    const at = Date.now();
    const row = { ...(initial || {}), id: initial?.id || uid(), partnerId: partner.id, type: value.type, version: value.version, notes: value.notes, storagePath, uploadedBy: initial?.uploadedBy || currentUser, uploadedOn: initial?.uploadedOn || at, updatedAt: at, createdAt: initial?.createdAt || at, downloadHistory: initial?.downloadHistory || [], versions: initial ? [...(initial.versions || []), { version: initial.version || 1, storagePath: initial.storagePath, uploadedBy: initial.uploadedBy, uploadedOn: initial.uploadedOn }] : [] };
    mutateApn((d) => ({ ...d, apn_documents: (d.apn_documents || []).some((x) => x.id === row.id) ? d.apn_documents.map((x) => x.id === row.id ? row : x) : [...(d.apn_documents || []), row] }), M(`${initial ? "updated" : "uploaded"} private APN document for "${partner.name}"`, partner.id), timeline(partner, "document-uploaded", "Partner Document Updated", `${value.type} · version ${value.version}`));
    setModal(null);
  });
  const downloadPartnerDocument = (documentRow) => withActionError(async () => {
    if (!isSuper || !documentRow.storagePath) return;
    const { data, error } = await supabase.storage.from("apn-private").createSignedUrl(documentRow.storagePath, 600);
    if (error) throw new Error(error.message);
    const at = Date.now();
    mutateApn((d) => ({ ...d, apn_documents: (d.apn_documents || []).map((x) => x.id === documentRow.id ? { ...x, downloadHistory: [...(x.downloadHistory || []), { downloadedBy: currentUser, downloadedOn: at }] } : x) }), M(`downloaded APN document ${documentRow.type || "document"}`, documentRow.partnerId));
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  });
  const saveCommunication = (partner, value) => {
    if (!isSuper) return;
    const at = Date.now();
    const row = { id: uid(), partnerId: partner.id, type: value.type, sender: currentUser, receiver: value.receiver, subject: value.subject, message: value.message, status: value.status, createdAt: at, updatedAt: at };
    mutateApn((d) => ({ ...d, apn_communications: [...(d.apn_communications || []), row], ...(value.type === "Notification" ? { apn_notifications: [...(d.apn_notifications || []), withSender(apnNotify({ title: value.subject || "Message from ALLBEE", body: value.message, audience: `partner:${partner.id}` }))] } : {}) }), M(`logged ${value.type} for APN partner "${partner.name}"`, partner.id), timeline(partner, "communication", "Communication Logged", `${value.type}: ${value.subject || value.message || "No subject"}`, at));
    setModal(null);
  };
  const exportApnPartnerReport = async (selectedPartners) => {
    if (!isSuper) return;
    const list = Array.isArray(selectedPartners) ? selectedPartners : [selectedPartners];
    const rows = [];
    for (const p of list) {
      const s = apnPartnerStats(db, p.id);
      const add = (section, field, value) => rows.push({ partner: p.name, apnId: apnIdFor(p), section, field, value: value == null ? "" : typeof value === "object" ? JSON.stringify(value) : value });
      add("Profile", "Name", p.name); add("Profile", "Username", p.username); add("Profile", "Email", p.email); add("Profile", "Phone", p.mobile); add("Profile", "District", p.district); add("Profile", "Status", apnStatusLabel(apnEffectiveStatus(p))); add("Profile", "Health Score", apnHealthScore(db, p, people.find((x) => x.id === p.id)).score); add("Profile", "Last Seen", apnLastSeenLabel(p, people.find((x) => x.id === p.id)));
      add("Revenue", "Generated", s.revenue); add("Revenue", "Leads", s.submitted); add("Revenue", "Converted", s.converted); add("Revenue", "Commission Earned", s.commission.earned); add("Revenue", "Commission Paid", s.commission.paid); add("Revenue", "Pending Commission", s.commission.pending);
      [...new Map([...apnDerivedTimeline(db, p), ...(db.apn_timeline || []).filter((x) => x.partnerId === p.id)].map((x) => [x.id, x])).values()].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).forEach((x) => add("Timeline", x.title, `${fmtDateTime(x.createdAt)} · ${x.description} · ${x.performedBy || "System"}`));
      (db.apn_warnings || []).filter((x) => x.partnerId === p.id).forEach((x) => add("Warnings", x.type, `${x.status} · ${x.notes || x.reason} · ${x.issuedBy || "—"}`));
      (db.apn_notes || []).filter((x) => x.partnerId === p.id).forEach((x) => add("Internal Notes", "Note", String(x.bodyHtml || x.body || "").replace(/<[^>]*>/g, "")));
      (db.apn_leads || []).filter((x) => x.partnerId === p.id).forEach((x) => add("Leads", x.leadId || x.id, x));
      (db.apn_quotations || []).filter((x) => x.partnerId === p.id).forEach((x) => add("Quotations", x.id, x));
      (db.apn_attendance || []).filter((x) => x.partnerId === p.id).forEach((x) => add("Attendance", x.date || x.id, x));
      (db.apn_commissions || []).filter((x) => x.partnerId === p.id).forEach((x) => add("Commissions", x.project || x.id, x));
      apnCommissionProjectsOf(db, p.id).forEach((x) => add("Commission Projects", x.projectName || x.id, x));
      apnCommissionProjectsOf(db, p.id).forEach((project) => apnRevenueCollectionsOf(db, project.id).forEach((x) => add("Revenue Collections", x.id, x)));
    }
    await exportRowsToExcel(`allbee-apn-partners-${todayISO()}.xlsx`, "APN Partner Report", [{ label: "Partner", value: (r) => r.partner }, { label: "APN ID", value: (r) => r.apnId }, { label: "Section", value: (r) => r.section }, { label: "Field", value: (r) => r.field }, { label: "Value", value: (r) => r.value, w: 70 }], rows);
    mutate((d) => d, { ...M(`exported full APN report for ${list.length} partner${list.length === 1 ? "" : "s"}`), partnerIds: list.map((x) => x.id) });
  };
  const executeBulk = (action, selectedPartners, values) => {
    setModal(null);
    withActionError(async () => {
      if (action === "Export") return exportApnPartnerReport(selectedPartners);
      const at = Date.now();
      if (action === "Import Partners (CSV)") {
        const { header, data } = values.csv || {};
        if (!data) return;
        const col = (row, names) => { const i = header.findIndex((h) => names.includes(h)); return i >= 0 ? row[i] : ""; };
        const added = [];
        for (const row of data) {
          const name = col(row, ["name", "full name", "partner", "full_name"]).trim();
          const mobile = col(row, ["mobile", "mobile number", "phone", "phone number"]).trim();
          const email = col(row, ["email", "email address"]).trim().toLowerCase();
          const district = col(row, ["district"]).trim();
          if (!name) continue;
          const existing = (db.apn_users || []).some((u) => u.id === name || u.email === email || (mobile && u.mobile === mobile));
          if (existing) continue;
          added.push({ id: uid(), apnId: "", name, mobile, email, district, status: "pending", role: "partner", importedBy: currentUser, importedAt: at, unlocked: {}, quizPasses: {}, createdAt: at });
        }
        if (!added.length) return;
        mutateApn((d) => ({ ...d, apn_users: [...(d.apn_users || []), ...added] }), M(`bulk-imported ${added.length} partners from CSV (restricted adds — pending approval)`), added.map((p) => timeline(p, "imported", "Imported via CSV", "Restricted add — pending approval and credentials.", at)));
        emitToast(`${added.length} partner${added.length === 1 ? "" : "s"} imported as pending.`, "success"); return;
      }
      if (action === "Import Targets (CSV)") {
        const { header, data } = values.csv || {};
        if (!data) return;
        const col = (row, names) => { const i = header.findIndex((h) => names.includes(h)); return i >= 0 ? row[i] : ""; };
        const created = []; let skipped = 0;
        for (const row of data) {
          const partnerKey = col(row, ["partner", "partner name", "apn id", "apn_id"]).trim().toLowerCase();
          const title = col(row, ["title", "target", "target title"]).trim();
          const metric = col(row, ["metric"]).trim();
          const goal = Number(col(row, ["goal", "value", "target value"])) || 0;
          const par = Number(col(row, ["par", "par value", "par_value"])) || null;
          const parentKey = col(row, ["parent", "parent name", "head", "district head"]).trim().toLowerCase();
          const p = (db.apn_users || []).find((u) => apnIdFor(u).toLowerCase() === partnerKey || String(u.name || "").toLowerCase() === partnerKey || String(u.email || "").toLowerCase() === partnerKey);
          if (!p || apnEffectiveStatus(p) === "rejected") { skipped++; continue; }
          const head = parentKey ? (db.apn_users || []).find((u) => (u.role === "district_head" || u.level === "District Head") && (String(u.name || "").toLowerCase() === parentKey)) : null;
          created.push({ id: uid(), partnerId: p.id, partnerName: p.name, parentId: head?.id || null, parentName: head?.name || null, title: title || `${goal} ${apnMetricLabel(APN_TARGET_METRICS.some(([k]) => k === metric) ? metric : "leads").toLowerCase()}`, metric: APN_TARGET_METRICS.some(([k]) => k === metric) ? metric : "leads", goal: par && par > 0 && par < 100 ? round2(goal * (par / 100)) : goal, parValue: par && par > 0 && par < 100 ? par : null, acknowledged: false, createdAt: at });
        }
        if (!created.length) return;
        mutateApn((d) => ({ ...d, apn_targets: [...(d.apn_targets || []), ...created], apn_notifications: [...(d.apn_notifications || []), ...created.map((t) => withSender(apnNotify({ title: "New target assigned 🎯", body: `${t.title} — ${t.goal} ${apnMetricLabel(t.metric)}.`, audience: "partner:" + t.partnerId, level: "Important" })))] }), M(`bulk-imported ${created.length} targets from CSV (par-value ${created.filter((t) => t.parValue).length}, skipped ${skipped})`), created.map((t) => timeline({ id: t.partnerId, name: t.partnerName }, "target-bulk-imported", "Target Imported", `${t.title} · ${t.goal} ${apnMetricLabel(t.metric)}${t.parValue ? " · par " + t.parValue + "%" : ""}.`, at)));
        emitToast(`${created.length} target${created.length === 1 ? "" : "s"} imported${skipped ? ` (${skipped} row${skipped === 1 ? "" : "s"} skipped)` : ""}.`, "success"); return;
      }
      if (action === "Suspend" || action === "Activate") await Promise.all(selectedPartners.map((p) => updateProfileStatus(p, action === "Activate", action === "Activate" ? "active" : "suspended")));
      if (action === "Delete") {
        for (const p of selectedPartners) {
          const { data, error } = await supabase.functions.invoke("admin-users", { body: { action: "delete", userId: p.id, archive: true, archiveReason: values.reason || "Bulk archive" } });
          if (error) throw new Error(error.message);
          if (data?.error) throw new Error(data.error);
        }
      }
      mutateApn((d) => ({ ...d,
        apn_users: (d.apn_users || []).map((u) => {
          const p = selectedPartners.find((x) => x.id === u.id); if (!p) return u;
          if (action === "Transfer District") return { ...u, district: values.district, districtAssignedAt: at, districtAssignedBy: currentUser, updatedAt: at };
          if (action === "Assign District Head") return { ...u, district: values.district, districtAssignedAt: at, districtAssignedBy: currentUser, role: "district_head", level: "District Head", promotedAt: at, promotedBy: currentUser, updatedAt: at };
          if (action === "Suspend") return { ...u, status: "suspended", suspensionReason: values.reason, suspendedBy: currentUser, suspendedAt: at, updatedAt: at };
          if (action === "Deactivate") return { ...u, status: "inactive", updatedAt: at };
          if (action === "Activate") return { ...u, status: "active", updatedAt: at };
          if (action === "Delete") return { ...u, status: "deleted", deleteReason: values.reason || "Bulk archive", deletedBy: currentUser, deletedAt: at, archivedAt: at, updatedAt: at };
          return u;
        }),
        apn_transfer_history: ["Transfer District", "Assign District Head"].includes(action) ? [...(d.apn_transfer_history || []), ...selectedPartners.map((p) => ({ id: uid(), partnerId: p.id, previousDistrict: p.district || "Unassigned", newDistrict: values.district, effectiveDate: at, changedBy: currentUser, reason: values.reason || `Bulk ${action}`, createdAt: at }))] : d.apn_transfer_history,
        apn_notifications: action === "Send Notification" ? [...(d.apn_notifications || []), ...selectedPartners.map((p) => withSender(apnNotify({ title: "APN admin notification", body: values.message, audience: `partner:${p.id}` })))] : d.apn_notifications,
      }), { ...M(`bulk ${action.toLowerCase()} for ${selectedPartners.length} APN partners`), partnerIds: selectedPartners.map((x) => x.id) }, selectedPartners.map((p) => timeline(p, action.toLowerCase().replace(/\s/g, "-"), action, values.reason || values.message || `Bulk ${action.toLowerCase()} operation.` , at)));
      if (refreshPeople && ["Delete", "Suspend", "Activate"].includes(action)) await refreshPeople();
    });
  };

  const actionBadges = apnAdminActionCounts(db, currentUserId);
  const tabs = [["hub", "Hub", 0], ["partners", "Partners", actionBadges.partners], ["leads", "Leads", 0], ["commissions", "Commissions", actionBadges.commissions], ["withdrawals", "Withdrawals", actionBadges.withdrawals], ["referrals", "Referrals", actionBadges.referrals], ["support", "Support", 0], ["targets", "Targets", actionBadges.targets], ["content", "Training", actionBadges.content], ["docs", "Materials", actionBadges.docs], ["agreements", "Agreements", 0], ["notify", "Notify", actionBadges.notify], ["board", "Leaderboard", 0]];
  const selectTab = (nextTab) => {
    setTab(nextTab);
    const action = APN_ACTION_BADGE_MAP.find((item) => item.tab === nextTab);
    if (action) onActionBadgeSeen?.(action.actionType);
  };

  return (
    <div className="content">
      <div className="page-head"><h3>APN — Partner Network</h3><span className="spacer" />
        <button className="btn sm" onClick={() => setTab("activity")}><Activity size={14} />Activity Log</button>
        {tab === "partners" && isAdmin && <button className="btn primary" onClick={() => setShowCreate((v) => !v)}>{showCreate ? <X size={16} /> : <Plus size={16} />}{showCreate ? "Close form" : "Add partner"}</button>}
        {tab === "commissions" && isAdmin && <button className="btn primary" onClick={() => setModal({ type: "apnCommissionEntry" })}><Plus size={16} />Add entry</button>}
        {tab === "targets" && <button className="btn primary" onClick={() => setModal({ type: "apnTarget" })}><Plus size={16} />Assign target</button>}
        {tab === "notify" && <button className="btn primary" onClick={() => setModal({ type: "apnNotif" })}><Plus size={16} />New notification</button>}
      </div>
      <div className="apn-seg-scroll" style={{ marginBottom: 16 }}>{tabs.map(([k, l, badge]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => selectTab(k)}>{l}{badge > 0 && <ActionBadge count={badge} label={`${l.toLowerCase()} action`} />}</button>)}</div>

      {actionError && <div className="banner" style={{ marginBottom: 12, borderColor: "var(--neg)" }}><AlertTriangle size={15} />{actionError}</div>}
      {showCreate && tab === "partners" && <div style={{ marginBottom: 14 }}><APNCreatePartnerForm db={db} mutate={mutate} currentUser={currentUser} canManage={isAdmin} inline onClose={() => setShowCreate(false)} /></div>}
      {tab === "activity" && <APNAdminActivityLog db={db} isSuper={isSuper} onOpenRelated={onOpenRelated} />}
      {tab === "hub" && <APNAdminHub db={db} mutate={mutate} currentUser={currentUser} isAdmin={isAdmin} />}
      {tab === "partners" && <APNAdminPartners db={db} people={people} isSuper={isSuper} canManage={isAdmin} act={act} openModal={setModal} onOpenProfile={openProfile} />}
      {tab === "leads" && <APNAdminLeads db={db} openModal={setModal} />}
      {tab === "commissions" && <APNAdminCommissions db={db} setCommStatus={setCommStatus} openProject={(project) => setModal({ type: "apnCommissionEntry", initial: project, onDelete: isSuper ? requestCommissionDelete : undefined })} onDelete={isSuper ? requestCommissionDelete : undefined} onReverse={requestCommissionReverse} />}
      {tab === "withdrawals" && <React.Suspense fallback={<div className="card" aria-busy="true">Loading withdrawals…</div>}><LazyAPNAdminWithdrawals db={db} isSuper={isSuper} onRefresh={onRefresh} runtime={props.runtime} /></React.Suspense>}
      {tab === "referrals" && <APNAdminReferrals db={db} isSuper={isSuper} onRefresh={onRefresh} />}
      {tab === "support" && <APNAdminSupport isSuper={isSuper} people={(id) => (people || []).find((p) => p.id === id)?.name || (db.apn_users || []).find((p) => p.id === id)?.name} />}
      {tab === "targets" && (() => { const list = (db.apn_targets || []).slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); return (
        <div className="card">{list.length === 0 ? <Empty icon={<Target size={22} color="var(--muted)" />} title="No targets yet" text="Assign targets to partners; they must acknowledge them." action={<button className="btn primary" onClick={() => setModal({ type: "apnTarget" })}><Plus size={16} />Assign target</button>} />
          : <div style={{ overflowX: "auto" }}><table className="tbl apn-mobile-cards"><thead><tr><th>Partner</th><th>Target</th><th>Progress</th><th>Acknowledged</th></tr></thead>
            <tbody>{list.map((t) => { const p = apnTargetProgress(db, t); return <tr key={t.id}><td data-label="Partner">{t.partnerName}</td><td data-label="Target">{t.title}<div className="hint-line" style={{ fontSize: 11 }}>{t.goal} {apnMetricLabel(t.metric)}</div></td><td data-label="Progress" className="mono">{p.raw}/{p.goal} ({p.pct}%)</td><td data-label="Acknowledged">{t.acknowledged ? <span className="badge pos">Yes</span> : <span className="badge">No</span>}</td></tr>; })}</tbody>
          </table></div>}</div>
      ); })()}
      {tab === "content" && <APNAdminContent db={db} openModal={setModal} removeRow={removeRow} />}
      {tab === "docs" && <APNAdminDocs db={db} openModal={setModal} removeRow={removeRow} />}
      {tab === "agreements" && <APNAdminAgreements db={db} isAdmin={isAdmin} onRefresh={onRefresh} />}
      {tab === "notify" && (() => { const list = (db.apn_notifications || []).slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); return (
        <div className="card">{list.length === 0 ? <Empty icon={<Bell size={22} color="var(--muted)" />} title="No notifications sent" text="Send updates to all partners, a district, or one partner." action={<button className="btn primary" onClick={() => setModal({ type: "apnNotif" })}><Plus size={16} />New notification</button>} />
          : list.map((n) => { const sender = apnNotificationSender(n); return <div key={n.id} className="card stat" style={{ margin: "0 0 8px", display: "flex", alignItems: "center", gap: 10 }}><Avatar name={sender.name} url={sender.avatar} size={28} fontSize={11} /><div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>{n.title}</div><div className="hint-line" style={{ fontSize: 11 }}>{sender.name} · {sender.designation} · {n.audience === "all" ? "All partners" : n.audience.startsWith("district:") ? n.audience.slice(9) : "One partner"} · {fmtDateTime(n.createdAt)}</div></div><button className="iconbtn" style={{ width: 30, height: 30 }} onClick={() => removeRow("apn_notifications", n.id, `deleted APN notification "${n.title}"`)}><Trash2 size={14} /></button></div>; })}</div>
      ); })()}
      {tab === "board" && <APNAdminLeaderboard db={db} />}

      {modal?.type === "apnReject" && <APNRejectForm partner={modal.partner} onSave={modal.stateHead ? async (reason) => { setModal(null); try { const { error } = await supabase.rpc("apn_state_head_reject_partner", { p_partner_id: modal.partner.id, p_reason: reason || null }); if (error) throw error; const at = Date.now(); mutateApn((d) => ({ ...d, apn_users: (d.apn_users || []).map((u) => u.id === modal.partner.id ? { ...u, status: "rejected", rejectReason: reason, rejectedBy: currentUser, rejectedAt: at } : u) }), M(`rejected APN application "${modal.partner.name}"${reason ? ` · ${reason}` : ""}`, modal.partner.id), timeline(modal.partner, "rejected", "Application Rejected", reason || "The application was rejected.", at)); emitToast(`Rejected ${modal.partner.name}.`, "success"); } catch (e) { emitToast(e?.message || "Could not reject partner.", "error"); } } : (reason) => act.reject(modal.partner, reason)} onClose={() => setModal(null)} /> }
      {modal?.type === "apnPartnerProfile" && <APNPartnerProfile fullPage={!!modal.fullPage} partner={modal.partner} db={db} people={people} isSuper={isSuper} initialSection={modal.section} onSave={(next) => { setModal(null); setPendingAction({ kind: "saveProfile", partner: modal.partner, next }); }} onAction={runAction} onWarning={(p) => setModal({ type: "apnWarning", partner: p })} onResolveWarning={(warning) => resolveWarning(modal.partner, warning)} onDeleteWarning={(warning) => setPendingAction({ kind: "deleteWarning", partner: modal.partner, warning })} onNote={(p) => setModal({ type: "apnNote", partner: p })} onEditNote={(note) => setModal({ type: "apnNote", partner: modal.partner, initial: note })} onTags={(p) => setModal({ type: "apnTags", partner: p })} onDocuments={(p) => setModal({ type: "apnDocument", partner: p })} onDocumentDownload={downloadPartnerDocument} onCommunication={(p) => setModal({ type: "apnCommunication", partner: p })} onExport={(p) => exportApnPartnerReport(p)} onOpenFullPage={() => setModal((current) => ({ ...current, fullPage: true }))} onClose={() => setModal(null)} />}
      {modal?.type === "apnResetPassword" && <APNResetPasswordForm partner={modal.partner} onClose={() => setModal(null)} onSave={(password) => withActionError(async () => { const { data, error } = await supabase.functions.invoke("admin-users", { body: { action: "reset_password", userId: modal.partner.id, password } }); if (error) throw new Error(error.message); if (data?.error) throw new Error(data.error); mutate((d) => d, M(`reset password for APN partner "${modal.partner.name}"`, modal.partner.id)); setModal(null); })} />}
      {modal?.type === "apnSuspend" && <APNSuspendForm partner={modal.partner} onClose={() => setModal(null)} onSave={({ reason, notes }) => { const p = modal.partner; setModal(null); withActionError(async () => { const at = Date.now(); await updateProfileStatus(p, false, "suspended"); mutateApn((d) => ({ ...d, apn_users: d.apn_users.map((u) => u.id === p.id ? { ...u, status: "suspended", suspensionReason: reason, suspensionNotes: notes, suspendedBy: currentUser, suspendedAt: at, updatedAt: at } : u) }), M(`suspended APN partner "${p.name}" · ${reason}`, p.id), timeline(p, "suspended", "Suspended", notes ? `${reason}: ${notes}` : reason, at)); }); }} />}
      {modal?.type === "apnBan" && <APNBanForm partner={modal.partner} onClose={() => setModal(null)} onSave={(reason) => { const p = modal.partner; setModal(null); banPartner(p, reason); }} />}
      {modal?.type === "apnReactivate" && <APNReactivateForm partner={modal.partner} onClose={() => setModal(null)} onSave={(reason) => { const p = modal.partner; setModal(null); setPendingAction({ kind: "reactivate", partner: p, reason }); }} />}
      {modal?.type === "apnDelete" && <APNDeleteForm partner={modal.partner} onClose={() => setModal(null)} onSave={(reason) => { const p = modal.partner; setModal(null); deletePartnerNow(p, reason); }} />}
      {modal?.type === "apnPermanentDelete" && <APNPermanentDeleteForm partner={modal.partner} onClose={() => setModal(null)} onSave={(reason) => { const p = modal.partner; setModal(null); permanentDeleteNow(p, reason); }} />}
      {modal?.type === "apnWarning" && <APNWarningForm partner={modal.partner} onClose={() => setModal(null)} onSave={(value) => saveWarning(modal.partner, value)} />}
      {modal?.type === "apnNote" && <APNNoteForm partner={modal.partner} initial={modal.initial} onClose={() => setModal(null)} onSave={(bodyHtml) => saveNote(modal.partner, modal.initial, bodyHtml)} />}
      {modal?.type === "apnTags" && <APNTagForm partner={modal.partner} onClose={() => setModal(null)} onSave={(tags) => saveTags(modal.partner, tags)} />}
      {modal?.type === "apnDocument" && <APNPartnerDocumentForm partner={modal.partner} initial={modal.initial} onClose={() => setModal(null)} onSave={(value) => savePartnerDocument(modal.partner, value, modal.initial)} />}
      {modal?.type === "apnCommunication" && <APNCommunicationForm partner={modal.partner} onClose={() => setModal(null)} onSave={(value) => saveCommunication(modal.partner, value)} />}
      {modal?.type === "apnBulk" && <APNBulkForm action={modal.action} partners={modal.partners} onClose={() => setModal(null)} onSave={(values) => executeBulk(modal.action, modal.partners, values)} />}
      {modal?.type === "apnCreatePartner" && <APNCreatePartnerForm db={db} mutate={mutate} currentUser={currentUser} canManage={isAdmin} onClose={() => setModal(null)} />}
      {modal?.type === "apnCommissionEntry" && <React.Suspense fallback={<div className="card" aria-busy="true">Loading commission manager…</div>}><LazyAPNCommissionEntry db={db} initial={modal.initial} partners={[...new Map([...(partners.filter((p) => apnEffectiveStatus(p) === "active")), ...((db.apn_users || []).filter((p) => p.id === modal.initial?.partnerId))].map((p) => [p.id, p])).values()]} onSave={saveCommissionProject} onClose={() => setModal(null)} onDelete={modal.onDelete} runtime={props.runtime} /></React.Suspense>}
      {modal?.type === "apnCommissionReverse" && <APNCommissionReverseModal commission={modal.commission} partnerName={modal.partnerName} isSuper={modal.isSuper} onClose={() => setModal(null)} onSave={(reason, unlockPaid) => reverseCommissionNow(modal.commission, reason, unlockPaid)} />}
      {modal?.type === "apnLeadManage" && <APNLeadManage lead={modal.lead} onSave={saveLead} onClose={() => setModal(null)} />}
      {modal?.type === "apnTarget" && <APNTargetForm partners={partners.filter((p) => apnEffectiveStatus(p) !== "rejected")} heads={(db.apn_users || []).filter((u) => u.role === "district_head" || u.level === "District Head")} onSave={saveTarget} onClose={() => setModal(null)} />}
      {modal?.type === "apnTraining" && <APNTrainingForm initial={modal.initial} onSave={(r) => saveRow("apn_training", r, `${modal.initial ? "updated" : "added"} APN lesson "${r.title}"`)} onClose={() => setModal(null)} />}
      {modal?.type === "apnQuiz" && <APNQuizForm initial={modal.initial} onSave={(r) => saveRow("apn_quizzes", r, `${modal.initial ? "updated" : "created"} APN quiz "${r.title}"`)} onClose={() => setModal(null)} />}
      {modal?.type === "apnDoc" && <APNDocForm initial={modal.initial} onSave={(r) => saveRow("apn_documents", r, `${modal.initial ? "updated" : "uploaded"} APN material "${r.title}"`)} onClose={() => setModal(null)} />}
      {modal?.type === "apnNotif" && <APNNotifForm partners={partners} sender={{ name: currentUser, role: isSuper ? "Super Admin" : "Admin", designation: currentUserDesignation || (isSuper ? apnApproverFor(currentUser).designation : "Admin"), avatar: currentUserAvatar }} onSave={sendNotif} onClose={() => setModal(null)} />}
      {modal?.type === "confirm" && <Confirm title={modal.title} body={modal.body} confirmLabel={modal.confirmLabel} busyLabel="Deleting…" error={actionError} onConfirm={modal.onConfirm} onClose={() => setModal(null)} />}
      {pendingAction && pendingAction.kind !== "saveProfile" && <Confirm title={pendingAction.kind === "deactivate" ? `Deactivate ${pendingAction.partner.name}?` : pendingAction.kind === "deleteWarning" ? `Delete warning for ${pendingAction.partner.name}?` : `Confirm ${pendingAction.kind.replace(/([A-Z])/g, " $1").toLowerCase()}`} body={pendingAction.kind === "deactivate" ? "They cannot submit leads until reactivated." : pendingAction.kind === "deleteWarning" ? "This removes the warning from the partner record and will be written to the audit log." : `This will ${pendingAction.kind.replace(/([A-Z])/g, " $1").toLowerCase()} ${pendingAction.partner.name}.`} confirmLabel="Confirm" onConfirm={confirmAction} onClose={() => setPendingAction(null)} />}
      {pendingAction?.kind === "saveProfile" && <Confirm title={`Save changes to ${pendingAction.partner.name}?`} body="The updated partner profile will be saved permanently and recorded in the APN audit log." confirmLabel="Save changes" danger={false} onConfirm={confirmAction} onClose={() => setPendingAction(null)} />}
    </div>
  );
}
