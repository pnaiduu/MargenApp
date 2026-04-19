import { corsHeaders } from '../_shared/cors.ts'

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const key = Deno.env.get('RETELL_API_KEY')
  if (!key) return json(500, { error: 'Missing RETELL_API_KEY' })

  const res = await fetch('https://api.retellai.com/list-voices', {
    method: 'GET',
    headers: { Authorization: `Bearer ${key}` },
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) return json(res.status, { error: 'Retell list-voices failed', details: data })

  return json(200, data)
})

