// The production database must have the audited analytics migration before
// consent is requested or the report UI is exposed.
// Off by default; enable explicitly only after backend access and RLS are verified.
export const customerAnalyticsEnabled = (flag = import.meta.env.VITE_CUSTOMER_ANALYTICS_ENABLED) =>
  flag === "true";
