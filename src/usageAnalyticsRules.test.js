import { describe,it,expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { safeUsageScreen,customerUsagePayload,USAGE_SCREENS,privacySignalEnabled } from './usageAnalyticsRules.js';
describe('customer analytics: sensitive-route exclusions', () => {
 it('honors Do Not Track and Global Privacy Control before collecting',()=>{
  expect(privacySignalEnabled({doNotTrack:'1'})).toBe(true);
  expect(privacySignalEnabled({doNotTrack:'0',globalPrivacyControl:true})).toBe(true);
  expect(privacySignalEnabled({doNotTrack:'0',globalPrivacyControl:false})).toBe(false);
  expect(privacySignalEnabled(null)).toBe(false);
 });
 it('accepts only static public app screen classes', () => {
  expect(safeUsageScreen('#/dashboard')).toBe('dashboard');
  expect(safeUsageScreen('#/apn/home')).toBe('apn_home');
  expect(safeUsageScreen('#/apn/leads')).toBe('apn_leads');
  expect(safeUsageScreen('#/apn/leaderboard')).toBe('apn_leaderboard');
  expect(safeUsageScreen('#/client/home')).toBe('client_home');
  expect(safeUsageScreen('#/client/chat')).toBe(null);
  expect(safeUsageScreen('#/client/ai')).toBe(null);
  expect(safeUsageScreen('#/client/profile')).toBe(null);
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
  const migration=readFileSync('supabase/migrations/20261021221500_customer_usage_analytics.sql','utf8');
  for(const screen of USAGE_SCREENS) expect(migration).toContain("'" + screen + "'");
 });
});
