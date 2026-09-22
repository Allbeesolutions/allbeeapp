export const apnSnapshotWallet = (snap) => (snap?.wallet && typeof snap.wallet === "object" ? snap.wallet : null);
export const apnSnapshotRate = (snap, completed) => {
  const ladder = (snap?.ruleKnowledge?.ladder || []).filter((r) => r.commissionType === "partner");
  if (!ladder.length) return null;
  const rule = ladder.find((r) => completed >= Number(r.tierMin) && completed <= (Number(r.tierMax) || Infinity)) || ladder[ladder.length - 1];
  return rule && Number.isFinite(Number(rule.percent)) ? Number(rule.percent) : null;
};
