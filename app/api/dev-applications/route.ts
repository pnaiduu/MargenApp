import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return NextResponse.json({ error: 'Service not configured.' }, { status: 503 })

  const body = await request.json()
  const sb = createClient(url, key)

  const { error } = await sb.from('dev_applications').insert({
    full_name: body.fullName?.trim(),
    email: body.email?.trim(),
    age: body.age?.trim(),
    city_state: body.cityState?.trim(),
    experience: body.experience?.trim(),
    built_before: body.builtBefore,
    portfolio_link: body.portfolioLink?.trim() || null,
    uses_cursor: body.usesCursor,
    hours_per_week: body.hoursPerWeek?.trim(),
    why_join: body.whyJoin?.trim(),
    commission_ok: body.commissionOk === true,
  })

  if (error) {
    console.error('Dev application insert failed:', error.message)
    return NextResponse.json({ error: 'Could not submit application.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
