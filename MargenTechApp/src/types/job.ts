export type Customer = {
  name: string
  phone: string | null
  address: string | null
  lat: number | null
  lng: number | null
}

export type JobRow = {
  id: string
  title: string
  description: string | null
  job_type: string
  urgency: string
  status: string
  field_status: string
  scheduled_at: string | null
  completed_at?: string | null
  customers: Customer | null
}
