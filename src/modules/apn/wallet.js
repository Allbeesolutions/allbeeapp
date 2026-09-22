export const apnWithdrawalWalletFor = (db, pid, type) => (db.apn_withdrawal_wallets || []).find((row) => row.partner_id === pid && row.wallet_type === type) || { wallet_type: type, pending: 0, approved: 0, withdrawable: 0, locked: 0, paid: 0, lifetime: 0, monthly: 0, today: 0, total_requested: 0, total_approved: 0, total_rejected: 0, total_processing: 0 };
export const apnWithdrawalTone = (status) => ({ pending: "pri", under_review: "accent", approved: "pos", processing: "accent", paid: "pos", rejected: "neg", cancelled: "neg", expired: "neg" }[status] || "");
export const apnWithdrawalLabel = (status) => String(status || "").replace(/_/g, " ").replace(/\w/g, (c) => c.toUpperCase());
const DEFAULT_WITHDRAWAL_TYPES = [["commission", "Commission"], ["referral", "Referral"], ["incentive", "Incentive"]];
export const apnWalletLabel = (type, APN_WITHDRAWAL_TYPES = DEFAULT_WITHDRAWAL_TYPES) => APN_WITHDRAWAL_TYPES.find(([key]) => key === type)?.[1] || type;
export const apnRequestAmount = (row) => Number(row.approved_amount ?? row.requested_amount) || 0;
