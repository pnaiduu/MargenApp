import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export function supabaseAuthed(req: Request) {
  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '') ?? ''
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )
}
