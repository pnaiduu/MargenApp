import type { SupabaseClient } from '@supabase/supabase-js'

export type JobRatingInsert = {
  job_id: string
  technician_id: string
  owner_id: string
  rating: number
  comment: string | null
  customer_phone: string
}

/** Inserts into `job_ratings` when deployed (see MargenTechApp/schema/job_ratings.sql). */
export async function submitJobRating(
  supabase: SupabaseClient,
  row: JobRatingInsert,
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from('job_ratings').insert({
    job_id: row.job_id,
    technician_id: row.technician_id,
    owner_id: row.owner_id,
    rating: row.rating,
    comment: row.comment,
    customer_phone: row.customer_phone,
    submitted_at: new Date().toISOString(),
  })
  if (error) return { error: new Error(error.message) }
  return { error: null }
}
