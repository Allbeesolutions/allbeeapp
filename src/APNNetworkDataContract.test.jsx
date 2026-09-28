import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
const readers=fs.readFileSync('src/data/readers.js','utf8');
describe('APN Network route data contract',()=>{
 it('loads the permanent referral identity needed by My Network',()=>{
   expect(readers).toContain('network: ["apn_users","apn_referral_codes"');
 });
 it('loads the referral wallet so Network metrics do not fall back to false zeroes',()=>{
   const line=readers.split('\n').find((row)=>row.includes('network: ["apn_users"')) || '';
   expect(line).toContain('"apn_referral_wallets"');
   expect(line).toContain('"apn_referral_earnings"');
   expect(line).toContain('"apn_referral_relationships"');
 });
});
