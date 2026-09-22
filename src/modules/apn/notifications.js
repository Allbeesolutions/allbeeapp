export function apnNotifVisible(n, meRow) {
  const a = n.audience || "all";
  if (a === "all") return true;
  if (a.startsWith("partner:")) return a.slice(8) === meRow?.id;
  if (a.startsWith("district:")) return a.slice(9) === meRow?.district;
  return true;
}
export const apnActionPending = (value, APN_ACTION_PENDING_STATUSES) => APN_ACTION_PENDING_STATUSES.has(String(value || "").trim().toLowerCase());
export const apnActionRowTime = (row) => {
  const value = row?.updatedAt ?? row?.createdAt ?? row?.updated_at ?? row?.created_at ?? row?.requested_at ?? row?.linked_at ?? row?.issuedAt ?? row?.uploadedAt;
  const text = String(value || "");
  const time = typeof value === "number" || /^\d{10,}$/.test(text) ? Number(value) : Date.parse(text);
  return Number.isFinite(time) ? time : 0;
};
export const apnActionReadTime = (db, viewerId, actionType) => {
  const row = (db.apn_action_badge_reads || []).find((item) => item.user_id === viewerId && item.action_type === actionType);
  const time = row?.seen_at ? Date.parse(row.seen_at) : 0;
  return Number.isFinite(time) ? time : 0;
};
export const apnUnseenActionCount = (rows, predicate, readAt) => (rows || []).filter((row) => predicate(row) && apnActionRowTime(row) > readAt).length;
export function apnAdminActionCounts(db, viewerId, APN_ACTION_PENDING_STATUSES, APN_ACTION_BADGE_MAP) {
  const pending = (value) => apnActionPending(value, APN_ACTION_PENDING_STATUSES);
  const read = (type) => apnActionReadTime(db, viewerId, type);
  const unseen = (rows, predicate, at) => apnUnseenActionCount(rows, predicate, at);
  const counts = {
    partner_pending: unseen(db.apn_users, (row) => row.status === "pending", read("partner_pending")),
    commission_pending: unseen([...(db.apn_revenue_collections || []), ...(db.apn_commissions || [])], (row) => pending(row.commissionStatus || row.status), read("commission_pending")),
    withdrawal_pending: unseen([...(db.apn_withdrawal_requests || []), ...(db.apn_withdrawal_batches || [])], (row) => pending(row.status), read("withdrawal_pending")),
    referral_pending: unseen(db.apn_referral_earnings, (row) => row.status === "pending", read("referral_pending")),
    target_action: unseen(db.apn_targets, (row) => row.acknowledged === false, read("target_action")),
    training_action: unseen([...(db.apn_training || []), ...(db.apn_quizzes || [])], (row) => pending(row.status || row.approvalStatus), read("training_action")),
    material_action: unseen(db.apn_documents, (row) => row.published === false || pending(row.status || row.approvalStatus || row.publishStatus), read("material_action")),
    notification_unread: unseen(db.apn_notifications, () => true, read("notification_unread")),
  };
  const result = Object.fromEntries(APN_ACTION_BADGE_MAP.map(({ actionType, tab }) => [tab, counts[actionType] || 0]));
  return { ...counts, ...result, training: counts.training_action, materials: counts.material_action, notify: counts.notification_unread, total: Object.values(counts).reduce((sum, value) => sum + value, 0) };
}
