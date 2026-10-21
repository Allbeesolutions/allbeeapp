import {describe,it,expect} from 'vitest';
import {usageStorageKeys} from './usageAnalyticsKeys';
const a='11111111-1111-4111-8111-111111111111';
const b='22222222-2222-4222-8222-222222222222';
describe('account-isolated analytics consent',()=>{
 it('never inherits consent, anonymous identifiers or dedupe marker across users',()=>{
  const ak=usageStorageKeys(a),bk=usageStorageKeys(b);
  expect(ak).not.toBeNull();expect(bk).not.toBeNull();
  for(const field of ['choice','visitor','session','lastView']){
   expect(ak[field]).not.toBe(bk[field]);
  }
 });
 it('fails closed without a trusted signed-in account id',()=>{
  for(const input of ['',undefined,'bad','../private','someone@email.com']){
   expect(usageStorageKeys(input)).toBe(null);
  }
 });
 it('keeps stable keys for the same account across case changes',()=>{
  expect(usageStorageKeys(a.toUpperCase())).toEqual(usageStorageKeys(a));
 });
});
