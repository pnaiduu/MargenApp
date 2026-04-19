import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'

export type TechnicianRow = {
  id: string
  owner_id: string
  name: string
  role: string | null
  status: string
}

type TCtx = {
  technician: TechnicianRow | null
  loading: boolean
  refresh: () => Promise<TechnicianRow | null>
}

const Ctx = createContext<TCtx | null>(null)

export function TechnicianProvider({ children }: { children: ReactNode }) {
  const { user, configured } = useAuth()
  const [technician, setTechnician] = useState<TechnicianRow | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async (): Promise<TechnicianRow | null> => {
    if (!configured || !user) {
      setTechnician(null)
      setLoading(false)
      return null
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('technicians')
      .select('id, owner_id, name, role, status')
      .eq('user_id', user.id)
      .maybeSingle()

    let next: TechnicianRow | null = null
    if (error || !data) {
      setTechnician(null)
    } else {
      next = data as TechnicianRow
      setTechnician(next)
    }
    setLoading(false)
    return next
  }, [configured, user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const value = useMemo(
    () => ({ technician, loading, refresh }),
    [technician, loading, refresh],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTechnician() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useTechnician outside TechnicianProvider')
  return v
}
