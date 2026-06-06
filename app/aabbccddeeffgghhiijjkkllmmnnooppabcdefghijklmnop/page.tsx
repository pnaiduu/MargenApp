'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { getSupabase } from '../../lib/supabase'
import { formatUsd } from '../../lib/formatUsd'

type Tab = 'quotes' | 'dev' | 'sales'
type RowStatus = 'accepted' | 'rejected' | null

type QuoteRow = {
  id: string
  created_at: string
  full_name: string | null
  business_name: string | null
  phone: string | null
  plan: string | null
  plan_name: string | null
  monthly_total: number | null
  rep_code: string | null
  city_state: string | null
  business_description: string | null
  existing_site_url: string | null
  timeline: string | null
  heard_from: string | null
  features: { name: string; price: number }[] | null
  selected_features: { name: string; price: number }[] | null
  anything_else: string | null
  additional_notes: string | null
}

type DevRow = {
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
}

type SalesRow = {
  id: string
  created_at: string
  full_name: string | null
  email: string | null
  age: string | null
  city_state: string | null
  has_sales_experience: boolean | null
  has_car: boolean | null
  does_cold_calls: boolean | null
  approach_description: string | null
  why_join: string | null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function yn(v: boolean | null | undefined) {
  if (v === true) return 'Yes'
  if (v === false) return 'No'
  return '-'
}

export default function AdminDashboardPage() {
  const [tab, setTab] = useState<Tab>('quotes')
  const [quotes, setQuotes] = useState<QuoteRow[]>([])
  const [devApps, setDevApps] = useState<DevRow[]>([])
  const [salesApps, setSalesApps] = useState<SalesRow[]>([])
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [statuses, setStatuses] = useState<Record<string, RowStatus>>({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const sb = getSupabase()
    if (!sb) {
      setLoading(false)
      return
    }
    const [q, d, s] = await Promise.all([
      sb.from('quotes').select('*').order('created_at', { ascending: false }),
      sb.from('dev_applications').select('*').order('created_at', { ascending: false }),
      sb.from('sales_applications').select('*').order('created_at', { ascending: false }),
    ])
    if (q.data) setQuotes(q.data as QuoteRow[])
    if (d.data) setDevApps(d.data as DevRow[])
    if (s.data) setSalesApps(s.data as SalesRow[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function setStatus(id: string, status: RowStatus) {
    setStatuses((prev) => ({ ...prev, [id]: status }))
  }

  const filteredQuotes = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return quotes
    return quotes.filter(
      (r) =>
        (r.full_name ?? '').toLowerCase().includes(q) ||
        (r.business_name ?? '').toLowerCase().includes(q),
    )
  }, [quotes, search])

  const filteredDev = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return devApps
    return devApps.filter(
      (r) =>
        (r.full_name ?? '').toLowerCase().includes(q) ||
        (r.city_state ?? '').toLowerCase().includes(q),
    )
  }, [devApps, search])

  const filteredSales = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return salesApps
    return salesApps.filter(
      (r) =>
        (r.full_name ?? '').toLowerCase().includes(q) ||
        (r.city_state ?? '').toLowerCase().includes(q),
    )
  }, [salesApps, search])

  function rowClass(id: string) {
    const s = statuses[id]
    if (s === 'accepted') return 'admin-row admin-row--accepted'
    if (s === 'rejected') return 'admin-row admin-row--rejected'
    return 'admin-row'
  }

  return (
    <div className="page admin-page">
      <div className="container">
        <header className="admin-header">
          <h1 className="admin-title">Admin Dashboard</h1>
        </header>

        <div className="admin-tabs">
          {(['quotes', 'dev', 'sales'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`admin-tab${tab === t ? ' admin-tab--active' : ''}`}
              onClick={() => { setTab(t); setSearch(''); setExpanded(null) }}
            >
              {t === 'quotes' ? 'Quote Submissions' : t === 'dev' ? 'Developer Applications' : 'Sales Applications'}
            </button>
          ))}
        </div>

        <input
          type="search"
          className="admin-search form-input"
          placeholder={tab === 'quotes' ? 'Search by name or business...' : 'Search by name or city...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {loading ? <p className="admin-loading">Loading...</p> : null}

        {tab === 'quotes' ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th><th>Name</th><th>Business</th><th>Phone</th><th>Plan</th><th>Monthly Total</th><th>Rep Code</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filteredQuotes.map((row) => {
                  const features = (row.features ?? row.selected_features ?? []) as { name: string; price: number }[]
                  const open = expanded === row.id
                  return (
                    <Fragment key={row.id}>
                      <tr key={row.id} className={rowClass(row.id)} onClick={() => setExpanded(open ? null : row.id)}>
                        <td>{formatDate(row.created_at)}</td>
                        <td>{row.full_name ?? '—'}</td>
                        <td>{row.business_name ?? '—'}</td>
                        <td>{row.phone ?? '—'}</td>
                        <td>{row.plan ?? row.plan_name ?? '—'}</td>
                        <td>{row.monthly_total != null ? `${formatUsd(row.monthly_total)}/mo` : '—'}</td>
                        <td>{row.rep_code ?? '—'}</td>
                        <td className="admin-actions" onClick={(e) => e.stopPropagation()}>
                          <button type="button" className="admin-btn admin-btn--accept" onClick={() => setStatus(row.id, 'accepted')}>Accept</button>
                          <button type="button" className="admin-btn admin-btn--reject" onClick={() => setStatus(row.id, 'rejected')}>Reject</button>
                        </td>
                      </tr>
                      {open ? (
                        <tr key={`${row.id}-detail`} className="admin-detail-row">
                          <td colSpan={8}>
                            <div className="admin-detail">
                              <p><strong>Description:</strong> {row.business_description ?? '—'}</p>
                              <p><strong>City/State:</strong> {row.city_state ?? '—'}</p>
                              <p><strong>Existing site:</strong> {row.existing_site_url ?? '—'}</p>
                              <p><strong>Timeline:</strong> {row.timeline ?? '—'}</p>
                              <p><strong>Heard from:</strong> {row.heard_from ?? '—'}</p>
                              <p><strong>Features:</strong></p>
                              <ul>{features.map((f) => <li key={f.name}>{f.name} (+{formatUsd(f.price)})</li>)}</ul>
                              <p><strong>Anything else:</strong> {row.anything_else ?? row.additional_notes ?? '—'}</p>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {tab === 'dev' ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th><th>Name</th><th>Email</th><th>Age</th><th>City</th><th>Built Before</th><th>Uses Cursor</th><th>Hours/Week</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filteredDev.map((row) => {
                  const open = expanded === row.id
                  return (
                    <Fragment key={row.id}>
                      <tr key={row.id} className={rowClass(row.id)} onClick={() => setExpanded(open ? null : row.id)}>
                        <td>{formatDate(row.created_at)}</td>
                        <td>{row.full_name ?? '—'}</td>
                        <td>{row.email ?? '—'}</td>
                        <td>{row.age ?? '—'}</td>
                        <td>{row.city_state ?? '—'}</td>
                        <td>{yn(row.built_before)}</td>
                        <td>{yn(row.uses_cursor)}</td>
                        <td>{row.hours_per_week ?? '—'}</td>
                        <td className="admin-actions" onClick={(e) => e.stopPropagation()}>
                          <button type="button" className="admin-btn admin-btn--accept" onClick={() => setStatus(row.id, 'accepted')}>Accept</button>
                          <button type="button" className="admin-btn admin-btn--reject" onClick={() => setStatus(row.id, 'rejected')}>Reject</button>
                        </td>
                      </tr>
                      {open ? (
                        <tr key={`${row.id}-detail`} className="admin-detail-row">
                          <td colSpan={9}>
                            <div className="admin-detail">
                              <p><strong>Experience:</strong> {row.experience ?? '—'}</p>
                              <p><strong>Portfolio:</strong> {row.portfolio_link ? <a href={row.portfolio_link} target="_blank" rel="noopener noreferrer">{row.portfolio_link}</a> : '—'}</p>
                              <p><strong>Why join:</strong> {row.why_join ?? '—'}</p>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {tab === 'sales' ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th><th>Name</th><th>Email</th><th>Age</th><th>City</th><th>Sales Experience</th><th>Has Car</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map((row) => {
                  const open = expanded === row.id
                  return (
                    <Fragment key={row.id}>
                      <tr key={row.id} className={rowClass(row.id)} onClick={() => setExpanded(open ? null : row.id)}>
                        <td>{formatDate(row.created_at)}</td>
                        <td>{row.full_name ?? '—'}</td>
                        <td>{row.email ?? '—'}</td>
                        <td>{row.age ?? '—'}</td>
                        <td>{row.city_state ?? '—'}</td>
                        <td>{yn(row.has_sales_experience)}</td>
                        <td>{yn(row.has_car)}</td>
                        <td className="admin-actions" onClick={(e) => e.stopPropagation()}>
                          <button type="button" className="admin-btn admin-btn--accept" onClick={() => setStatus(row.id, 'accepted')}>Accept</button>
                          <button type="button" className="admin-btn admin-btn--reject" onClick={() => setStatus(row.id, 'rejected')}>Reject</button>
                        </td>
                      </tr>
                      {open ? (
                        <tr key={`${row.id}-detail`} className="admin-detail-row">
                          <td colSpan={8}>
                            <div className="admin-detail">
                              <p><strong>Cold calls comfortable:</strong> {yn(row.does_cold_calls)}</p>
                              <p><strong>Approach:</strong> {row.approach_description ?? '—'}</p>
                              <p><strong>Why join:</strong> {row.why_join ?? '—'}</p>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  )
}
