import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

type QuoteFeature = {
  id: string
  name: string
  price: number
}

type QuotePayload = {
  planId: string
  planName: string
  planPrice: number
  selectedFeatures: QuoteFeature[]
  addonsTotal: number
  monthlyTotal: number
  additionalNotes?: string
  phone?: string
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    return NextResponse.json({ error: 'Quote service is not configured.' }, { status: 503 })
  }

  let body: QuotePayload
  try {
    body = (await request.json()) as QuotePayload
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const phone = body.phone?.trim()
  if (!phone) {
    return NextResponse.json({ error: 'Phone number is required.' }, { status: 400 })
  }

  if (!body.planId || !body.planName || typeof body.planPrice !== 'number' || typeof body.monthlyTotal !== 'number') {
    return NextResponse.json({ error: 'Invalid quote data.' }, { status: 400 })
  }

  const supabase = createClient(url, key)

  const { error } = await supabase.from('quotes').insert({
    plan_id: body.planId,
    plan_name: body.planName,
    plan_price: body.planPrice,
    selected_features: body.selectedFeatures ?? [],
    addons_total: body.addonsTotal ?? 0,
    monthly_total: body.monthlyTotal,
    additional_notes: body.additionalNotes?.trim() || null,
    phone,
  })

  if (error) {
    console.error('Quote insert failed:', error.message)
    return NextResponse.json({ error: 'Could not save your quote. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
