'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getSupabase } from '../../lib/supabase'
import { formatUsd } from '../../lib/formatUsd'
import { generateRepCode } from '../../lib/repCode'

type Tab = 'quotes' | 'devApps' | 'salesApps' | 'devTeam' | 'salesTeam'
type RowStatus = 'accepted' | 'rejected' | null

type QuoteFeature = { name: string; price: number }

type QuoteRow = {
  id: string
  created_at: string
  full_name: string | null
  business_name: string | null
  email: string | null
  phone: string | null
  city_state: string | null
  business_description: string | null
  has_existing_site: boolean | null
  existing_site_url: string | null
  has_logo: boolean | null
  has_photos: boolean | null
  timeline: string | null
  heard_from: string | null
  rep_code: string | null
  plan: string | null
  plan_price: number | null
  monthly_total: number | null
  selected_features: QuoteFeature[] | null
  not_selected_features: QuoteFeature[] | null
  features: QuoteFeature[] | null
  anything_else: string | null
}

type DevAppRow = {
  id: string
  created_at: string
  full_name: string | null
  email: string | null
  age: string | null
  city_state: string | null
  built_before: boolean | null
  uses_cursor: boolean | null
  hours_per_week: string | null
  experience: string | null
  portfolio_link: string | null
  why_join: string | null
  commission_ok: boolean | null
}

type SalesAppRow = {
  id: string
  created_at: string
  full_name: string | null
  email: string | null
  age: string | null
  city_state: string | null
  has_sales_experience: boolean | null
  does_cold_calls: boolean | null
  approach_description: string | null
  has_car: boolean | null
  why_join: string | null
  commission_ok: boolean | null
}

type TeamMember = {
  id: string
  created_at: string
  full_name: string | null
  email: string | null
  phone: string | null
  role: 'developer' | 'salesperson'
  rep_code: string | null
  status: 'active' | 'inactive' | null
  notes: string | null
}

type Assignment = {
  id: string
  created_at: string
  developer_id: string | null
  quote_id: string | null
  client_name: string | null
  monthly_amount: number | null
  status: string | null
}

type Commission = {
  id: string
  created_at: string
  team_member_id: string | null
  client_name: string | null
  quote_id: string | null
  amount: number | null
  month: string | null
  paid: boolean | null
  paid_at: string | null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function yn(v: boolean | null | undefined) {
  if (v === true) return 'Yes'
  if (v === false) return 'No'
  return '-'
}

function statusLabel(s: RowStatus) {
  if (s === 'accepted') return 'Accepted'
  if (s === 'rejected') return 'Rejected'
  return 'Pending'
}

export default function AdminDashboardPage() {
  const [tab, setTab] = useState<Tab>('quotes')
  const [quotes, setQuotes] = useState<QuoteRow[]>([])
  const [devApps, setDevApps] = useState<DevAppRow[]>([])
  const [salesApps, setSalesApps] = useState<SalesAppRow[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [statuses, setStatuses] = useState<Record<string, RowStatus>>({})
  const [loading, setLoading] = useState(true)

  const [addTeamOpen, setAddTeamOpen] = useState<'developer' | 'salesperson' | null>(null)
  const [addTeamForm, setAddTeamForm] = useState({ fullName: '', email: '', phone: '', repCode: '', notes: '' })
  const [addToTeamApp, setAddToTeamApp] = useState<{ type: 'dev' | 'sales'; id: string; phone: string; repCode: string } | null>(null)
  const [assignDevId, setAssignDevId] = useState('')

  const load = useCallback(async () => {
    const sb = getSupabase()
    if (!sb) { setLoading(false); return }
    const [q, d, s, t, a, c] = await Promise.all([
      sb.from('quotes').select('*').order('created_at', { ascending: false }),
      sb.from('dev_applications').select('*').order('created_at', { ascending: false }),
      sb.from('sales_applications').select('*').order('created_at', { ascending: false }),
      sb.from('team_members').select('*').order('created_at', { ascending: false }),
      sb.from('client_assignments').select('*').order('created_at', { ascending: false }),
      sb.from('commissions').select('*').order('created_at', { ascending: false }),
    ])
    if (q.data) setQuotes(q.data as QuoteRow[])
    if (d.data) setDevApps(d.data as DevAppRow[])
    if (s.data) setSalesApps(s.data as SalesAppRow[])
    if (t.data) setTeam(t.data as TeamMember[])
    if (a.data) setAssignments(a.data as Assignment[])
    if (c.data) setCommissions(c.data as Commission[])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const developers = useMemo(() => team.filter((m) => m.role === 'developer'), [team])
  const salespeople = useMemo(() => team.filter((m) => m.role === 'salesperson'), [team])

  const quoteStats = useMemo(() => {
    const now = new Date()
    const monthQuotes = quotes.filter((q) => {
      const d = new Date(q.created_at)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    return {
      count: monthQuotes.length,
      mrr: monthQuotes.reduce((s, q) => s + (q.monthly_total ?? 0), 0),
    }
  }, [quotes])

  const filteredQuotes = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return quotes
    return quotes.filter((r) =>
      (r.full_name ?? '').toLowerCase().includes(q) ||
      (r.business_name ?? '').toLowerCase().includes(q),
    )
  }, [quotes, search])

  const filteredDevApps = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return devApps
    return devApps.filter((r) =>
      (r.full_name ?? '').toLowerCase().includes(q) ||
      (r.city_state ?? '').toLowerCase().includes(q),
    )
  }, [devApps, search])

  const filteredSalesApps = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return salesApps
    return salesApps.filter((r) =>
      (r.full_name ?? '').toLowerCase().includes(q) ||
      (r.city_state ?? '').toLowerCase().includes(q),
    )
  }, [salesApps, search])

  const selectedQuote = quotes.find((q) => q.id === selectedId && tab === 'quotes')
  const selectedDevApp = devApps.find((d) => d.id === selectedId && tab === 'devApps')
  const selectedSalesApp = salesApps.find((s) => s.id === selectedId && tab === 'salesApps')

  function setStatus(id: string, status: RowStatus) {
    setStatuses((prev) => ({ ...prev, [id]: status }))
  }

  async function assignDeveloper(quote: QuoteRow, developerId: string) {
    const sb = getSupabase()
    if (!sb || !developerId) return
    await sb.from('client_assignments').insert({
      developer_id: developerId,
      quote_id: quote.id,
      client_name: quote.business_name || quote.full_name,
      monthly_amount: quote.monthly_total,
      status: 'active',
    })
    setAssignDevId('')
    void load()
  }

  async function saveTeamMember(role: 'developer' | 'salesperson', data: { fullName: string; email: string; phone: string; repCode: string; notes: string }) {
    const sb = getSupabase()
    if (!sb) return
    await sb.from('team_members').insert({
      full_name: data.fullName,
      email: data.email,
      phone: data.phone,
      role,
      rep_code: data.repCode,
      notes: data.notes || null,
      status: 'active',
    })
    setAddTeamOpen(null)
    setAddTeamForm({ fullName: '', email: '', phone: '', repCode: '', notes: '' })
    setAddToTeamApp(null)
    void load()
  }

  async function addAppToTeam(app: DevAppRow | SalesAppRow, role: 'developer' | 'salesperson', phone: string, repCode: string) {
    await saveTeamMember(role, {
      fullName: app.full_name ?? '',
      email: app.email ?? '',
      phone,
      repCode,
      notes: '',
    })
  }

  async function updateMemberStatus(id: string, status: 'active' | 'inactive') {
    const sb = getSupabase()
    if (!sb) return
    await sb.from('team_members').update({ status }).eq('id', id)
    void load()
  }

  async function updateMemberNotes(id: string, notes: string) {
    const sb = getSupabase()
    if (!sb) return
    await sb.from('team_members').update({ notes }).eq('id', id)
    void load()
  }

  async function markCommissionPaid(id: string) {
    const sb = getSupabase()
    if (!sb) return
    await sb.from('commissions').update({ paid: true, paid_at: new Date().toISOString() }).eq('id', id)
    void load()
  }

  function panelStatusClass(id: string) {
    const s = statuses[id]
    if (s === 'accepted') return 'admin-panel admin-panel--accepted'
    if (s === 'rejected') return 'admin-panel admin-panel--rejected'
    return 'admin-panel'
  }

  function rowClass(id: string) {
    const s = statuses[id]
    if (s === 'accepted') return 'admin-row admin-row--accepted'
    if (s === 'rejected') return 'admin-row admin-row--rejected'
    return 'admin-row'
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'quotes', label: 'Quotes' },
    { id: 'devApps', label: 'Developers' },
    { id: 'salesApps', label: 'Sales Reps' },
    { id: 'devTeam', label: 'Dev Team' },
    { id: 'salesTeam', label: 'Sales Team' },
  ]

  return (
    <div className="page admin-page">
      <div className="container admin-layout">
        <header className="admin-header">
          <img src="/margen-logo.png" alt="Margen" className="admin-logo" height={48} />
          <h1 className="admin-title">Margen Admin</h1>
        </header>

        <div className="admin-tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`admin-tab${tab === t.id ? ' admin-tab--active' : ''}`}
              onClick={() => { setTab(t.id); setSearch(''); setSelectedId(null) }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'quotes' ? (
          <div className="admin-stats">
            <div className="admin-stat-card"><span>This month</span><strong>{quoteStats.count} submissions</strong></div>
            <div className="admin-stat-card"><span>Total MRR quoted</span><strong>{formatUsd(quoteStats.mrr)}/mo</strong></div>
          </div>
        ) : null}

        {tab !== 'devTeam' && tab !== 'salesTeam' ? (
          <input
            type="search"
            className="admin-search form-input"
            placeholder={tab === 'quotes' ? 'Search by name or business...' : 'Search by name or city...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        ) : null}

        {loading ? <p className="admin-loading">Loading...</p> : null}

        <div className="admin-body">
          {tab === 'quotes' ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Date</th><th>Name</th><th>Business</th><th>City</th><th>Phone</th><th>Plan</th><th>Monthly Total</th><th>Rep Code</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuotes.map((row) => (
                    <tr key={row.id} className={rowClass(row.id)} onClick={() => setSelectedId(row.id)}>
                      <td>{formatDate(row.created_at)}</td>
                      <td>{row.full_name ?? '-'}</td>
                      <td>{row.business_name ?? '-'}</td>
                      <td>{row.city_state ?? '-'}</td>
                      <td>{row.phone ?? '-'}</td>
                      <td>{row.plan ?? '-'}</td>
                      <td>{row.monthly_total != null ? `${formatUsd(row.monthly_total)}/mo` : '-'}</td>
                      <td>{row.rep_code ?? '-'}</td>
                      <td>{statusLabel(statuses[row.id])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {tab === 'devApps' ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Date</th><th>Name</th><th>Email</th><th>Age</th><th>City</th><th>Built Before</th><th>Uses Cursor</th><th>Hours/Week</th></tr>
                </thead>
                <tbody>
                  {filteredDevApps.map((row) => (
                    <tr key={row.id} className={rowClass(row.id)} onClick={() => setSelectedId(row.id)}>
                      <td>{formatDate(row.created_at)}</td>
                      <td>{row.full_name ?? '-'}</td>
                      <td>{row.email ?? '-'}</td>
                      <td>{row.age ?? '-'}</td>
                      <td>{row.city_state ?? '-'}</td>
                      <td>{yn(row.built_before)}</td>
                      <td>{yn(row.uses_cursor)}</td>
                      <td>{row.hours_per_week ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {tab === 'salesApps' ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Date</th><th>Name</th><th>Email</th><th>Age</th><th>City</th><th>Sales Experience</th><th>Has Car</th></tr>
                </thead>
                <tbody>
                  {filteredSalesApps.map((row) => (
                    <tr key={row.id} className={rowClass(row.id)} onClick={() => setSelectedId(row.id)}>
                      <td>{formatDate(row.created_at)}</td>
                      <td>{row.full_name ?? '-'}</td>
                      <td>{row.email ?? '-'}</td>
                      <td>{row.age ?? '-'}</td>
                      <td>{row.city_state ?? '-'}</td>
                      <td>{yn(row.has_sales_experience)}</td>
                      <td>{yn(row.has_car)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {tab === 'devTeam' ? (
            <div className="admin-team-section">
              <button type="button" className="btn btn--accent" onClick={() => {
                setAddTeamOpen('developer')
                setAddTeamForm({ fullName: '', email: '', phone: '', repCode: generateRepCode('DEV'), notes: '' })
              }}>Add developer manually</button>
              {addTeamOpen === 'developer' ? (
                <form className="admin-inline-form" onSubmit={(e) => { e.preventDefault(); void saveTeamMember('developer', { fullName: addTeamForm.fullName, email: addTeamForm.email, phone: addTeamForm.phone, repCode: addTeamForm.repCode, notes: addTeamForm.notes }) }}>
                  <input className="form-input" placeholder="Full name" value={addTeamForm.fullName} onChange={(e) => setAddTeamForm((f) => ({ ...f, fullName: e.target.value }))} required />
                  <input className="form-input" placeholder="Email" value={addTeamForm.email} onChange={(e) => setAddTeamForm((f) => ({ ...f, email: e.target.value }))} required />
                  <input className="form-input" placeholder="Phone" value={addTeamForm.phone} onChange={(e) => setAddTeamForm((f) => ({ ...f, phone: e.target.value }))} required />
                  <input className="form-input" placeholder="Rep code" value={addTeamForm.repCode} onChange={(e) => setAddTeamForm((f) => ({ ...f, repCode: e.target.value }))} required />
                  <input className="form-input" placeholder="Notes" value={addTeamForm.notes} onChange={(e) => setAddTeamForm((f) => ({ ...f, notes: e.target.value }))} />
                  <button type="submit" className="btn btn--accent">Save</button>
                </form>
              ) : null}
              {developers.map((dev) => {
                const devAssignments = assignments.filter((a) => a.developer_id === dev.id)
                const commission = devAssignments.filter((a) => a.status === 'active').reduce((s, a) => s + (Number(a.monthly_amount) || 0) * 0.1, 0)
                return (
                  <div key={dev.id} className="admin-team-card">
                    <div className="admin-team-card-head">
                      <div>
                        <h3>{dev.full_name}</h3>
                        <p>{dev.email} · {dev.phone}</p>
                        <p className="admin-rep-code">Rep: {dev.rep_code}</p>
                      </div>
                      <div className="admin-team-card-actions">
                        <label className="admin-status-toggle">
                          <input type="checkbox" checked={dev.status === 'active'} onChange={(e) => void updateMemberStatus(dev.id, e.target.checked ? 'active' : 'inactive')} />
                          Active
                        </label>
                        <button type="button" className="admin-btn admin-btn--reject" onClick={() => void updateMemberStatus(dev.id, 'inactive')}>Remove</button>
                      </div>
                    </div>
                    <textarea className="form-input form-textarea" rows={2} placeholder="Notes" defaultValue={dev.notes ?? ''} onBlur={(e) => void updateMemberNotes(dev.id, e.target.value)} />
                    <p className="admin-commission-total">Monthly commission: {formatUsd(Math.round(commission))}/mo</p>
                    <div className="admin-assignment-list">
                      {devAssignments.map((a) => (
                        <div key={a.id} className="admin-assignment-item">
                          <span>{a.client_name}</span>
                          <span>{a.monthly_amount != null ? `${formatUsd(Number(a.monthly_amount))}/mo` : '-'}</span>
                          <span>{a.status}</span>
                          <span>{formatDate(a.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}

          {tab === 'salesTeam' ? (
            <div className="admin-team-section">
              <button type="button" className="btn btn--accent" onClick={() => {
                setAddTeamOpen('salesperson')
                setAddTeamForm({ fullName: '', email: '', phone: '', repCode: generateRepCode('SAL'), notes: '' })
              }}>Add salesperson manually</button>
              {addTeamOpen === 'salesperson' ? (
                <form className="admin-inline-form" onSubmit={(e) => { e.preventDefault(); void saveTeamMember('salesperson', { fullName: addTeamForm.fullName, email: addTeamForm.email, phone: addTeamForm.phone, repCode: addTeamForm.repCode, notes: addTeamForm.notes }) }}>
                  <input className="form-input" placeholder="Full name" value={addTeamForm.fullName} onChange={(e) => setAddTeamForm((f) => ({ ...f, fullName: e.target.value }))} required />
                  <input className="form-input" placeholder="Email" value={addTeamForm.email} onChange={(e) => setAddTeamForm((f) => ({ ...f, email: e.target.value }))} required />
                  <input className="form-input" placeholder="Phone" value={addTeamForm.phone} onChange={(e) => setAddTeamForm((f) => ({ ...f, phone: e.target.value }))} required />
                  <input className="form-input" placeholder="Rep code" value={addTeamForm.repCode} onChange={(e) => setAddTeamForm((f) => ({ ...f, repCode: e.target.value }))} required />
                  <input className="form-input" placeholder="Notes" value={addTeamForm.notes} onChange={(e) => setAddTeamForm((f) => ({ ...f, notes: e.target.value }))} />
                  <button type="submit" className="btn btn--accent">Save</button>
                </form>
              ) : null}
              {salespeople.map((sp) => {
                const spCommissions = commissions.filter((c) => c.team_member_id === sp.id)
                const totalEarned = spCommissions.reduce((s, c) => s + (Number(c.amount) || 0), 0)
                const totalUnpaid = spCommissions.filter((c) => !c.paid).reduce((s, c) => s + (Number(c.amount) || 0), 0)
                return (
                  <div key={sp.id} className="admin-team-card">
                    <div className="admin-team-card-head">
                      <div>
                        <h3>{sp.full_name}</h3>
                        <p>{sp.email} · {sp.phone}</p>
                        <p className="admin-rep-code">Rep: {sp.rep_code}</p>
                      </div>
                      <div className="admin-team-card-actions">
                        <label className="admin-status-toggle">
                          <input type="checkbox" checked={sp.status === 'active'} onChange={(e) => void updateMemberStatus(sp.id, e.target.checked ? 'active' : 'inactive')} />
                          Active
                        </label>
                        <button type="button" className="admin-btn admin-btn--reject" onClick={() => void updateMemberStatus(sp.id, 'inactive')}>Remove</button>
                      </div>
                    </div>
                    <textarea className="form-input form-textarea" rows={2} placeholder="Notes" defaultValue={sp.notes ?? ''} onBlur={(e) => void updateMemberNotes(sp.id, e.target.value)} />
                    <p className="admin-commission-total">Total earned: {formatUsd(totalEarned)} · Unpaid: {formatUsd(totalUnpaid)}</p>
                    <div className="admin-commission-list">
                      {spCommissions.map((c) => (
                        <label key={c.id} className={`admin-commission-item${c.paid ? ' admin-commission-item--paid' : ' admin-commission-item--unpaid'}`}>
                          <input type="checkbox" checked={Boolean(c.paid)} onChange={() => { if (!c.paid) void markCommissionPaid(c.id) }} />
                          <span>{c.client_name}</span>
                          <span>{c.amount != null ? formatUsd(Number(c.amount)) : '-'}</span>
                          <span>{c.month}</span>
                          <span>{c.paid ? 'Paid' : 'Unpaid'}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}

          {selectedQuote ? (
            <aside className={panelStatusClass(selectedQuote.id)}>
              <button type="button" className="admin-panel-close" onClick={() => setSelectedId(null)}>Close</button>
              <h2>{selectedQuote.business_name}</h2>
              <p className="admin-panel-sub">{selectedQuote.full_name}</p>
              <div className="admin-panel-section">
                <h3>Client info</h3>
                <p>Email: {selectedQuote.email ?? '-'}</p>
                <p>Phone: {selectedQuote.phone ?? '-'}</p>
                <p>City: {selectedQuote.city_state ?? '-'}</p>
                <p>Description: {selectedQuote.business_description ?? '-'}</p>
                <p>Existing site: {selectedQuote.existing_site_url ?? (selectedQuote.has_existing_site ? 'Yes (no URL)' : 'No')}</p>
                <p>Has logo: {yn(selectedQuote.has_logo)}</p>
                <p>Has photos: {yn(selectedQuote.has_photos)}</p>
                <p>Timeline: {selectedQuote.timeline ?? '-'}</p>
                <p>Heard from: {selectedQuote.heard_from ?? '-'}</p>
                <p>Rep code: {selectedQuote.rep_code ?? '-'}</p>
              </div>
              <div className="admin-panel-section">
                <h3>Selected features</h3>
                <ul className="admin-feature-list admin-feature-list--selected">
                  {(selectedQuote.selected_features ?? selectedQuote.features ?? []).map((f) => (
                    <li key={f.name}>{f.name} (+{formatUsd(f.price)})</li>
                  ))}
                </ul>
              </div>
              <div className="admin-panel-section">
                <h3>Not selected</h3>
                <ul className="admin-feature-list admin-feature-list--unselected">
                  {(selectedQuote.not_selected_features ?? []).map((f) => (
                    <li key={f.name}>{f.name} (+{formatUsd(f.price)})</li>
                  ))}
                </ul>
              </div>
              <div className="admin-panel-section">
                <h3>Anything else</h3>
                <p>{selectedQuote.anything_else ?? '-'}</p>
              </div>
              <div className="admin-panel-section">
                <h3>Monthly total</h3>
                <p>Base plan ({selectedQuote.plan}): {selectedQuote.plan_price != null ? formatUsd(selectedQuote.plan_price) : '-'}/mo</p>
                {(selectedQuote.selected_features ?? selectedQuote.features ?? []).map((f) => (
                  <p key={f.name}>+ {f.name}: {formatUsd(f.price)}</p>
                ))}
                <p><strong>Total: {selectedQuote.monthly_total != null ? `${formatUsd(selectedQuote.monthly_total)}/mo` : '-'}</strong></p>
              </div>
              <div className="admin-panel-actions">
                <button type="button" className="admin-btn admin-btn--accept" onClick={() => setStatus(selectedQuote.id, 'accepted')}>Accept</button>
                <button type="button" className="admin-btn admin-btn--reject" onClick={() => setStatus(selectedQuote.id, 'rejected')}>Reject</button>
              </div>
              <div className="admin-panel-section">
                <h3>Assign developer</h3>
                <select className="form-input" value={assignDevId} onChange={(e) => setAssignDevId(e.target.value)}>
                  <option value="">Select developer...</option>
                  {developers.filter((d) => d.status === 'active').map((d) => (
                    <option key={d.id} value={d.id}>{d.full_name} ({d.rep_code})</option>
                  ))}
                </select>
                <button type="button" className="btn btn--accent admin-assign-btn" disabled={!assignDevId} onClick={() => void assignDeveloper(selectedQuote, assignDevId)}>Assign</button>
              </div>
            </aside>
          ) : null}

          {selectedDevApp ? (
            <aside className={panelStatusClass(selectedDevApp.id)}>
              <button type="button" className="admin-panel-close" onClick={() => setSelectedId(null)}>Close</button>
              <h2>{selectedDevApp.full_name}</h2>
              <p>Email: {selectedDevApp.email}</p>
              <p>Age: {selectedDevApp.age}</p>
              <p>City: {selectedDevApp.city_state}</p>
              <p>Built before: {yn(selectedDevApp.built_before)}</p>
              <p>Uses Cursor: {yn(selectedDevApp.uses_cursor)}</p>
              <p>Hours/week: {selectedDevApp.hours_per_week}</p>
              <p>Experience: {selectedDevApp.experience}</p>
              <p>Portfolio: {selectedDevApp.portfolio_link ? <a href={selectedDevApp.portfolio_link} target="_blank" rel="noopener noreferrer">{selectedDevApp.portfolio_link}</a> : '-'}</p>
              <p>Why join: {selectedDevApp.why_join}</p>
              <p>Commission OK: {yn(selectedDevApp.commission_ok)}</p>
              <div className="admin-panel-actions">
                <button type="button" className="admin-btn admin-btn--accept" onClick={() => setStatus(selectedDevApp.id, 'accepted')}>Accept</button>
                <button type="button" className="admin-btn admin-btn--reject" onClick={() => setStatus(selectedDevApp.id, 'rejected')}>Reject</button>
              </div>
              {addToTeamApp?.type === 'dev' && addToTeamApp.id === selectedDevApp.id ? (
                <form className="admin-inline-form" onSubmit={(e) => { e.preventDefault(); void addAppToTeam(selectedDevApp, 'developer', addToTeamApp.phone, addToTeamApp.repCode) }}>
                  <input className="form-input" placeholder="Phone" value={addToTeamApp.phone} onChange={(e) => setAddToTeamApp((a) => a ? { ...a, phone: e.target.value } : a)} required />
                  <input className="form-input" placeholder="Rep code" value={addToTeamApp.repCode} onChange={(e) => setAddToTeamApp((a) => a ? { ...a, repCode: e.target.value } : a)} required />
                  <button type="submit" className="btn btn--accent">Confirm add to team</button>
                </form>
              ) : (
                <button type="button" className="btn btn--accent" onClick={() => setAddToTeamApp({ type: 'dev', id: selectedDevApp.id, phone: '', repCode: generateRepCode('DEV') })}>Add to team</button>
              )}
            </aside>
          ) : null}

          {selectedSalesApp ? (
            <aside className={panelStatusClass(selectedSalesApp.id)}>
              <button type="button" className="admin-panel-close" onClick={() => setSelectedId(null)}>Close</button>
              <h2>{selectedSalesApp.full_name}</h2>
              <p>Email: {selectedSalesApp.email}</p>
              <p>Age: {selectedSalesApp.age}</p>
              <p>City: {selectedSalesApp.city_state}</p>
              <p>Sales experience: {yn(selectedSalesApp.has_sales_experience)}</p>
              <p>Cold calls OK: {yn(selectedSalesApp.does_cold_calls)}</p>
              <p>Has car: {yn(selectedSalesApp.has_car)}</p>
              <p>Approach: {selectedSalesApp.approach_description}</p>
              <p>Why join: {selectedSalesApp.why_join}</p>
              <p>Commission OK: {yn(selectedSalesApp.commission_ok)}</p>
              <div className="admin-panel-actions">
                <button type="button" className="admin-btn admin-btn--accept" onClick={() => setStatus(selectedSalesApp.id, 'accepted')}>Accept</button>
                <button type="button" className="admin-btn admin-btn--reject" onClick={() => setStatus(selectedSalesApp.id, 'rejected')}>Reject</button>
              </div>
              {addToTeamApp?.type === 'sales' && addToTeamApp.id === selectedSalesApp.id ? (
                <form className="admin-inline-form" onSubmit={(e) => { e.preventDefault(); void addAppToTeam(selectedSalesApp, 'salesperson', addToTeamApp.phone, addToTeamApp.repCode) }}>
                  <input className="form-input" placeholder="Phone" value={addToTeamApp.phone} onChange={(e) => setAddToTeamApp((a) => a ? { ...a, phone: e.target.value } : a)} required />
                  <input className="form-input" placeholder="Rep code" value={addToTeamApp.repCode} onChange={(e) => setAddToTeamApp((a) => a ? { ...a, repCode: e.target.value } : a)} required />
                  <button type="submit" className="btn btn--accent">Confirm add to team</button>
                </form>
              ) : (
                <button type="button" className="btn btn--accent" onClick={() => setAddToTeamApp({ type: 'sales', id: selectedSalesApp.id, phone: '', repCode: generateRepCode('SAL') })}>Add to team</button>
              )}
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  )
}
