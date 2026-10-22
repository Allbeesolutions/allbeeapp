import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import {fillCustomerDays,verifiedCustomerUsageReport} from './customerAnalyticsFormatting';

/** All responses are server-aggregated and guarded by public.is_admin(). */
export default function CustomerUsageAnalytics() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    setBusy(true); setError('');
    try {
      const { data: report, error: failure } = await supabase.rpc('app_customer_usage_report');
      if (failure) throw failure;
      setData(verifiedCustomerUsageReport(report));
    } catch (err) { setData(null); setError(err?.message || 'Admin analytics unavailable'); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const daily = data ? fillCustomerDays(data.daily || []) : [];
  const maxVisits = Math.max(1, ...daily.map(d => d.visits));
  const fields = [
    ['Visits · 24 hours', 'visits24h'], ['Visits · 7 days', 'visits7d'],
    ['Unique signed-in users · 7 days', 'visitors7d'],
    ['Returning users · 7 days', 'returningUsers7d'],
    ['Page views · 7 days', 'views7d'], ['Navigation taps · 7 days', 'taps7d'],
    ['Active minutes · 7 days', 'activeMinutes7d'],
  ];
  return <section className="card" aria-label="Customer usage analytics">
    <div className="item-row">
      <div className="item-main">
        <div className="item-title">Opted-in customer activity</div>
        <div className="item-meta">Signed-in users' daily sessions, screen views and coarse navigation actions. No chat, finance, searches or form content.</div>
      </div>
      <button className="btn sm" type="button" onClick={() => void refresh()} disabled={busy}>{busy ? 'Refreshing…' : 'Refresh'}</button>
    </div>
    {error && <div role="alert" className="auth-msg err">{error}. A database migration or admin permission may still require approval.</div>}
    {data && <>
      <div className="ai-health-grid">
        {fields.map(([label,key]) => <div className="card stat" key={key}>
          <div className="lbl">{label}</div><div className="num mono">{Number(data[key] || 0).toLocaleString('en-IN')}</div>
        </div>)}
      </div>
      <div className="cards-grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,320px),1fr))',gap:14}}>
        <div className="card">
          <h4>Daily visits · past 30 days</h4>
          <div role="img" aria-label="Daily opt-in visits across 30 days" style={{display:'flex',height:115,alignItems:'flex-end',gap:3,padding:'8px 0'}}>
           {daily.map(x=><div key={x.day} title={`${x.day}: ${x.visits} visits`}
            style={{flex:'1 1 0',minWidth:2,height:`${Math.max(2,100*x.visits/maxVisits)}%`,
              background:'var(--primary, #60768c)',borderRadius:'3px 3px 0 0'}}/>)}
          </div>
          <div style={{overflowX:'auto'}}><table className="tbl"><thead><tr><th>Date</th><th>Visits</th><th>Users</th><th>Page views</th></tr></thead>
            <tbody>{[...daily].reverse().map(d => <tr key={d.day}><td>{d.day}</td><td>{d.visits}</td><td>{d.users}</td><td>{d.views}</td></tr>)}</tbody></table></div>
          {!data.daily?.length && <p className="hint-line">No consented visits recorded yet.</p>}
        </div>
        <div className="card">
          <h4>Most visited screens · 7 days</h4>
          {(data.screens || []).map(s => <div className="item-row" key={s.screen}><span>{s.screen}</span><b>{Number(s.views || 0).toLocaleString('en-IN')}</b></div>)}
          {!data.screens?.length && <p className="hint-line">No screen views recorded yet.</p>}
        </div>
        <div className="card">
          <h4>Signed-in user frequency · 7 days</h4>
          <div style={{overflowX:'auto'}}><table className="tbl"><thead><tr><th>User reference</th><th>Visits</th><th>Active days</th></tr></thead>
            <tbody>{(data.users || []).map(u => <tr key={u.actor}><td className="mono">{u.actor}…</td><td>{u.visits}</td><td>{u.days_active}</td></tr>)}</tbody></table></div>
          {!data.users?.length && <p className="hint-line">No signed-in, opted-in activity recorded yet.</p>}
        </div>
      </div>
      <p className="hint-line">Counts reflect consented devices/sessions and are not exact counts of people. Only privileged admins can request aggregates. Withdrawals stop future events; scheduled retention cleanup awaits a reviewed production setup.</p>
    </>}
    {!error && !data && busy && <p className="hint-line">Reading protected usage report…</p>}
  </section>;
}
