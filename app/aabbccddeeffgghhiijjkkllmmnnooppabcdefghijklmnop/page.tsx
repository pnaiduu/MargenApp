'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { getSupabase } from '../../lib/supabase'
import { formatUsd } from '../../lib/formatUsd'
import { generateRepCode } from '../../lib/repCode'

type Tab = 'quotes' | 'devApps' | 'salesApps' | 'devTeam' | 'salesTeam'
type AppStatus = 'pending' | 'accepted' | 'rejected'
type QuoteStatus =
  | 'new'
  | 'reviewed'
  | 'accepted'
  | 'dev_assigned'
  | 'site_live'
  | 'active_client'
  | 'rejected'
type CommissionStatus = 'pending' | 'earned' | 'paid_out'

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
  status: QuoteStatus | null
  notes: string | null
  assigned_developer_id: string | null
  assigned_developer_name: string | null
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
  status: 'active' | 'inactive' | 'completed' | null
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
  commission_status: CommissionStatus | null
}

const QUOTE_STATUSES: QuoteStatus[] = [
  'new',
  'reviewed',
  'accepted',
  'dev_assigned',
  'site_live',
  'active_client',
  'rejected',
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function yn(v: boolean | null | undefined) {
  if (v === true) return 'Yes'
  if (v === false) return 'No'
  return '-'
}

function appStatusLabel(s: AppStatus) {
  if (s === 'accepted') return 'Accepted'
  if (s === 'rejected') return 'Rejected'
  return 'Pending'
}

function quoteStatusLabel(s: QuoteStatus | null | undefined) {
  if (!s) return 'New'
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function quoteStatusClass(s: QuoteStatus | null | undefined) {
  const status = s ?? 'new'
  return `admin-badge admin-badge--quote-${status}`
}

function selectedFeatures(quote: QuoteRow) {
  return quote.selected_features ?? quote.features ?? []
}

function addonsSubtotal(quote: QuoteRow) {
  return selectedFeatures(quote).reduce((sum, f) => sum + f.price, 0)
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
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [appStatuses, setAppStatuses] = useState<Record<string, AppStatus>>({})
  const [loading, setLoading] = useState(true)
  const [teamAddSuccess, setTeamAddSuccess] = useState<string | null>(null)

  const [addTeamOpen, setAddTeamOpen] = useState<'developer' | 'salesperson' | null>(null)
  const [addTeamForm, setAddTeamForm] = useState({ fullName: '', email: '', phone: '', repCode: '', notes: '' })

  const [addToTeamApp, setAddToTeamApp] = useState<{
    type: 'dev' | 'sales'
    id: string
    phone: string
    repCode: string
    notes: string
  } | null>(null)

  const [addDevCommissionFor, setAddDevCommissionFor] = useState<string | null>(null)
  const [devCommissionForm, setDevCommissionForm] = useState({ clientName: '', amount: '', month: '' })

  const [addSalesCommissionFor, setAddSalesCommissionFor] = useState<string | null>(null)
  const [salesCommissionForm, setSalesCommissionForm] = useState({
    clientName: '',
    amount: '',
    month: '',
    status: 'pending' as CommissionStatus,
  })

  const load = useCallback(async () => {
    const sb = getSupabase()
    if (!sb) {
      setLoading(false)
      return
    }
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

  useEffect(() => {
    void load()
  }, [load])

  const developers = useMemo(() => team.filter((m) => m.role === 'developer'), [team])
  const salespeople = useMemo(() => team.filter((m) => m.role === 'salesperson'), [team])
  const activeDevelopers = useMemo(() => developers.filter((d) => d.status === 'active'), [developers])

  const quoteStats = useMemo(() => {
    const now = new Date()
    const acceptedThisMonth = quotes.filter((q) => {
      const d = new Date(q.created_at)
      return (q.status ?? 'new') === 'accepted' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    const accepted = quotes.filter((q) => (q.status ?? 'new') === 'accepted')
    return {
      total: quotes.length,
      acceptedThisMonth: acceptedThisMonth.length,
      acceptedMrr: accepted.reduce((s, q) => s + (q.monthly_total ?? 0), 0),
      pipelineValue: quotes.reduce((s, q) => s + (q.monthly_total ?? 0), 0),
    }
  }, [quotes])

  const devAppStats = useMemo(() => {
    const pending = devApps.filter((a) => (appStatuses[a.id] ?? 'pending') === 'pending').length
    return { total: devApps.length, pending }
  }, [devApps, appStatuses])

  const salesAppStats = useMemo(() => {
    const pending = salesApps.filter((a) => (appStatuses[a.id] ?? 'pending') === 'pending').length
    return { total: salesApps.length, pending }
  }, [salesApps, appStatuses])

  const filteredQuotes = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return quotes
    return quotes.filter(
      (r) =>
        (r.full_name ?? '').toLowerCase().includes(q) ||
        (r.business_name ?? '').toLowerCase().includes(q) ||
        (r.rep_code ?? '').toLowerCase().includes(q),
    )
  }, [quotes, search])

  const filteredDevApps = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return devApps
    return devApps.filter(
      (r) => (r.full_name ?? '').toLowerCase().includes(q) || (r.city_state ?? '').toLowerCase().includes(q),
    )
  }, [devApps, search])

  const filteredSalesApps = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return salesApps
    return salesApps.filter(
      (r) => (r.full_name ?? '').toLowerCase().includes(q) || (r.city_state ?? '').toLowerCase().includes(q),
    )
  }, [salesApps, search])

  function toggleExpanded(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
    setAddToTeamApp(null)
    setTeamAddSuccess(null)
  }

  function setAppStatus(id: string, status: AppStatus) {
    setAppStatuses((prev) => ({ ...prev, [id]: status }))
  }

  function appRowClass(id: string) {
    const s = appStatuses[id] ?? 'pending'
    if (s === 'accepted') return 'admin-row admin-row--accepted'
    if (s === 'rejected') return 'admin-row admin-row--rejected'
    return 'admin-row'
  }

  function appPanelClass(id: string) {
    const s = appStatuses[id] ?? 'pending'
    if (s === 'accepted') return 'admin-expand-panel admin-expand-panel--accepted'
    if (s === 'rejected') return 'admin-expand-panel admin-expand-panel--rejected'
    return 'admin-expand-panel'
  }

  async function updateQuote(id: string, patch: Partial<QuoteRow>) {
    const sb = getSupabase()
    if (!sb) return
    await sb.from('quotes').update(patch).eq('id', id)
    setQuotes((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)))
  }

  async function saveQuoteNotes(id: string, notes: string) {
    await updateQuote(id, { notes })
  }

  async function saveQuoteStatus(id: string, status: QuoteStatus) {
    await updateQuote(id, { status })
  }

  async function assignDeveloper(quote: QuoteRow, developerId: string) {
    const sb = getSupabase()
    if (!sb || !developerId) return
    const dev = activeDevelopers.find((d) => d.id === developerId)
    if (!dev) return

    await sb.from('quotes').update({
      assigned_developer_id: developerId,
      assigned_developer_name: dev.full_name,
      status: 'dev_assigned',
    }).eq('id', quote.id)

    await sb.from('client_assignments').insert({
      developer_id: developerId,
      quote_id: quote.id,
      client_name: quote.business_name || quote.full_name,
      monthly_amount: quote.monthly_total,
      status: 'active',
    })

    setQuotes((prev) =>
      prev.map((q) =>
        q.id === quote.id
          ? {
              ...q,
              assigned_developer_id: developerId,
              assigned_developer_name: dev.full_name,
              status: 'dev_assigned',
            }
          : q,
      ),
    )
    void load()
  }

  async function saveTeamMember(
    role: 'developer' | 'salesperson',
    data: { fullName: string; email: string; phone: string; repCode: string; notes: string },
  ) {
    const sb = getSupabase()
    if (!sb) return
    const { error } = await sb.from('team_members').insert({
      full_name: data.fullName,
      email: data.email,
      phone: data.phone,
      role,
      rep_code: data.repCode,
      notes: data.notes || null,
      status: 'active',
    })
    if (error) return
    const label = role === 'developer' ? 'dev team' : 'sales team'
    setTeamAddSuccess(`Added to ${label}. Rep code: ${data.repCode}`)
    setAddTeamOpen(null)
    setAddTeamForm({ fullName: '', email: '', phone: '', repCode: '', notes: '' })
    setAddToTeamApp(null)
    void load()
  }

  async function addAppToTeam(
    app: DevAppRow | SalesAppRow,
    role: 'developer' | 'salesperson',
    phone: string,
    repCode: string,
    notes: string,
  ) {
    await saveTeamMember(role, {
      fullName: app.full_name ?? '',
      email: app.email ?? '',
      phone,
      repCode,
      notes,
    })
  }

  async function updateMemberStatus(id: string, status: 'active' | 'inactive') {
    const sb = getSupabase()
    if (!sb) return
    await sb.from('team_members').update({ status }).eq('id', id)
    setTeam((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)))
  }

  async function updateMemberNotes(id: string, notes: string) {
    const sb = getSupabase()
    if (!sb) return
    await sb.from('team_members').update({ notes }).eq('id', id)
    setTeam((prev) => prev.map((m) => (m.id === id ? { ...m, notes } : m)))
  }

  async function updateAssignmentStatus(id: string, status: 'active' | 'inactive' | 'completed') {
    const sb = getSupabase()
    if (!sb) return
    await sb.from('client_assignments').update({ status }).eq('id', id)
    setAssignments((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)))
  }

  async function markCommissionPaid(id: string) {
    const sb = getSupabase()
    if (!sb) return
    const paidAt = new Date().toISOString()
    await sb.from('commissions').update({ paid: true, paid_at: paidAt }).eq('id', id)
    setCommissions((prev) => prev.map((c) => (c.id === id ? { ...c, paid: true, paid_at: paidAt } : c)))
  }

  async function updateCommissionStatus(id: string, commission_status: CommissionStatus) {
    const sb = getSupabase()
    if (!sb) return
    await sb.from('commissions').update({ commission_status }).eq('id', id)
    setCommissions((prev) => prev.map((c) => (c.id === id ? { ...c, commission_status } : c)))
  }

  async function addCommission(
    teamMemberId: string,
    data: { clientName: string; amount: string; month: string; commissionStatus?: CommissionStatus },
  ) {
    const sb = getSupabase()
    if (!sb) return
    await sb.from('commissions').insert({
      team_member_id: teamMemberId,
      client_name: data.clientName,
      amount: Number(data.amount),
      month: data.month,
      commission_status: data.commissionStatus ?? 'pending',
      paid: false,
    })
    setAddDevCommissionFor(null)
    setAddSalesCommissionFor(null)
    setDevCommissionForm({ clientName: '', amount: '', month: '' })
    setSalesCommissionForm({ clientName: '', amount: '', month: '', status: 'pending' })
    void load()
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'quotes', label: 'Quotes' },
    { id: 'devApps', label: 'Dev Applications' },
    { id: 'salesApps', label: 'Sales Applications' },
    { id: 'devTeam', label: 'Dev Team' },
    { id: 'salesTeam', label: 'Sales Team' },
  ]

  function renderQuoteDetail(row: QuoteRow) {
    const selected = selectedFeatures(row)
    const notSelected = row.not_selected_features ?? []
    const addons = addonsSubtotal(row)

    return (
      <div className="admin-expand-panel">
        <div className="admin-panel-section">
          <h3>Client info</h3>
          <p>Name: {row.full_name ?? '-'}</p>
          <p>Business: {row.business_name ?? '-'}</p>
          <p>Email: {row.email ?? '-'}</p>
          <p>Phone: {row.phone ?? '-'}</p>
          <p>City / State: {row.city_state ?? '-'}</p>
          <p>Description: {row.business_description ?? '-'}</p>
          <p>Existing site: {row.has_existing_site ? row.existing_site_url || 'Yes (no URL)' : 'No'}</p>
          <p>Has logo: {yn(row.has_logo)}</p>
          <p>Has photos: {yn(row.has_photos)}</p>
          <p>Timeline: {row.timeline ?? '-'}</p>
          <p>Heard from: {row.heard_from ?? '-'}</p>
          <p>Rep code: {row.rep_code ?? '-'}</p>
        </div>

        <div className="admin-panel-section">
          <h3>Selected features</h3>
          <ul className="admin-feature-list admin-feature-list--selected">
            {selected.map((f) => (
              <li key={f.name}>
                {f.name} ({formatUsd(f.price)})
              </li>
            ))}
          </ul>
          <ul className="admin-feature-list admin-feature-list--unselected">
            {notSelected.map((f) => (
              <li key={f.name}>
                {f.name} ({formatUsd(f.price)})
              </li>
            ))}
          </ul>
          <p>Base plan price: {row.plan_price != null ? `${formatUsd(row.plan_price)}/mo` : '-'}</p>
          <p>Add-ons subtotal: {formatUsd(addons)}/mo</p>
          <p>
            <strong>Monthly total: {row.monthly_total != null ? `${formatUsd(row.monthly_total)}/mo` : '-'}</strong>
          </p>
        </div>

        <div className="admin-panel-section">
          <h3>Notes</h3>
          <textarea
            className="form-input form-textarea"
            rows={4}
            placeholder="Internal notes..."
            defaultValue={row.notes ?? ''}
            onBlur={(e) => void saveQuoteNotes(row.id, e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        <div className="admin-panel-section">
          <h3>Actions</h3>
          <label className="admin-field-label">
            Status
            <select
              className="form-input"
              value={row.status ?? 'new'}
              onChange={(e) => void saveQuoteStatus(row.id, e.target.value as QuoteStatus)}
              onClick={(e) => e.stopPropagation()}
            >
              {QUOTE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {quoteStatusLabel(s)}
                </option>
              ))}
            </select>
          </label>

          {row.assigned_developer_name ? (
            <div className="admin-assigned-dev">
              <p>
                Assigned: <strong>{row.assigned_developer_name}</strong>
              </p>
              <label className="admin-field-label">
                Reassign developer
                <select
                  className="form-input"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) void assignDeveloper(row, e.target.value)
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value="">Select developer...</option>
                  {activeDevelopers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name} ({d.rep_code})
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : (
            <label className="admin-field-label">
              Assign developer
              <select
                className="form-input"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) void assignDeveloper(row, e.target.value)
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <option value="">Select developer...</option>
                {activeDevelopers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.full_name} ({d.rep_code})
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>
    )
  }

  function renderDevAppDetail(row: DevAppRow) {
    return (
      <div className={appPanelClass(row.id)}>
        <div className="admin-panel-section admin-panel-section--first">
          <p>Full name: {row.full_name ?? '-'}</p>
          <p>Email: {row.email ?? '-'}</p>
          <p>Age: {row.age ?? '-'}</p>
          <p>City / State: {row.city_state ?? '-'}</p>
          <p>Experience: {row.experience ?? '-'}</p>
          <p>Built before: {yn(row.built_before)}</p>
          <p>
            Portfolio:{' '}
            {row.portfolio_link ? (
              <a href={row.portfolio_link} target="_blank" rel="noopener noreferrer">
                {row.portfolio_link}
              </a>
            ) : (
              '-'
            )}
          </p>
          <p>Uses Cursor: {yn(row.uses_cursor)}</p>
          <p>Hours per week: {row.hours_per_week ?? '-'}</p>
          <p>Why join: {row.why_join ?? '-'}</p>
          <p>Commission OK: {yn(row.commission_ok)}</p>
        </div>
        <div className="admin-panel-actions" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="admin-btn admin-btn--accept-solid" onClick={() => setAppStatus(row.id, 'accepted')}>
            Accept
          </button>
          <button type="button" className="admin-btn admin-btn--reject-solid" onClick={() => setAppStatus(row.id, 'rejected')}>
            Reject
          </button>
          <button
            type="button"
            className="btn btn--accent btn--sm"
            onClick={() =>
              setAddToTeamApp({ type: 'dev', id: row.id, phone: '', repCode: generateRepCode('DEV'), notes: '' })
            }
          >
            Add to dev team
          </button>
        </div>
        {addToTeamApp?.type === 'dev' && addToTeamApp.id === row.id ? (
          <form
            className="admin-inline-form"
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
              void addAppToTeam(row, 'developer', addToTeamApp.phone, addToTeamApp.repCode, addToTeamApp.notes)
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              className="form-input"
              placeholder="Phone number"
              value={addToTeamApp.phone}
              onChange={(e) => setAddToTeamApp((a) => (a ? { ...a, phone: e.target.value } : a))}
              required
            />
            <input
              className="form-input"
              placeholder="Rep code"
              value={addToTeamApp.repCode}
              onChange={(e) => setAddToTeamApp((a) => (a ? { ...a, repCode: e.target.value } : a))}
              required
            />
            <input
              className="form-input"
              placeholder="Notes"
              value={addToTeamApp.notes}
              onChange={(e) => setAddToTeamApp((a) => (a ? { ...a, notes: e.target.value } : a))}
            />
            <button type="submit" className="btn btn--accent">
              Add to team
            </button>
          </form>
        ) : null}
        {teamAddSuccess && addToTeamApp?.id === row.id ? <p className="admin-success">{teamAddSuccess}</p> : null}
      </div>
    )
  }

  function renderSalesAppDetail(row: SalesAppRow) {
    return (
      <div className={appPanelClass(row.id)}>
        <div className="admin-panel-section admin-panel-section--first">
          <p>Full name: {row.full_name ?? '-'}</p>
          <p>Email: {row.email ?? '-'}</p>
          <p>Age: {row.age ?? '-'}</p>
          <p>City / State: {row.city_state ?? '-'}</p>
          <p>Has sales experience: {yn(row.has_sales_experience)}</p>
          <p>Does cold calls: {yn(row.does_cold_calls)}</p>
          <p>Approach: {row.approach_description ?? '-'}</p>
          <p>Has car: {yn(row.has_car)}</p>
          <p>Why join: {row.why_join ?? '-'}</p>
          <p>Commission OK: {yn(row.commission_ok)}</p>
        </div>
        <div className="admin-panel-actions" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="admin-btn admin-btn--accept-solid" onClick={() => setAppStatus(row.id, 'accepted')}>
            Accept
          </button>
          <button type="button" className="admin-btn admin-btn--reject-solid" onClick={() => setAppStatus(row.id, 'rejected')}>
            Reject
          </button>
          <button
            type="button"
            className="btn btn--accent btn--sm"
            onClick={() =>
              setAddToTeamApp({ type: 'sales', id: row.id, phone: '', repCode: generateRepCode('SAL'), notes: '' })
            }
          >
            Add to sales team
          </button>
        </div>
        {addToTeamApp?.type === 'sales' && addToTeamApp.id === row.id ? (
          <form
            className="admin-inline-form"
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
              void addAppToTeam(row, 'salesperson', addToTeamApp.phone, addToTeamApp.repCode, addToTeamApp.notes)
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              className="form-input"
              placeholder="Phone number"
              value={addToTeamApp.phone}
              onChange={(e) => setAddToTeamApp((a) => (a ? { ...a, phone: e.target.value } : a))}
              required
            />
            <input
              className="form-input"
              placeholder="Rep code"
              value={addToTeamApp.repCode}
              onChange={(e) => setAddToTeamApp((a) => (a ? { ...a, repCode: e.target.value } : a))}
              required
            />
            <input
              className="form-input"
              placeholder="Notes"
              value={addToTeamApp.notes}
              onChange={(e) => setAddToTeamApp((a) => (a ? { ...a, notes: e.target.value } : a))}
            />
            <button type="submit" className="btn btn--accent">
              Add to team
            </button>
          </form>
        ) : null}
        {teamAddSuccess && addToTeamApp?.id === row.id ? <p className="admin-success">{teamAddSuccess}</p> : null}
      </div>
    )
  }

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
              onClick={() => {
                setTab(t.id)
                setSearch('')
                setExpandedId(null)
                setAddToTeamApp(null)
                setTeamAddSuccess(null)
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'quotes' ? (
          <div className="admin-stats">
            <div className="admin-stat-card">
              <span>Total submissions</span>
              <strong>{quoteStats.total}</strong>
            </div>
            <div className="admin-stat-card">
              <span>Accepted this month</span>
              <strong>{quoteStats.acceptedThisMonth}</strong>
            </div>
            <div className="admin-stat-card">
              <span>Accepted MRR</span>
              <strong>{formatUsd(quoteStats.acceptedMrr)}/mo</strong>
            </div>
            <div className="admin-stat-card">
              <span>Pipeline value</span>
              <strong>{formatUsd(quoteStats.pipelineValue)}/mo</strong>
            </div>
          </div>
        ) : null}

        {tab === 'devApps' ? (
          <div className="admin-stats">
            <div className="admin-stat-card">
              <span>Total applications</span>
              <strong>{devAppStats.total}</strong>
            </div>
            <div className="admin-stat-card">
              <span>Pending review</span>
              <strong>{devAppStats.pending}</strong>
            </div>
          </div>
        ) : null}

        {tab === 'salesApps' ? (
          <div className="admin-stats">
            <div className="admin-stat-card">
              <span>Total applications</span>
              <strong>{salesAppStats.total}</strong>
            </div>
            <div className="admin-stat-card">
              <span>Pending review</span>
              <strong>{salesAppStats.pending}</strong>
            </div>
          </div>
        ) : null}

        {tab !== 'devTeam' && tab !== 'salesTeam' ? (
          <input
            type="search"
            className="admin-search form-input"
            placeholder={
              tab === 'quotes' ? 'Search by name, business, or rep code...' : 'Search by name or city...'
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        ) : null}

        {loading ? <p className="admin-loading">Loading...</p> : null}

        {tab === 'quotes' ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Name</th>
                  <th>Business</th>
                  <th>City</th>
                  <th>Phone</th>
                  <th>Plan</th>
                  <th>Monthly Total</th>
                  <th>Rep Code</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuotes.map((row) => (
                  <Fragment key={row.id}>
                    <tr className="admin-row" onClick={() => toggleExpanded(row.id)}>
                      <td>{formatDate(row.created_at)}</td>
                      <td>{row.full_name ?? '-'}</td>
                      <td>{row.business_name ?? '-'}</td>
                      <td>{row.city_state ?? '-'}</td>
                      <td>{row.phone ?? '-'}</td>
                      <td>{row.plan ?? '-'}</td>
                      <td>{row.monthly_total != null ? `${formatUsd(row.monthly_total)}/mo` : '-'}</td>
                      <td>{row.rep_code ?? '-'}</td>
                      <td>
                        <span className={quoteStatusClass(row.status)}>{quoteStatusLabel(row.status)}</span>
                      </td>
                    </tr>
                    {expandedId === row.id ? (
                      <tr className="admin-detail-row">
                        <td colSpan={9}>{renderQuoteDetail(row)}</td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {tab === 'devApps' ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Age</th>
                  <th>City</th>
                  <th>Built Before</th>
                  <th>Uses Cursor</th>
                  <th>Hours/Week</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredDevApps.map((row) => (
                  <Fragment key={row.id}>
                    <tr className={appRowClass(row.id)} onClick={() => toggleExpanded(row.id)}>
                      <td>{formatDate(row.created_at)}</td>
                      <td>{row.full_name ?? '-'}</td>
                      <td>{row.email ?? '-'}</td>
                      <td>{row.age ?? '-'}</td>
                      <td>{row.city_state ?? '-'}</td>
                      <td>{yn(row.built_before)}</td>
                      <td>{yn(row.uses_cursor)}</td>
                      <td>{row.hours_per_week ?? '-'}</td>
                      <td>{appStatusLabel(appStatuses[row.id] ?? 'pending')}</td>
                    </tr>
                    {expandedId === row.id ? (
                      <tr className="admin-detail-row">
                        <td colSpan={9}>{renderDevAppDetail(row)}</td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {tab === 'salesApps' ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Age</th>
                  <th>City</th>
                  <th>Sales Experience</th>
                  <th>Has Car</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredSalesApps.map((row) => (
                  <Fragment key={row.id}>
                    <tr className={appRowClass(row.id)} onClick={() => toggleExpanded(row.id)}>
                      <td>{formatDate(row.created_at)}</td>
                      <td>{row.full_name ?? '-'}</td>
                      <td>{row.email ?? '-'}</td>
                      <td>{row.age ?? '-'}</td>
                      <td>{row.city_state ?? '-'}</td>
                      <td>{yn(row.has_sales_experience)}</td>
                      <td>{yn(row.has_car)}</td>
                      <td>{appStatusLabel(appStatuses[row.id] ?? 'pending')}</td>
                    </tr>
                    {expandedId === row.id ? (
                      <tr className="admin-detail-row">
                        <td colSpan={8}>{renderSalesAppDetail(row)}</td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {tab === 'devTeam' ? (
          <div className="admin-team-section">
            <button
              type="button"
              className="btn btn--accent"
              onClick={() => {
                setAddTeamOpen('developer')
                setAddTeamForm({ fullName: '', email: '', phone: '', repCode: generateRepCode('DEV'), notes: '' })
                setTeamAddSuccess(null)
              }}
            >
              Add developer manually
            </button>
            {addTeamOpen === 'developer' ? (
              <form
                className="admin-inline-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  void saveTeamMember('developer', addTeamForm)
                }}
              >
                <input
                  className="form-input"
                  placeholder="Full name"
                  value={addTeamForm.fullName}
                  onChange={(e) => setAddTeamForm((f) => ({ ...f, fullName: e.target.value }))}
                  required
                />
                <input
                  className="form-input"
                  placeholder="Email"
                  value={addTeamForm.email}
                  onChange={(e) => setAddTeamForm((f) => ({ ...f, email: e.target.value }))}
                  required
                />
                <input
                  className="form-input"
                  placeholder="Phone"
                  value={addTeamForm.phone}
                  onChange={(e) => setAddTeamForm((f) => ({ ...f, phone: e.target.value }))}
                  required
                />
                <input
                  className="form-input"
                  placeholder="Rep code"
                  value={addTeamForm.repCode}
                  onChange={(e) => setAddTeamForm((f) => ({ ...f, repCode: e.target.value }))}
                  required
                />
                <input
                  className="form-input"
                  placeholder="Notes"
                  value={addTeamForm.notes}
                  onChange={(e) => setAddTeamForm((f) => ({ ...f, notes: e.target.value }))}
                />
                <button type="submit" className="btn btn--accent">
                  Save
                </button>
              </form>
            ) : null}
            {teamAddSuccess && tab === 'devTeam' && !addToTeamApp ? (
              <p className="admin-success">{teamAddSuccess}</p>
            ) : null}

            {developers.map((dev) => {
              const devAssignments = assignments.filter((a) => a.developer_id === dev.id)
              const activeAssignments = devAssignments.filter((a) => a.status === 'active')
              const monthlyCommission = activeAssignments.reduce(
                (s, a) => s + (Number(a.monthly_amount) || 0) * 0.1,
                0,
              )
              const devCommissions = commissions.filter((c) => c.team_member_id === dev.id)
              const totalEverEarned = devCommissions.filter((c) => c.paid).reduce((s, c) => s + (Number(c.amount) || 0), 0)

              return (
                <div key={dev.id} className="admin-team-card">
                  <div className="admin-team-card-head">
                    <div>
                      <h3>{dev.full_name}</h3>
                      <p>
                        {dev.email} · {dev.phone}
                      </p>
                      <span className="admin-rep-badge">{dev.rep_code}</span>
                      <span className={`admin-badge admin-badge--member-${dev.status ?? 'inactive'}`}>
                        {dev.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="admin-team-card-actions">
                      <button
                        type="button"
                        className="admin-btn"
                        onClick={() =>
                          void updateMemberStatus(dev.id, dev.status === 'active' ? 'inactive' : 'active')
                        }
                      >
                        {dev.status === 'active' ? 'Mark inactive' : 'Mark active'}
                      </button>
                      <button type="button" className="admin-btn admin-btn--reject" onClick={() => void updateMemberStatus(dev.id, 'inactive')}>
                        Remove
                      </button>
                    </div>
                  </div>
                  <textarea
                    className="form-input form-textarea"
                    rows={2}
                    placeholder="Notes"
                    defaultValue={dev.notes ?? ''}
                    onBlur={(e) => void updateMemberNotes(dev.id, e.target.value)}
                  />

                  <div className="admin-subsection">
                    <h4>Client assignments</h4>
                    {devAssignments.length === 0 ? (
                      <p className="admin-muted">No assignments yet.</p>
                    ) : (
                      devAssignments.map((a) => (
                        <div key={a.id} className="admin-assignment-item">
                          <span>{a.client_name}</span>
                          <span>{a.monthly_amount != null ? `${formatUsd(Number(a.monthly_amount))}/mo` : '-'}</span>
                          <span className={`admin-badge admin-badge--assignment-${a.status ?? 'inactive'}`}>
                            {a.status ?? 'inactive'}
                          </span>
                          <span>{formatDate(a.created_at)}</span>
                          <select
                            className="form-input form-input--compact"
                            value={a.status ?? 'active'}
                            onChange={(e) =>
                              void updateAssignmentStatus(a.id, e.target.value as 'active' | 'inactive' | 'completed')
                            }
                          >
                            <option value="active">Active</option>
                            <option value="completed">Completed</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="admin-summary-row">
                    <span>Active clients: {activeAssignments.length}</span>
                    <span>Monthly commission: {formatUsd(Math.round(monthlyCommission))}/mo</span>
                    <span>Total ever earned: {formatUsd(totalEverEarned)}</span>
                  </div>

                  <div className="admin-subsection">
                    <h4>Commission payouts</h4>
                    {devCommissions.map((c) => (
                      <label
                        key={c.id}
                        className={`admin-commission-item${c.paid ? ' admin-commission-item--paid' : ' admin-commission-item--unpaid'}`}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(c.paid)}
                          disabled={Boolean(c.paid)}
                          onChange={() => {
                            if (!c.paid) void markCommissionPaid(c.id)
                          }}
                        />
                        <span>{c.month ?? '-'}</span>
                        <span>{c.amount != null ? formatUsd(Number(c.amount)) : '-'}</span>
                        <span>{c.paid ? 'Paid' : 'Unpaid'}</span>
                      </label>
                    ))}
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => setAddDevCommissionFor(dev.id)}
                    >
                      Add commission record manually
                    </button>
                    {addDevCommissionFor === dev.id ? (
                      <form
                        className="admin-inline-form"
                        onSubmit={(e) => {
                          e.preventDefault()
                          void addCommission(dev.id, devCommissionForm)
                        }}
                      >
                        <input
                          className="form-input"
                          placeholder="Client name"
                          value={devCommissionForm.clientName}
                          onChange={(e) => setDevCommissionForm((f) => ({ ...f, clientName: e.target.value }))}
                          required
                        />
                        <input
                          className="form-input"
                          placeholder="Amount"
                          type="number"
                          value={devCommissionForm.amount}
                          onChange={(e) => setDevCommissionForm((f) => ({ ...f, amount: e.target.value }))}
                          required
                        />
                        <input
                          className="form-input"
                          placeholder="Month (e.g. June 2026)"
                          value={devCommissionForm.month}
                          onChange={(e) => setDevCommissionForm((f) => ({ ...f, month: e.target.value }))}
                          required
                        />
                        <button type="submit" className="btn btn--accent">
                          Save commission
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        ) : null}

        {tab === 'salesTeam' ? (
          <div className="admin-team-section">
            <button
              type="button"
              className="btn btn--accent"
              onClick={() => {
                setAddTeamOpen('salesperson')
                setAddTeamForm({ fullName: '', email: '', phone: '', repCode: generateRepCode('SAL'), notes: '' })
                setTeamAddSuccess(null)
              }}
            >
              Add salesperson manually
            </button>
            {addTeamOpen === 'salesperson' ? (
              <form
                className="admin-inline-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  void saveTeamMember('salesperson', addTeamForm)
                }}
              >
                <input
                  className="form-input"
                  placeholder="Full name"
                  value={addTeamForm.fullName}
                  onChange={(e) => setAddTeamForm((f) => ({ ...f, fullName: e.target.value }))}
                  required
                />
                <input
                  className="form-input"
                  placeholder="Email"
                  value={addTeamForm.email}
                  onChange={(e) => setAddTeamForm((f) => ({ ...f, email: e.target.value }))}
                  required
                />
                <input
                  className="form-input"
                  placeholder="Phone"
                  value={addTeamForm.phone}
                  onChange={(e) => setAddTeamForm((f) => ({ ...f, phone: e.target.value }))}
                  required
                />
                <input
                  className="form-input"
                  placeholder="Rep code"
                  value={addTeamForm.repCode}
                  onChange={(e) => setAddTeamForm((f) => ({ ...f, repCode: e.target.value }))}
                  required
                />
                <input
                  className="form-input"
                  placeholder="Notes"
                  value={addTeamForm.notes}
                  onChange={(e) => setAddTeamForm((f) => ({ ...f, notes: e.target.value }))}
                />
                <button type="submit" className="btn btn--accent">
                  Save
                </button>
              </form>
            ) : null}
            {teamAddSuccess && tab === 'salesTeam' && !addToTeamApp ? (
              <p className="admin-success">{teamAddSuccess}</p>
            ) : null}

            {salespeople.map((sp) => {
              const spCommissions = commissions.filter((c) => c.team_member_id === sp.id)
              const repQuotes = quotes.filter(
                (q) => sp.rep_code && q.rep_code && q.rep_code.toLowerCase() === sp.rep_code.toLowerCase(),
              )
              const pendingTotal = spCommissions
                .filter((c) => (c.commission_status ?? 'pending') === 'pending')
                .reduce((s, c) => s + (Number(c.amount) || 0), 0)
              const earnedTotal = spCommissions
                .filter((c) => c.commission_status === 'earned')
                .reduce((s, c) => s + (Number(c.amount) || 0), 0)
              const paidOutTotal = spCommissions
                .filter((c) => c.commission_status === 'paid_out')
                .reduce((s, c) => s + (Number(c.amount) || 0), 0)

              return (
                <div key={sp.id} className="admin-team-card">
                  <div className="admin-team-card-head">
                    <div>
                      <h3>{sp.full_name}</h3>
                      <p>
                        {sp.email} · {sp.phone}
                      </p>
                      <span className="admin-rep-badge">{sp.rep_code}</span>
                      <span className={`admin-badge admin-badge--member-${sp.status ?? 'inactive'}`}>
                        {sp.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="admin-team-card-actions">
                      <button
                        type="button"
                        className="admin-btn"
                        onClick={() =>
                          void updateMemberStatus(sp.id, sp.status === 'active' ? 'inactive' : 'active')
                        }
                      >
                        {sp.status === 'active' ? 'Mark inactive' : 'Mark active'}
                      </button>
                      <button type="button" className="admin-btn admin-btn--reject" onClick={() => void updateMemberStatus(sp.id, 'inactive')}>
                        Remove
                      </button>
                    </div>
                  </div>
                  <textarea
                    className="form-input form-textarea"
                    rows={2}
                    placeholder="Notes"
                    defaultValue={sp.notes ?? ''}
                    onBlur={(e) => void updateMemberNotes(sp.id, e.target.value)}
                  />

                  <div className="admin-subsection">
                    <h4>Rep code activity</h4>
                    {repQuotes.length === 0 ? (
                      <p className="admin-muted">No quotes submitted with this rep code yet.</p>
                    ) : (
                      repQuotes.map((q) => (
                        <div key={q.id} className="admin-rep-quote-row">
                          <span>{q.full_name ?? q.business_name}</span>
                          <span>{q.business_name}</span>
                          <span>{formatDate(q.created_at)}</span>
                          <span>{q.monthly_total != null ? `${formatUsd(q.monthly_total)}/mo` : '-'}</span>
                          <span className={quoteStatusClass(q.status)}>{quoteStatusLabel(q.status)}</span>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="admin-subsection">
                    <h4>Commissions</h4>
                    {spCommissions.map((c) => (
                      <div
                        key={c.id}
                        className={`admin-sales-commission-row admin-sales-commission-row--${c.commission_status ?? 'pending'}`}
                      >
                        <span>{c.client_name}</span>
                        <span>{c.amount != null ? formatUsd(Number(c.amount)) : '-'}</span>
                        <span>{formatDate(c.created_at)}</span>
                        <select
                          className="form-input form-input--compact"
                          value={c.commission_status ?? 'pending'}
                          onChange={(e) => void updateCommissionStatus(c.id, e.target.value as CommissionStatus)}
                        >
                          <option value="pending">Pending</option>
                          <option value="earned">Earned</option>
                          <option value="paid_out">Paid Out</option>
                        </select>
                      </div>
                    ))}
                    <div className="admin-summary-row">
                      <span>Pending: {formatUsd(pendingTotal)}</span>
                      <span>Earned (not paid out): {formatUsd(earnedTotal)}</span>
                      <span>Paid out (all time): {formatUsd(paidOutTotal)}</span>
                    </div>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => setAddSalesCommissionFor(sp.id)}
                    >
                      Add commission manually
                    </button>
                    {addSalesCommissionFor === sp.id ? (
                      <form
                        className="admin-inline-form"
                        onSubmit={(e) => {
                          e.preventDefault()
                          void addCommission(sp.id, {
                            ...salesCommissionForm,
                            commissionStatus: salesCommissionForm.status,
                          })
                        }}
                      >
                        <input
                          className="form-input"
                          placeholder="Client name"
                          value={salesCommissionForm.clientName}
                          onChange={(e) => setSalesCommissionForm((f) => ({ ...f, clientName: e.target.value }))}
                          required
                        />
                        <input
                          className="form-input"
                          placeholder="Amount"
                          type="number"
                          value={salesCommissionForm.amount}
                          onChange={(e) => setSalesCommissionForm((f) => ({ ...f, amount: e.target.value }))}
                          required
                        />
                        <input
                          className="form-input"
                          placeholder="Month"
                          value={salesCommissionForm.month}
                          onChange={(e) => setSalesCommissionForm((f) => ({ ...f, month: e.target.value }))}
                          required
                        />
                        <select
                          className="form-input"
                          value={salesCommissionForm.status}
                          onChange={(e) =>
                            setSalesCommissionForm((f) => ({ ...f, status: e.target.value as CommissionStatus }))
                          }
                        >
                          <option value="pending">Pending</option>
                          <option value="earned">Earned</option>
                          <option value="paid_out">Paid Out</option>
                        </select>
                        <button type="submit" className="btn btn--accent">
                          Save commission
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        ) : null}
      </div>
    </div>
  )
}
