import { supabase } from './supabase'
import { fetchOwnerDashboard, type OwnerDashboardSnapshot } from './ownerDashboard'

const OPEN_TEAM_INVITE_NAME = 'Open team invite'

export type OwnerJobRow = {
  id: string
  title: string
  status: string
  urgency: string
  scheduled_at: string | null
  technicians: { name: string } | null
  customers: { name: string } | null
}

export type OwnerTechnicianRow = {
  id: string
  name: string
  status: string
  role: string | null
  phone: string | null
  last_lat: number | null
  last_lng: number | null
  map_color: string | null
  clockedIn: boolean
}

export type OwnerInvoiceRow = {
  id: string
  status: string
  amount_cents: number
  invoice_number: number
  created_at: string
  paid_at: string | null
  customers: { name: string } | null
}

export type OwnerProfileRow = {
  company_name: string | null
  full_name: string | null
  business_phone: string | null
  business_address: string | null
}

export type OwnerDemoWorkspace = {
  dashboard: OwnerDashboardSnapshot
  profile: OwnerProfileRow
  jobs: OwnerJobRow[]
  technicians: OwnerTechnicianRow[]
  schedule: OwnerJobRow[]
  invoices: OwnerInvoiceRow[]
}

function localDayIsoRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}

function mapJobRow(row: unknown): OwnerJobRow {
  const raw = row as {
    id: string
    title: string
    status: string
    urgency: string
    scheduled_at: string | null
    technicians: { name: string } | { name: string }[] | null
    customers?: { name: string } | { name: string }[] | null
  }
  const tech = raw.technicians
  const techName = Array.isArray(tech) ? tech[0]?.name : tech?.name
  const cust = raw.customers
  const custName = cust ? (Array.isArray(cust) ? cust[0]?.name : cust?.name) : undefined
  return {
    id: raw.id,
    title: raw.title,
    status: raw.status,
    urgency: raw.urgency,
    scheduled_at: raw.scheduled_at,
    technicians: techName ? { name: techName } : null,
    customers: custName ? { name: custName } : null,
  }
}

export async function fetchOwnerDemoWorkspace(ownerId: string): Promise<OwnerDemoWorkspace> {
  const { startIso, endIso } = localDayIsoRange()

  const [
    dashboard,
    profileRes,
    jobsRes,
    techRes,
    techLiveRes,
    clockRes,
    scheduleRes,
    invoicesRes,
  ] = await Promise.all([
    fetchOwnerDashboard(ownerId),
    supabase
      .from('profiles')
      .select('company_name, full_name, business_phone, business_address')
      .eq('id', ownerId)
      .maybeSingle(),
    supabase
      .from('jobs')
      .select('id, title, status, urgency, scheduled_at, technicians ( name ), customers ( name )')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(80),
    supabase
      .from('technicians')
      .select('id, name, status, role, phone, last_lat, last_lng, map_color')
      .eq('owner_id', ownerId)
      .neq('name', OPEN_TEAM_INVITE_NAME)
      .order('name'),
    supabase
      .from('technicians_live')
      .select('id, last_lat, last_lng')
      .eq('owner_id', ownerId),
    supabase
      .from('technician_clock_sessions')
      .select('technician_id')
      .eq('owner_id', ownerId)
      .is('clock_out_at', null),
    supabase
      .from('jobs')
      .select('id, title, status, urgency, scheduled_at, technicians ( name ), customers ( name )')
      .eq('owner_id', ownerId)
      .not('scheduled_at', 'is', null)
      .gte('scheduled_at', startIso)
      .lte('scheduled_at', endIso)
      .order('scheduled_at', { ascending: true }),
    supabase
      .from('invoices')
      .select('id, status, amount_cents, invoice_number, created_at, paid_at, customers ( name )')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  const clockedInIds = new Set(
    (clockRes.data ?? []).map((r) => String((r as { technician_id: string }).technician_id)),
  )
  const liveById = new Map<string, { lat: number; lng: number }>()
  for (const row of techLiveRes.data ?? []) {
    const lat = row.last_lat as number | null
    const lng = row.last_lng as number | null
    if (lat != null && lng != null) {
      liveById.set(String(row.id), { lat, lng })
    }
  }

  const technicians: OwnerTechnicianRow[] = (techRes.data ?? []).map((row) => {
    const id = String(row.id)
    const live = liveById.get(id)
    return {
      id,
      name: String(row.name ?? 'Technician'),
      status: String(row.status ?? ''),
      role: (row.role as string | null) ?? null,
      phone: (row.phone as string | null) ?? null,
      last_lat: live?.lat ?? (row.last_lat as number | null),
      last_lng: live?.lng ?? (row.last_lng as number | null),
      map_color: (row.map_color as string | null) ?? null,
      clockedIn: clockedInIds.has(id),
    }
  })

  const invoices: OwnerInvoiceRow[] = (invoicesRes.data ?? []).map((row) => {
    const raw = row as {
      id: string
      status: string
      amount_cents: number
      invoice_number: number
      created_at: string
      paid_at: string | null
      customers: { name: string } | { name: string }[] | null
    }
    const cust = raw.customers
    const name = Array.isArray(cust) ? cust[0]?.name : cust?.name
    return {
      id: raw.id,
      status: raw.status,
      amount_cents: raw.amount_cents,
      invoice_number: raw.invoice_number,
      created_at: raw.created_at,
      paid_at: raw.paid_at,
      customers: name ? { name } : null,
    }
  })

  return {
    dashboard,
    profile: (profileRes.data as OwnerProfileRow | null) ?? {
      company_name: null,
      full_name: null,
      business_phone: null,
      business_address: null,
    },
    jobs: (jobsRes.data ?? []).map(mapJobRow),
    technicians,
    schedule: (scheduleRes.data ?? []).map(mapJobRow),
    invoices,
  }
}
