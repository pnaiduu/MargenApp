import AsyncStorage from '@react-native-async-storage/async-storage'

const KEY = 'margen_tech_offline_queue_v1'

export type QueuedOperation =
  | {
      id: string
      kind: 'technician_patch'
      technicianId: string
      patch: Record<string, unknown>
    }
  | {
      id: string
      kind: 'job_patch'
      jobId: string
      expectedTechnicianId?: string
      patch: Record<string, unknown>
    }
  | {
      id: string
      kind: 'clock_in'
      technicianId: string
      ownerId: string
    }
  | {
      id: string
      kind: 'clock_out'
      sessionId: string
    }
  | {
      id: string
      kind: 'clock_out_open'
      technicianId: string
    }

/** Payload without `id` (assigned when queued). */
export type EnqueuePayload =
  | { id?: string; kind: 'technician_patch'; technicianId: string; patch: Record<string, unknown> }
  | { id?: string; kind: 'job_patch'; jobId: string; expectedTechnicianId?: string; patch: Record<string, unknown> }
  | { id?: string; kind: 'clock_in'; technicianId: string; ownerId: string }
  | { id?: string; kind: 'clock_out'; sessionId: string }
  | { id?: string; kind: 'clock_out_open'; technicianId: string }

async function readQueue(): Promise<QueuedOperation[]> {
  const raw = await AsyncStorage.getItem(KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as QueuedOperation[]
  } catch {
    return []
  }
}

async function writeQueue(q: QueuedOperation[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(q))
}

function nextId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/** Queue a mutation for when the device is back online. */
export async function enqueueOp(op: EnqueuePayload) {
  const q = await readQueue()
  const id = op.id ?? nextId()
  q.push({ ...op, id } as QueuedOperation)
  await writeQueue(q)
}

export async function flushQueue(
  handler: (op: QueuedOperation) => Promise<void>,
): Promise<void> {
  const q = await readQueue()
  if (q.length === 0) return
  const remaining: QueuedOperation[] = []
  for (const op of q) {
    try {
      await handler(op)
    } catch {
      remaining.push(op)
    }
  }
  await writeQueue(remaining)
}

export async function cacheJobsJson(technicianId: string, json: string) {
  await AsyncStorage.setItem(`margen_jobs_cache_${technicianId}`, json)
}

export async function readJobsCache(technicianId: string): Promise<string | null> {
  return AsyncStorage.getItem(`margen_jobs_cache_${technicianId}`)
}
