import type { SupabaseClient } from '@supabase/supabase-js'

export async function uploadJobPhoto(
  supabase: SupabaseClient,
  ownerId: string,
  jobId: string,
  kind: 'before' | 'after',
  localUri: string,
): Promise<{ publicUrl: string | null; error: Error | null }> {
  try {
    const res = await fetch(localUri)
    const blob = await res.blob()
    const ext = localUri.toLowerCase().includes('.png') ? 'png' : 'jpg'
    const path = `${ownerId}/${jobId}/${kind}_${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('job-photos').upload(path, blob, {
      contentType: ext === 'png' ? 'image/png' : 'image/jpeg',
      upsert: true,
    })
    if (upErr) return { publicUrl: null, error: new Error(upErr.message) }
    const { data } = supabase.storage.from('job-photos').getPublicUrl(path)
    return { publicUrl: data.publicUrl, error: null }
  } catch (e) {
    return { publicUrl: null, error: e instanceof Error ? e : new Error('Upload failed') }
  }
}
