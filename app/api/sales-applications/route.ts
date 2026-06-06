import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getSupabaseConfig } from '../../../lib/supabaseConfig'

export async function POST(request: Request) {
  const { url, key } = getSupabaseConfig()
  if (!url || !key) return NextResponse.json({ error: 'Service not configured.' }, { status: 503 })

  const body = await request.json()
  const sb = createClient(url, key)

  const { error } = await sb.from('sales_applications').insert({
    full_name: body.fullName?.trim(),
    email: body.email?.trim(),
    age: body.age?.trim(),
    city_state: body.cityState?.trim(),
    has_sales_experience: body.hasSalesExperience,
    does_cold_calls: body.doesColdCalls,
    approach_description: body.approachDescription?.trim(),
    has_car: body.hasCar,
    why_join: body.whyJoin?.trim(),
    commission_ok: body.commissionOk === true,
  })

  if (error) {
    console.error('Sales application insert failed:', error.message)
    return NextResponse.json({ error: 'Could not submit application.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
