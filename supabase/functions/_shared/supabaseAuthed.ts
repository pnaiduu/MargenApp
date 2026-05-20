import { createClient } from 'npm:@supabase/supabase-js@2.56.0'
import { corsHeaders } from './cors.ts'
import { supabaseAdmin } from './supabaseAdmin.ts'

export function supabaseAuthed(req: Request) {
  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !anonKey) throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY')

  const authHeader = req.headers.get('authorization') ?? ''
  return createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

export function bearerTokenFromRequest(req: Request): string | null {
  const h = (req.headers.get('authorization') ?? req.headers.get('Authorization') ?? '').trim()
  if (!h) return null
  const m = h.match(/^Bearer\s+(.+)$/i)
  if (!m) return null
  const t = m[1]?.trim()
  return t ? t : null
}

/**
 * Avoids local JWT verification; resolves the user via service-role `auth.getUser(token)`.
 */
export async function getUserFromAuthHeader(req: Request): Promise<{
  user: { id: string; email?: string | null } | null
  token: string | null
  error: Error | null
}> {
  const token = bearerTokenFromRequest(req)
  if (!token) return { user: null, token: null, error: new Error('Missing Authorization header') }

  const admin = supabaseAdmin()
  const { data, error } = await admin.auth.getUser(token)
  if (error) return { user: null, token, error: new Error(error.message) }
  const user = data?.user ?? null
  if (!user) return { user: null, token, error: new Error('Unauthorized') }
  return { user: { id: user.id, email: user.email ?? null }, token, error: null }
}

/** 401 JSON with CORS for browser clients. */
export function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
