/** Account-scoped consent and IDs. Never inherit another user's decision on a shared browser. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function usageStorageKeys(uid){
 if(typeof uid!=='string'||!UUID.test(uid))return null;
 const account=uid.toLowerCase();
 return {
  choice:`allbee-customer-usage-consent-v2:${account}`,
  visitor:`allbee-usage-visitor-v2:${account}`,
  session:`allbee-usage-session-v2:${account}`,
  lastView:`allbee-usage-last-view-v2:${account}`,
 };
}
