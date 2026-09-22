export const apnAiCategoryFor = (q) => {
  const s = String(q || "");
  if (/withdraw|settlement|payout|release/i.test(s)) return "Withdrawal";
  if (/refer|tie-up|network|link/i.test(s)) return "Referral";
  if (/commission|percent|earn|paid|ladder|tier/i.test(s)) return "Commission";
  if (/wallet|balance|money|₹|rupee/i.test(s)) return "Wallet";
  if (/project|lead|convert|revenue|collection/i.test(s)) return "Project";
  if (/rule|version|policy|cap/i.test(s)) return "Rules & Policy";
  if (/support|help|ticket|escalate/i.test(s)) return "Support";
  return "Other";
};
