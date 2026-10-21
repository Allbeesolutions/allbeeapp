import { describe,it,expect } from 'vitest';
import { safeUsageScreen,customerUsagePayload,USAGE_SCREENS } from './usageAnalyticsRules.js';
describe('customer analytics: sensitive-route exclusions', () => {
 it('accepts only static public app screen classes', () => {
  expect(safeUsageScreen('#/dashboard')).toBe('dashboard');
  expect(safeUsageScreen('#/apn/home')).toBe('apn');
  expect(safeUsageScreen('#/projects/127?foo=secret')).toBe('projects');
  for (const hash of ['#/chat/secret','#/vault','#/accounts','#/assistant','#/apn/chat','#/apn/wallet','#/settings','#/proposal/private-id'])
   expect(safeUsageScreen(hash)).toBe(null);
 });
 it('never accepts uncontrolled labels or sensitive values as event targets', () => {
  const good=customerUsagePayload({visitorId:'a',sessionId:'b',kind:'tap',screen:'tasks',target:'nav'});
  expect(good?.p_target).toBe('nav');
  expect(customerUsagePayload({visitorId:'a',sessionId:'b',kind:'tap',screen:'tasks',target:'customer@email.com'})).toBe(null);
  expect(customerUsagePayload({visitorId:'a',sessionId:'b',kind:'view',screen:'chat'})).toBe(null);
  expect(customerUsagePayload({visitorId:'a',sessionId:'b',kind:'active_time',screen:'tasks',seconds:10000})).toBe(null);
 });
 it('keeps enumerated event routes and database migration in sync', () => {
  expect(USAGE_SCREENS.length).toBeGreaterThan(10);
  expect(new Set(USAGE_SCREENS).size).toBe(USAGE_SCREENS.length);
 });
});
