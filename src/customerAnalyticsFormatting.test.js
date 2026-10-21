import {describe,it,expect} from 'vitest';
import {fillCustomerDays} from './customerAnalyticsFormatting';
describe('customer usage reporting',()=>{
 it('fills exactly the past 30 days with calendar continuity',()=>{
  const rows=fillCustomerDays([{day:'2026-10-21',visits:4,users:2,views:11}],new Date('2026-10-22T12:00:00Z'),3);
  expect(rows).toEqual([
   {day:'2026-10-20',visits:0,users:0,views:0},
   {day:'2026-10-21',visits:4,users:2,views:11},
   {day:'2026-10-22',visits:0,users:0,views:0},
  ]);
 });
 it('rejects invalid report spans instead of inventing data',()=>{
  expect(()=>fillCustomerDays([],new Date('bad'))).toThrow();
  expect(()=>fillCustomerDays([],new Date(),1000)).toThrow();
 });
});
