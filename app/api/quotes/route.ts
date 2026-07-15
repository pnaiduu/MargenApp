import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getSupabaseConfig } from '../../../lib/supabaseConfig'

type QuoteFeature = { name: string; price: number }

type QuotePayload = {
  fullName: string
  businessName: string
  email: string
  phone: string
  cityState: string
  businessDescription: string
  hasExistingSite: boolean
  existingSiteUrl?: string
  hasLogo: boolean
  hasPhotos: boolean
  timeline: string
  heardFrom: string
  repCode?: string
  planId?: string
  plan: string
  planPrice: number
  /** Preferred field from the quote builder */
  selectedFeatures?: QuoteFeature[]
  /** Legacy alias some clients may still send */
  features?: QuoteFeature[]
  notSelectedFeatures?: QuoteFeature[]
  monthlyTotal: number
  anythingElse?: string
}

function supabase() {
  const { url, key } = getSupabaseConfig()
  if (!url || !key) return null
  return createClient(url, key)
}

function asInt(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.round(n)
}

function asFeatureArray(value: unknown): QuoteFeature[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((f): f is QuoteFeature => !!f && typeof f === 'object' && typeof (f as QuoteFeature).name === 'string')
    .map((f) => ({
      name: String(f.name),
      price: asInt((f as QuoteFeature).price, 0),
    }))
}

export async function POST(request: Request) {
  const sb = supabase()
  if (!sb) return NextResponse.json({ error: 'Quote service is not configured.' }, { status: 503 })

  let body: QuotePayload
  try {
    body = (await request.json()) as QuotePayload
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const required = [
    body.fullName?.trim(),
    body.businessName?.trim(),
    body.email?.trim(),
    body.phone?.trim(),
    body.cityState?.trim(),
    body.businessDescription?.trim(),
    body.timeline?.trim(),
    body.heardFrom?.trim(),
    body.plan?.trim(),
  ]
  if (required.some((v) => !v)) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }

  if (body.hasExistingSite === undefined || body.hasLogo === undefined || body.hasPhotos === undefined) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }

  if (body.hasExistingSite && !body.existingSiteUrl?.trim()) {
    return NextResponse.json({ error: 'Website URL is required.' }, { status: 400 })
  }

  const selectedFeatures = asFeatureArray(body.selectedFeatures ?? body.features)
  const notSelectedFeatures = asFeatureArray(body.notSelectedFeatures)
  const planPrice = asInt(body.planPrice, 0)
  const addonsTotal = selectedFeatures.reduce((sum, f) => sum + f.price, 0)
  const monthlyTotal = asInt(body.monthlyTotal, planPrice + addonsTotal)

  const planId = (body.planId || body.plan).trim().toLowerCase().replace(/\s+/g, '-')
  const planName = body.plan.trim()

  // Exact column names/types expected by public.quotes (NOT NULL core + extended form fields).
  // Do NOT send payment_status until migration 049 is applied to the live database.
  const row = {
    // NOT NULL
    plan_id: planId,
    plan_name: planName,
    plan_price: planPrice,
    selected_features: selectedFeatures,
    addons_total: addonsTotal,
    monthly_total: monthlyTotal,
    // Extended columns (nullable / defaulted in later migrations)
    full_name: body.fullName.trim(),
    business_name: body.businessName.trim(),
    email: body.email.trim(),
    phone: body.phone.trim(),
    city_state: body.cityState.trim(),
    business_description: body.businessDescription.trim(),
    has_existing_site: body.hasExistingSite === true,
    existing_site_url: body.existingSiteUrl?.trim() || null,
    has_logo: body.hasLogo === true,
    has_photos: body.hasPhotos === true,
    timeline: body.timeline.trim(),
    heard_from: body.heardFrom.trim(),
    rep_code: body.repCode?.trim() || null,
    plan: planName,
    not_selected_features: notSelectedFeatures,
    anything_else: body.anythingElse?.trim() || null,
    status: 'new',
  }

  console.log('quotes.insert payload:', JSON.stringify(row))

  const { data, error } = await sb.from('quotes').insert(row).select('id').single()

  if (error) {
    console.error('Quote insert failed:', error.message, error.details, error.hint, error.code)
    return NextResponse.json(
      { error: `Could not save your quote: ${error.message}` },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, id: data?.id })
}
