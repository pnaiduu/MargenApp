/**
 * Demo / local-first actions that mirror Edge Functions using only the Supabase client.
 * Replace Edge Function restores later by swapping callers back to supabase.functions.invoke.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

export type Supabase = SupabaseClient<Database>

function milesToMeters(mi: number) {
  return mi * 1609.344
}

export function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000
  const toRad = (n: number) => (n * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const s1 = Math.sin(dLat / 2)
  const s2 = Math.sin(dLng / 2)
  const aa = s1 * s1 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * s2 * s2
  return 2 * R * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa))
}

type TechPick = {
  id: string
  name: string
  user_id: string | null
  skills: string[] | null
  last_lat: number | null
  last_lng: number | null
}

export async function demoAutoAssignJob(supabase: Supabase, jobId: string): Promise<{ note: string | null; error: Error | null }> {
  const { data: job, error: jobErr } = await supabase
    .from('jobs')
    .select('id, owner_id, job_type, urgency, customers(lat, lng)')
    .eq('id', jobId)
    .maybeSingle()

  if (jobErr || !job) return { note: null, error: new Error(jobErr?.message ?? 'Job not found') }

  const dest = job.customers as { lat: number | null; lng: number | null } | null
  const dLat = dest?.lat ?? null
  const dLng = dest?.lng ?? null

  const fail = async (reason: string, title: string, link: string) => {
    await supabase.from('notifications').insert({
      owner_id: job.owner_id,
      type: 'assignment_failed',
      title,
      message: reason,
      link,
      read: false,
    })
    await supabase.from('job_assignment_decisions').insert({
      owner_id: job.owner_id,
      job_id: job.id,
      kind: 'failed',
      emergency: job.urgency === 'emergency',
      job_type: job.job_type,
      reason,
      candidate_count: 0,
      candidates: [],
    })
  }

  if (dLat == null || dLng == null) {
    await fail(
      'Job has no customer coordinates. Add lat/lng to dispatch automatically.',
      'Auto-assignment failed',
      '/jobs',
    )
    return { note: null, error: new Error('Job has no customer coordinates') }
  }

  const { data: prof } = await supabase
    .from('profiles')
    .select('service_area_center_lat, service_area_center_lng, service_area_radius')
    .eq('id', job.owner_id)
    .maybeSingle()

  const centerLat = prof?.service_area_center_lat ?? null
  const centerLng = prof?.service_area_center_lng ?? null
  const radiusMi = prof?.service_area_radius ?? null

  if (centerLat == null || centerLng == null || radiusMi == null || radiusMi <= 0) {
    await fail('Service area is not set, so auto-assignment is disabled.', 'No available technicians for this job', '/settings')
    return { note: null, error: new Error('Service area not set') }
  }

  const distFromCenter = haversineMeters(centerLat, centerLng, dLat, dLng)
  if (distFromCenter > milesToMeters(radiusMi)) {
    await fail(
      'No auto-assignment performed because the job location is outside your service area.',
      'Job outside service area',
      '/settings',
    )
    return { note: null, error: new Error('Job outside service area') }
  }

  const { data: availableTechs, error: techErr } = await supabase
    .from('technicians')
    .select('id, name, user_id, status, skills, last_lat, last_lng')
    .eq('owner_id', job.owner_id)
    .eq('status', 'available')

  if (techErr) return { note: null, error: new Error(techErr.message) }

  const techIds = (availableTechs ?? []).map((t) => t.id)
  let clockedInSet = new Set<string>()
  if (techIds.length) {
    const { data: openSessions } = await supabase
      .from('technician_clock_sessions')
      .select('technician_id')
      .eq('owner_id', job.owner_id)
      .in('technician_id', techIds)
      .is('clock_out_at', null)
    clockedInSet = new Set((openSessions ?? []).map((s) => s.technician_id))
  }

  const isEmergency = job.urgency === 'emergency'
  const jt = (job.job_type ?? 'general').toString().trim().toLowerCase()

  const clockedInAvailable = (availableTechs ?? []).map((t) => t as TechPick).filter((t) => clockedInSet.has(t.id))

  const afterSkill = isEmergency
    ? clockedInAvailable
    : clockedInAvailable.filter((t) => {
        const skills = (t.skills ?? []).map((s) => s.toLowerCase().trim()).filter(Boolean)
        return skills.length === 0 || skills.includes(jt)
      })

  if (afterSkill.length === 0) {
    const msg = isEmergency
      ? 'No clocked-in technicians are available.'
      : 'No clocked-in technicians with the right skill are available.'
    await fail(msg, 'No available technicians for this job', '/technicians')
    return { note: null, error: new Error(msg) }
  }

  const withCoords = afterSkill.filter((t) => t.last_lat != null && t.last_lng != null) as (TechPick & {
    last_lat: number
    last_lng: number
  })[]

  if (withCoords.length === 0) {
    const msg = 'No available technicians have GPS coordinates yet.'
    await fail(msg, 'Auto-assignment failed', '/technicians')
    return { note: null, error: new Error(msg) }
  }

  let best: (TechPick & { last_lat: number; last_lng: number; dist: number }) | null = null
  for (const t of withCoords) {
    const dist = haversineMeters(dLat, dLng, t.last_lat, t.last_lng)
    if (!best || dist < best.dist) best = { ...t, dist }
  }

  if (!best) return { note: null, error: new Error('No assignable technician') }

  const distMi = (best.dist / 1609.344).toFixed(1)
  const note = `Assigned to ${best.name} — ~${distMi} mi (straight-line; demo auto-assign)`

  const { error: upErr } = await supabase
    .from('jobs')
    .update({ technician_id: best.id, assignment_note: note })
    .eq('id', job.id)
  if (upErr) return { note: null, error: new Error(upErr.message) }

  await supabase.from('job_assignment_decisions').insert({
    owner_id: job.owner_id,
    job_id: job.id,
    kind: 'auto',
    chosen_technician_id: best.id,
    emergency: isEmergency,
    job_type: job.job_type,
    reason: note,
    distance_meters: Math.round(best.dist),
    distance_text: `${distMi} mi`,
    duration_seconds: null,
    candidate_count: afterSkill.length,
    candidates: withCoords.map((t) => ({
      technician_id: t.id,
      name: t.name,
      distance_m: haversineMeters(dLat, dLng, t.last_lat, t.last_lng),
    })),
    raw_distance_matrix: null,
  })

  await supabase.from('notifications').insert({
    owner_id: job.owner_id,
    type: 'job_auto_assigned',
    title: 'Job auto-assigned',
    message: note,
    link: '/jobs',
    read: false,
  })

  return { note, error: null }
}

export async function createJobDirect(
  supabase: Supabase,
  ownerId: string,
  body: {
    customer_id: string
    title: string
    description?: string
    job_type?: string
    scheduled_at?: string | null
    urgency?: 'routine' | 'urgent' | 'emergency'
    revenue_cents?: number
  },
): Promise<{ job: unknown; assignment_note: string | null; error: Error | null }> {
  const { data: cust, error: custErr } = await supabase
    .from('customers')
    .select('id, owner_id')
    .eq('id', body.customer_id)
    .maybeSingle()

  if (custErr || !cust || cust.owner_id !== ownerId) {
    return { job: null, assignment_note: null, error: new Error(custErr?.message ?? 'Customer not found') }
  }

  const urgency =
    body.urgency === 'urgent' ? 'urgent' : body.urgency === 'emergency' ? 'emergency' : 'normal'
  const nowIso = new Date().toISOString()

  const { data: job, error: jobErr } = await supabase
    .from('jobs')
    .insert({
      owner_id: ownerId,
      customer_id: cust.id,
      title: body.title.trim(),
      description: body.description?.trim() || null,
      job_type: body.job_type?.trim() || 'general',
      scheduled_at: body.scheduled_at ?? null,
      urgency,
      revenue_cents: body.revenue_cents ?? 0,
      status: 'pending',
      emergency_created_at: urgency === 'emergency' ? nowIso : null,
    })
    .select('*')
    .single()

  if (jobErr || !job) {
    return { job: null, assignment_note: null, error: new Error(jobErr?.message ?? 'Failed to create job') }
  }

  const assign = await demoAutoAssignJob(supabase, job.id)
  return { job, assignment_note: assign.note, error: null }
}

export async function cancelJobDirect(
  supabase: Supabase,
  ownerId: string,
  body: {
    job_id: string
    reason: 'customer_cancelled' | 'technician_unavailable' | 'rescheduled'
    reason_details?: string
  },
): Promise<{ error: Error | null }> {
  const { data: job, error: jobErr } = await supabase
    .from('jobs')
    .select('id, owner_id, technician_id, status')
    .eq('id', body.job_id)
    .maybeSingle()

  if (jobErr || !job) return { error: new Error(jobErr?.message ?? 'Job not found') }
  if (job.owner_id !== ownerId) return { error: new Error('Only the owner can cancel jobs') }
  if (job.status === 'cancelled') return { error: new Error('Job already cancelled') }
  if (job.status === 'completed') return { error: new Error('Cannot cancel a completed job') }

  const nowIso = new Date().toISOString()
  const { error: upErr } = await supabase
    .from('jobs')
    .update({
      status: 'cancelled',
      cancelled_at: nowIso,
      cancel_reason: body.reason,
      cancel_reason_details: body.reason_details?.trim() || null,
      cancelled_by: ownerId,
    })
    .eq('id', job.id)

  if (upErr) return { error: new Error(upErr.message) }

  if (job.technician_id) {
    const { count, error: cErr } = await supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('technician_id', job.technician_id)
      .eq('owner_id', job.owner_id)
      .eq('status', 'in_progress')

    if (!cErr && (count ?? 0) === 0) {
      await supabase
        .from('technicians')
        .update({ status: 'available' })
        .eq('id', job.technician_id)
        .eq('owner_id', job.owner_id)
    }
  }

  return { error: null }
}

export async function reassignJobDirect(
  supabase: Supabase,
  ownerId: string,
  body: { job_id: string; technician_id: string | null; note?: string },
): Promise<{ error: Error | null }> {
  const { data: job, error: jobErr } = await supabase.from('jobs').select('id, owner_id').eq('id', body.job_id).maybeSingle()
  if (jobErr || !job) return { error: new Error(jobErr?.message ?? 'Job not found') }
  if (job.owner_id !== ownerId) return { error: new Error('Forbidden') }

  if (body.technician_id) {
    const { data: tech, error: techErr } = await supabase
      .from('technicians')
      .select('id, owner_id')
      .eq('id', body.technician_id)
      .maybeSingle()
    if (techErr || !tech) return { error: new Error(techErr?.message ?? 'Technician not found') }
    if (tech.owner_id !== ownerId) return { error: new Error('Forbidden') }
  }

  const note = body.note?.trim() || 'Manual reassignment'
  const { error: upErr } = await supabase
    .from('jobs')
    .update({ technician_id: body.technician_id, assignment_note: note })
    .eq('id', body.job_id)
  if (upErr) return { error: new Error(upErr.message) }

  await supabase.from('job_assignment_decisions').insert({
    owner_id: ownerId,
    job_id: body.job_id,
    kind: 'manual',
    chosen_technician_id: body.technician_id,
    emergency: false,
    job_type: null,
    reason: note,
    candidate_count: 0,
    candidates: [],
  })

  await supabase.from('notifications').insert({
    owner_id: ownerId,
    type: 'job_reassigned',
    title: 'Job reassigned',
    message: note,
    link: '/jobs',
    read: false,
  })

  return { error: null }
}

export async function createInvoiceDirect(
  supabase: Supabase,
  ownerId: string,
  body: { job_id: string; send_sms?: boolean },
): Promise<{ error: Error | null }> {
  const { data: job, error: jobErr } = await supabase
    .from('jobs')
    .select('id, owner_id, customer_id, technician_id, title, job_type, completed_at, revenue_cents, customers(name, phone), technicians(name, user_id)')
    .eq('id', body.job_id)
    .maybeSingle()

  if (jobErr || !job) return { error: new Error(jobErr?.message ?? 'Job not found') }

  const tech = job.technicians as { user_id: string | null; name: string } | null
  const isOwner = job.owner_id === ownerId
  const isAssignedTechUser = Boolean(tech?.user_id && tech.user_id === ownerId)
  if (!isOwner && !isAssignedTechUser) return { error: new Error('Forbidden') }

  const amountCents = job.revenue_cents ?? 0
  if (amountCents <= 0) return { error: new Error('Job has no amount set (revenue_cents must be > 0)') }

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const demoUrl = origin ? `${origin}/payments?demo=1&job=${job.id}` : null

  const { data: invoice, error: invErr } = await supabase
    .from('invoices')
    .insert({
      owner_id: job.owner_id,
      job_id: job.id,
      customer_id: job.customer_id,
      technician_id: job.technician_id,
      status: 'draft',
      amount_cents: amountCents,
      currency: 'usd',
      stripe_checkout_url: demoUrl,
      sms_to: (job.customers as { phone: string | null } | null)?.phone ?? null,
    })
    .select('*')
    .single()

  if (invErr || !invoice) return { error: new Error(invErr?.message ?? 'Failed to create invoice') }

  if (body.send_sms) {
    const to = (job.customers as { phone: string | null } | null)?.phone?.trim()
    if (!to) return { error: new Error('Customer has no phone number') }
    const { error: sentErr } = await supabase
      .from('invoices')
      .update({ status: 'sent', sent_at: new Date().toISOString(), sms_to: to })
      .eq('id', invoice.id)
    if (sentErr) return { error: new Error(sentErr.message) }
  }

  return { error: null }
}

export async function sendInvoiceReminderDirect(
  supabase: Supabase,
  ownerId: string,
  invoiceId: string,
): Promise<{ error: Error | null }> {
  const { data: invoice, error: invErr } = await supabase
    .from('invoices')
    .select('id, owner_id, status, stripe_checkout_url, sms_to')
    .eq('id', invoiceId)
    .maybeSingle()

  if (invErr || !invoice) return { error: new Error(invErr?.message ?? 'Invoice not found') }
  if (invoice.owner_id !== ownerId) return { error: new Error('Forbidden') }
  if (invoice.status === 'paid') return { error: new Error('Invoice already paid') }
  if (!invoice.stripe_checkout_url) return { error: new Error('Invoice has no payment link') }
  if (!invoice.sms_to?.trim()) return { error: new Error('Invoice has no SMS recipient') }

  const { error: upErr } = await supabase
    .from('invoices')
    .update({ last_reminder_at: new Date().toISOString() })
    .eq('id', invoice.id)
  if (upErr) return { error: new Error(upErr.message) }
  return { error: null }
}

export async function callCallbackDirect(supabase: Supabase, ownerId: string, phoneCallId: string): Promise<{ error: Error | null }> {
  const { data: call, error: cErr } = await supabase
    .from('phone_calls')
    .select('id, owner_id')
    .eq('id', phoneCallId)
    .maybeSingle()

  if (cErr || !call) return { error: new Error(cErr?.message ?? 'Call not found') }
  if (call.owner_id !== ownerId) return { error: new Error('Forbidden') }

  const { error: upErr } = await supabase
    .from('phone_calls')
    .update({ status: 'called_back' })
    .eq('id', call.id)
    .eq('owner_id', ownerId)

  if (upErr) return { error: new Error(upErr.message) }
  return { error: null }
}

export async function approveDraftJobDirect(supabase: Supabase, ownerId: string, jobId: string): Promise<{ error: Error | null }> {
  const { data: job, error: jobErr } = await supabase.from('jobs').select('id, owner_id, needs_approval').eq('id', jobId).maybeSingle()
  if (jobErr || !job) return { error: new Error(jobErr?.message ?? 'Job not found') }
  if (job.owner_id !== ownerId) return { error: new Error('Forbidden') }

  const { error: upErr } = await supabase.from('jobs').update({ needs_approval: false }).eq('id', job.id).eq('owner_id', ownerId)
  if (upErr) return { error: new Error(upErr.message) }

  await demoAutoAssignJob(supabase, jobId)
  return { error: null }
}

export async function technicianUnavailableReassignDirect(
  supabase: Supabase,
  ownerId: string,
  technicianId: string,
): Promise<{ error: Error | null }> {
  const { data: tech, error: techErr } = await supabase
    .from('technicians')
    .select('id, owner_id, name')
    .eq('id', technicianId)
    .maybeSingle()

  if (techErr || !tech) return { error: new Error(techErr?.message ?? 'Technician not found') }
  if (tech.owner_id !== ownerId) return { error: new Error('Only the owner can do this') }

  await supabase.from('technicians').update({ status: 'off_duty' }).eq('id', tech.id).eq('owner_id', tech.owner_id)

  const { data: jobs, error: jobsErr } = await supabase
    .from('jobs')
    .select('id, title, job_type, status, technician_id, customer_id, customers(address, lat, lng)')
    .eq('owner_id', tech.owner_id)
    .eq('technician_id', tech.id)
    .in('status', ['pending', 'in_progress'])
    .order('scheduled_at', { ascending: true })

  if (jobsErr) return { error: new Error(jobsErr.message) }

  const { data: techs, error: techsErr } = await supabase
    .from('technicians')
    .select('id, user_id, name, status, skills, last_lat, last_lng')
    .eq('owner_id', tech.owner_id)
    .eq('status', 'available')

  if (techsErr) return { error: new Error(techsErr.message) }

  type Tech = TechPick
  const candidates = (techs ?? []) as Tech[]

  const reassigned: { job_id: string; job_title: string; from: string; to: string | null }[] = []

  for (const j of jobs ?? []) {
    const jobType = (j.job_type ?? 'general').toString().trim().toLowerCase()
    const cust = j.customers as { address: string | null; lat: number | null; lng: number | null } | null
    const cLat = cust?.lat ?? null
    const cLng = cust?.lng ?? null

    let best: { tech: Tech; score: number } | null = null
    for (const t of candidates) {
      const skills = (t.skills ?? []).map((s) => s.toLowerCase().trim()).filter(Boolean)
      const skillOk = skills.length === 0 || skills.includes(jobType)
      if (!skillOk) continue

      let score = 0
      if (cLat != null && cLng != null && t.last_lat != null && t.last_lng != null) {
        const dist = haversineMeters(cLat, cLng, t.last_lat, t.last_lng)
        score -= dist
      }
      if (skills.includes(jobType)) score += 250
      if (!best || score > best.score) best = { tech: t, score }
    }

    const toTech = best?.tech ?? null
    if (!toTech) {
      reassigned.push({ job_id: j.id, job_title: j.title ?? 'Job', from: tech.name, to: null })
      continue
    }

    const { error: upErr } = await supabase
      .from('jobs')
      .update({ technician_id: toTech.id })
      .eq('id', j.id)
      .eq('owner_id', tech.owner_id)
    if (upErr) return { error: new Error(upErr.message) }

    reassigned.push({ job_id: j.id, job_title: j.title ?? 'Job', from: tech.name, to: toTech.name })
  }

  const lines = reassigned
    .slice(0, 8)
    .map((r) => `${r.job_title} → ${r.to ?? 'Unassigned'}`)
    .join(' · ')

  await supabase.from('notifications').insert({
    owner_id: tech.owner_id,
    type: 'jobs_reassigned',
    title: 'Jobs reassigned',
    message: reassigned.length ? lines : 'No active jobs needed reassignment.',
    link: '/jobs',
    read: false,
  })

  return { error: null }
}

export async function stripeConnectStartDemo(supabase: Supabase, userId: string) {
  const demoId = `acct_demo_${userId.replace(/-/g, '').slice(0, 14)}`
  const { error } = await supabase
    .from('profiles')
    .update({
      stripe_account_id: demoId,
      stripe_charges_enabled: true,
      stripe_details_submitted: true,
    })
    .eq('id', userId)

  if (error) return { data: null, error }
  return { data: { url: null as string | null, stripe_account_id: demoId }, error: null }
}

export async function stripeConnectSyncDemo(supabase: Supabase, userId: string) {
  const { error } = await supabase
    .from('profiles')
    .update({ stripe_charges_enabled: true, stripe_details_submitted: true })
    .eq('id', userId)
  if (error) return { data: null, error }
  return { data: { stripe_charges_enabled: true as boolean, stripe_details_submitted: true as boolean }, error: null }
}

export type DemoVoiceRow = {
  voice_id: string
  voice_name: string
  provider: string
  gender: string
  age?: string
  preview_audio_url?: string
}

export function getDemoRetellVoices(): DemoVoiceRow[] {
  return [
    { voice_id: 'demo-alloy', voice_name: 'Alloy (demo)', provider: 'demo', gender: 'neutral' },
    { voice_id: 'demo-sage', voice_name: 'Sage (demo)', provider: 'demo', gender: 'female' },
    { voice_id: 'demo-ash', voice_name: 'Ash (demo)', provider: 'demo', gender: 'male' },
  ]
}

export async function retellTestCallDemo(supabase: Supabase): Promise<{ error: Error | null }> {
  const { error } = await supabase.functions.invoke('retell-test-call', { body: {} })
  if (error) return { error: new Error(error.message) }
  return { error: null }
}
