/**
 * Demo-friendly helpers — same behavior as web `src/lib/directSupabaseActions` invoice path,
 * plus push token registration without Edge Functions.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

function randomPaymentToken() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function registerExpoPushTokenDirect(
  supabase: SupabaseClient,
  userId: string,
  token: string,
  platform: string,
): Promise<{ error: Error | null }> {
  const { data: tech, error: techErr } = await supabase
    .from('technicians')
    .select('owner_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (techErr || !tech?.owner_id) {
    return { error: new Error(techErr?.message ?? 'Not linked to a technician account') }
  }

  const { error } = await supabase.from('expo_push_tokens').upsert(
    {
      owner_id: tech.owner_id,
      user_id: userId,
      token: token.trim(),
      platform: platform || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,token' },
  )

  if (error) return { error: new Error(error.message) }
  return { error: null }
}

const DEFAULT_PUBLIC_SITE = 'https://margen.app'

function publicConfirmBaseUrl() {
  const u = process.env.EXPO_PUBLIC_SITE_URL?.trim()
  return u && u.length > 0 ? u.replace(/\/$/, '') : DEFAULT_PUBLIC_SITE
}

export async function createInvoiceFromJobDirect(
  supabase: SupabaseClient,
  userId: string,
  jobId: string,
  opts?: { send_sms?: boolean },
): Promise<{ error: Error | null; customerPhone: string | null }> {
  const { data: job, error: jobErr } = await supabase
    .from('jobs')
    .select('id, owner_id, customer_id, technician_id, title, job_type, completed_at, revenue_cents, customers(name, phone), technicians(name, user_id)')
    .eq('id', jobId)
    .maybeSingle()

  if (jobErr || !job) return { error: new Error(jobErr?.message ?? 'Job not found'), customerPhone: null }

  const rawTech = (job as unknown as { technicians?: unknown }).technicians
  const techRow = Array.isArray(rawTech) ? rawTech[0] : rawTech
  const tech = techRow as { user_id: string | null; name: string } | null
  const isOwner = job.owner_id === userId
  const isAssignedTechUser = Boolean(tech?.user_id && tech.user_id === userId)
  if (!isOwner && !isAssignedTechUser) return { error: new Error('Forbidden'), customerPhone: null }

  const amountCents = Number((job as Record<string, unknown>).revenue_cents ?? 0) || 0
  if (amountCents <= 0) return { error: new Error('Job has no amount set (revenue_cents must be > 0)'), customerPhone: null }

  const rawCust = (job as unknown as { customers?: unknown }).customers
  const custRow = Array.isArray(rawCust) ? rawCust[0] : rawCust
  const customer = custRow as { phone: string | null } | null
  const customerPhone = customer?.phone?.trim() ? customer.phone.trim() : null

  const { data: existing } = await supabase
    .from('invoices')
    .select('id, payment_confirmation_sent_at, payment_confirmed_at, status')
    .eq('job_id', jobId)
    .in('status', ['draft', 'sent'])
    .is('payment_confirmed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing?.id) {
    return { error: null, customerPhone }
  }

  const token = randomPaymentToken()
  const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const base = publicConfirmBaseUrl()
  const confirmUrl = `${base}/confirm-payment?token=${encodeURIComponent(token)}`

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
      stripe_checkout_url: confirmUrl,
      sms_to: customerPhone,
      payment_confirmation_token: token,
      payment_confirmation_deadline_at: deadline,
    })
    .select('id')
    .single()

  if (invErr || !invoice) return { error: new Error(invErr?.message ?? 'Failed to create invoice'), customerPhone }

  return { error: null, customerPhone }
}
