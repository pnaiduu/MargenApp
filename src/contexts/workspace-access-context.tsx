import { createContext, useContext } from 'react'
import type { SubscriptionRow } from '../lib/plans'

export type WorkspaceAccessContextValue = {
  subscription: SubscriptionRow | null
  effectiveSubscription: SubscriptionRow | null
  isDevBypass: boolean
  hasPaidSaas: boolean
  accessLoading: boolean
}

export const WorkspaceAccessContext = createContext<WorkspaceAccessContextValue | null>(null)

export function useWorkspaceAccess(): WorkspaceAccessContextValue {
  const v = useContext(WorkspaceAccessContext)
  if (!v) {
    throw new Error('useWorkspaceAccess must be used under SubscriptionAccessRoute (inside the owner dashboard).')
  }
  return v
}
