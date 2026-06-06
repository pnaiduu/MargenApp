import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

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
  selectedFeatures: QuoteFeature[]
  notSelectedFeatures: QuoteFeature[]
  monthlyTotal: number
  anythingElse?: string
}

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key)
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

  const { error } = await sb.from('quotes').insert({
    plan_id: body.planId || body.plan.toLowerCase().replace(/\s+/g, '-'),
    full_name: body.fullName.trim(),
    business_name: body.businessName.trim(),
    email: body.email.trim(),
    phone: body.phone.trim(),
    city_state: body.cityState.trim(),
    business_description: body.businessDescription.trim(),
    has_existing_site: body.hasExistingSite,
    existing_site_url: body.existingSiteUrl?.trim() || null,
    has_logo: body.hasLogo,
    has_photos: body.hasPhotos,
    timeline: body.timeline.trim(),
    heard_from: body.heardFrom.trim(),
    rep_code: body.repCode?.trim() || null,
    plan: body.plan.trim(),
    plan_name: body.plan.trim(),
    plan_price: body.planPrice,
    features: body.selectedFeatures ?? [],
    selected_features: body.selectedFeatures ?? [],
    not_selected_features: body.notSelectedFeatures ?? [],
    addons_total: (body.selectedFeatures ?? []).reduce((s, f) => s + f.price, 0),
    monthly_total: body.monthlyTotal,
    anything_else: body.anythingElse?.trim() || null,
    status: 'new',
  })

  if (error) {
    console.error('Quote insert failed:', error.message)
    return NextResponse.json({ error: 'Could not save your quote. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
