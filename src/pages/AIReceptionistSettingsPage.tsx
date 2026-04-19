import type { DragEndEvent } from '@dnd-kit/core'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { VoicePickerModal } from '../components/VoicePickerModal'
import { useAuth } from '../contexts/useAuth'
import { retellTestCallDemo } from '../lib/directSupabaseActions'
import { deployAiReceptionistRetell, getRetellVoicesCache, retellListVoicesCached } from '../lib/retellDeploy'
import { supabase } from '../lib/supabase'
import { easePremium } from '../lib/motion'

type StepType = 'open_text' | 'yes_no' | 'address' | 'phone' | 'urgency'

type FlowStep = {
  id: string
  question: string
  response_type: StepType
}

function uid() {
  return `step_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`
}

function StepCard({
  step,
  onChange,
  onDelete,
}: {
  step: FlowStep
  onChange: (patch: Partial<FlowStep>) => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface)] px-3 py-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">Step</p>
          <p className="mt-1 text-sm font-medium text-[var(--color-margen-text)]">{step.question || 'New question'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-2.5 py-1 text-xs font-medium text-[var(--color-margen-text)] hover:bg-[var(--color-margen-hover)]"
            aria-label="Drag to reorder"
            title="Drag to reorder"
          >
            Drag
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md px-2.5 py-1 text-xs font-medium alert-error hover:opacity-90"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
            Question
          </label>
          <input
            value={step.question}
            onChange={(e) => onChange({ question: e.target.value })}
            className="mt-2 w-full rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2 text-sm text-[var(--color-margen-text)] outline-none focus:border-[var(--margen-accent)]"
            placeholder="What type of issue are you experiencing?"
          />
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
            Response type
          </label>
          <select
            value={step.response_type}
            onChange={(e) => onChange({ response_type: e.target.value as StepType })}
            className="mt-2 w-full rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2 text-sm text-[var(--color-margen-text)] outline-none focus:border-[var(--margen-accent)]"
          >
            <option value="open_text">Open text</option>
            <option value="yes_no">Yes / No</option>
            <option value="address">Address</option>
            <option value="phone">Phone number</option>
            <option value="urgency">Urgency selector</option>
          </select>
        </div>
      </div>
    </div>
  )
}

export function AIReceptionistSettingsPage() {
  const { user } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [deployNote, setDeployNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const [companyName, setCompanyName] = useState('')
  const [greeting, setGreeting] = useState('')
  const [signOff, setSignOff] = useState('')

  const [steps, setSteps] = useState<FlowStep[]>([])
  const [voiceId, setVoiceId] = useState<string>('')
  const [voicePickerOpen, setVoicePickerOpen] = useState(false)
  const [voiceModalLoading, setVoiceModalLoading] = useState(false)
  const [voiceModalError, setVoiceModalError] = useState<string | null>(null)
  /** Bumps when Retell list cache is populated so we re-resolve the selected voice card. */
  const [voiceListTick, setVoiceListTick] = useState(0)

  const [hoursEnabled, setHoursEnabled] = useState(false)
  const [hoursByDay, setHoursByDay] = useState<Record<string, { enabled: boolean; open: string; close: string }>>({
    mon: { enabled: true, open: '09:00', close: '17:00' },
    tue: { enabled: true, open: '09:00', close: '17:00' },
    wed: { enabled: true, open: '09:00', close: '17:00' },
    thu: { enabled: true, open: '09:00', close: '17:00' },
    fri: { enabled: true, open: '09:00', close: '17:00' },
    sat: { enabled: false, open: '09:00', close: '13:00' },
    sun: { enabled: false, open: '09:00', close: '13:00' },
  })
  const [afterHoursMsg, setAfterHoursMsg] = useState('')

  const [escEmergencySms, setEscEmergencySms] = useState(true)
  const [escHumanTransfer, setEscHumanTransfer] = useState(true)
  const [escUnsureCallback, setEscUnsureCallback] = useState(true)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    if (!user) return
    const ownerId = user.id
    const ac = new AbortController()
    const s = ac.signal

    async function load() {
      setLoading(true)
      setError(null)

      const [{ data: settings }, { data: prof }] = await Promise.all([
        supabase.from('ai_receptionist_settings').select('*').eq('owner_id', ownerId).abortSignal(s).maybeSingle(),
        supabase.from('profiles').select('company_name').eq('id', ownerId).abortSignal(s).maybeSingle(),
      ])

      if (ac.signal.aborted) return

      const defaultCompany = (prof as { company_name: string | null } | null)?.company_name ?? ''
      setCompanyName((settings as { company_name?: string | null } | null)?.company_name ?? defaultCompany ?? '')
      setGreeting((settings as { greeting_message?: string | null } | null)?.greeting_message ?? '')
      setSignOff((settings as { sign_off_message?: string | null } | null)?.sign_off_message ?? '')

      const rawSteps = ((settings as { flow_steps?: unknown } | null)?.flow_steps ?? []) as unknown
      const parsedSteps = Array.isArray(rawSteps)
        ? (rawSteps as FlowStep[]).filter((s) => s && typeof s.id === 'string')
        : []
      setSteps(
        parsedSteps.length
          ? parsedSteps
          : [
              { id: uid(), question: 'What type of issue are you experiencing?', response_type: 'open_text' },
              { id: uid(), question: 'How urgent is this — can it wait a few days or is it an emergency?', response_type: 'urgency' },
              { id: uid(), question: "What's the address?", response_type: 'address' },
              { id: uid(), question: "What's the best number to reach you?", response_type: 'phone' },
              { id: uid(), question: "We'll have someone out to help you soon — is there anything else?", response_type: 'open_text' },
            ],
      )

      setVoiceId((settings as { voice_id?: string | null } | null)?.voice_id ?? '')

      const bh = ((settings as { business_hours?: unknown } | null)?.business_hours ?? {}) as {
        enabled?: boolean
        days?: Record<string, { open?: string; close?: string; enabled?: boolean }>
      }
      setHoursEnabled(Boolean(bh.enabled))
      if (bh.days && typeof bh.days === 'object') {
        setHoursByDay((prev) => {
          const next = { ...prev }
          for (const [k, v] of Object.entries(bh.days ?? {})) {
            if (!next[k]) continue
            next[k] = {
              enabled: Boolean(v?.enabled ?? next[k]!.enabled),
              open: v?.open ?? next[k]!.open,
              close: v?.close ?? next[k]!.close,
            }
          }
          return next
        })
      }
      setAfterHoursMsg((settings as { after_hours_message?: string | null } | null)?.after_hours_message ?? '')

      const esc = ((settings as { escalation_rules?: unknown } | null)?.escalation_rules ?? {}) as Record<string, unknown>
      setEscEmergencySms(Boolean(esc.emergency_sms ?? true))
      setEscHumanTransfer(Boolean(esc.human_transfer ?? true))
      setEscUnsureCallback(Boolean(esc.unsure_callback ?? true))

      setLoading(false)
    }

    void load()
    return () => {
      ac.abort()
    }
  }, [user])

  useEffect(() => {
    if (!voicePickerOpen) return
    const cached = getRetellVoicesCache()
    if (cached?.length) {
      setVoiceModalLoading(false)
      setVoiceModalError(null)
      setVoiceListTick((n) => n + 1)
      return
    }
    let alive = true
    setVoiceModalLoading(true)
    setVoiceModalError(null)
    void retellListVoicesCached().then(({ voices, error }) => {
      if (!alive) return
      setVoiceModalLoading(false)
      if (error) {
        setVoiceModalError(error.message)
      } else if (!voices.length) {
        setVoiceModalError('No voices returned from Retell. Check your API key.')
      }
      setVoiceListTick((n) => n + 1)
    })
    return () => {
      alive = false
    }
  }, [voicePickerOpen])

  const selectedVoice = useMemo(() => {
    if (!voiceId) return null
    return getRetellVoicesCache()?.find((v) => v.voice_id === voiceId) ?? null
  }, [voiceId, voiceListTick])

  const previewGreeting = useMemo(() => {
    const base = greeting.trim()
    if (base) return base
    const cn = companyName.trim() || 'your company'
    return `Thanks for calling ${cn}, this is the Margen assistant — how can I help you today?`
  }, [greeting, companyName])

  const flowPreview = useMemo(() => {
    return steps
      .map((s, idx) => `${idx + 1}. ${s.question} (${s.response_type.replaceAll('_', ' ')})`)
      .join('\n')
  }, [steps])

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setSteps((items) => {
      const activeId = String(active.id)
      const overId = String(over.id)
      const oldIndex = items.findIndex((i) => i.id === activeId)
      const newIndex = items.findIndex((i) => i.id === overId)
      if (oldIndex < 0 || newIndex < 0) return items
      return arrayMove(items, oldIndex, newIndex)
    })
  }

  function addStep() {
    setSteps((s) => [...s, { id: uid(), question: '', response_type: 'open_text' }])
  }

  async function saveAndDeploy() {
    if (!user) return
    setBusy(true)
    setError(null)
    setDeployNote(null)
    const payload = {
      company_name: companyName.trim() || null,
      greeting_message: greeting.trim() || null,
      sign_off_message: signOff.trim() || null,
      flow_steps: steps,
      voice_id: voiceId || null,
      business_hours: { enabled: hoursEnabled, days: hoursByDay },
      after_hours_message: afterHoursMsg.trim() || null,
      escalation_rules: {
        emergency_sms: escEmergencySms,
        human_transfer: escHumanTransfer,
        unsure_callback: escUnsureCallback,
      },
    }
    const { error: fnErr, warnings } = await deployAiReceptionistRetell(supabase, user.id, payload)
    if (fnErr) setError(fnErr.message)
    else {
      setDeployNote(
        [warnings.length ? warnings.join(' ') : null, 'AI receptionist deployed to Retell.'].filter(Boolean).join(' '),
      )
    }
    setBusy(false)
  }

  async function testCall() {
    setBusy(true)
    setError(null)
    const { error: fnErr } = await retellTestCallDemo(supabase)
    if (fnErr) setError(fnErr.message)
    setBusy(false)
  }

  return (
    <div className="mx-auto max-w-5xl">
      <motion.div
        className="mb-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.29, ease: easePremium, delay: 0.028 }}
      >
        <h1 className="page-title">AI Receptionist</h1>
        <p className="mt-1 text-sm leading-relaxed text-[#555555]">
          Customize your call experience and deploy to Retell (shared Margen account). Call webhooks include{' '}
          <code className="rounded bg-[var(--color-margen-surface)] px-1 py-0.5 text-xs">metadata.owner_id</code> on test
          calls, and every owner has a unique <code className="rounded bg-[var(--color-margen-surface)] px-1 py-0.5 text-xs">retell_agent_id</code> on their profile for n8n routing.
        </p>
      </motion.div>

      <AnimatePresence mode="wait">
        {error ? (
          <motion.p
            key="err"
            className="mb-4 text-sm text-danger"
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: 0.22, ease: easePremium }}
          >
            {error}
          </motion.p>
        ) : null}
        {deployNote && !error ? (
          <motion.p
            key="note"
            className="mb-4 rounded-md px-3 py-2 text-sm alert-success"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: 0.22, ease: easePremium }}
          >
            {deployNote}
          </motion.p>
        ) : null}
      </AnimatePresence>

      {loading ? (
        <div className="space-y-4">
          <div className="animate-pulse space-y-3 rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] p-4">
            <div className="h-4 w-40 rounded bg-[var(--color-margen-border)]" />
            <div className="h-10 w-full rounded-md bg-[var(--color-margen-border)]" />
            <div className="h-10 w-full rounded-md bg-[var(--color-margen-border)]" />
          </div>
          <div className="animate-pulse rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] p-4">
            <div className="h-4 w-48 rounded bg-[var(--color-margen-border)]" />
            <div className="mt-4 h-24 w-full rounded-md bg-[var(--color-margen-border)]" />
          </div>
          <div className="animate-pulse rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] p-4">
            <div className="h-4 w-36 rounded bg-[var(--color-margen-border)]" />
            <div className="mt-3 h-20 max-w-xs rounded-md bg-[var(--color-margen-border)]" />
          </div>
        </div>
      ) : (
        <div className="space-y-10">
          <section>
            <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">Basic</h2>
            <div className="mt-3 space-y-3 rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
                    Company name
                  </label>
                  <input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="mt-2 w-full rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2 text-sm text-[var(--color-margen-text)] outline-none focus:border-[var(--margen-accent)]"
                    placeholder="Your company"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
                    Greeting message
                  </label>
                  <input
                    value={greeting}
                    onChange={(e) => setGreeting(e.target.value)}
                    className="mt-2 w-full rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2 text-sm text-[var(--color-margen-text)] outline-none focus:border-[var(--margen-accent)]"
                    placeholder="Thanks for calling…"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
                  Sign off message
                </label>
                <input
                  value={signOff}
                  onChange={(e) => setSignOff(e.target.value)}
                  className="mt-2 w-full rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2 text-sm text-[var(--color-margen-text)] outline-none focus:border-[var(--margen-accent)]"
                  placeholder="Thanks for calling — we’ll be in touch shortly."
                />
              </div>

              <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface)] px-3 py-3">
                <div>
                  <p className="text-sm font-medium text-[var(--color-margen-text)]">Greeting preview</p>
                  <p className="mt-1 text-sm text-[var(--color-margen-muted)]">{previewGreeting}</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(previewGreeting).catch(() => null)}
                  className="rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2 text-sm font-medium text-[var(--color-margen-text)] hover:bg-[var(--color-margen-hover)]"
                >
                  Copy
                </button>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">Call flow builder</h2>
              <button
                type="button"
                onClick={addStep}
                className="rounded-md bg-[var(--margen-accent)] px-3 py-2 text-sm font-semibold text-white"
              >
                Add step
              </button>
            </div>

            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                  <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                    {steps.map((s) => (
                      <StepCard
                        key={s.id}
                        step={s}
                        onChange={(patch) =>
                          setSteps((prev) => prev.map((p) => (p.id === s.id ? { ...p, ...patch } : p)))
                        }
                        onDelete={() => setSteps((prev) => prev.filter((p) => p.id !== s.id))}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>

              <div className="rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] p-4">
                <p className="text-sm font-semibold text-[var(--color-margen-text)]">Flow preview</p>
                <pre className="mt-3 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface)] p-3 text-xs text-[var(--color-margen-text)]">
                  {flowPreview}
                </pre>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">Voice (Retell)</h2>
            <div className="mt-3 space-y-3">
              <button
                type="button"
                onClick={() => {
                  setVoiceModalError(null)
                  const cached = getRetellVoicesCache()
                  setVoiceModalLoading(!cached?.length)
                  setVoicePickerOpen(true)
                }}
                className="rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-4 py-3 text-left text-sm font-semibold text-[var(--margen-accent)] hover:bg-[var(--color-margen-hover)]"
              >
                Choose voice
              </button>

              {voiceId ? (
                <div className="rounded-lg border border-[var(--margen-accent)] bg-[var(--margen-accent-muted)] p-4">
                  {selectedVoice ? (
                    <>
                      <p className="text-sm font-semibold text-[var(--color-margen-text)]">{selectedVoice.voice_name}</p>
                      <p className="mt-1 text-xs text-[var(--color-margen-muted)]">
                        {selectedVoice.gender} · {selectedVoice.accent}
                      </p>
                      {selectedVoice.preview_audio_url ? (
                        <audio className="mt-3 w-full max-w-md" controls preload="none" src={selectedVoice.preview_audio_url} />
                      ) : (
                        <p className="mt-2 text-xs text-[var(--color-margen-muted)]">No preview URL for this voice.</p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-[var(--color-margen-text)]">Voice selected</p>
                      <p className="mt-1 break-all font-mono text-xs text-[var(--color-margen-muted)]">{voiceId}</p>
                      <p className="mt-2 text-xs text-[var(--color-margen-muted)]">
                        Open &quot;Choose voice&quot; once to load names and previews from Retell.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-sm text-[var(--color-margen-muted)]">No voice selected yet — pick one before deploy.</p>
              )}
            </div>
          </section>

          <VoicePickerModal
            open={voicePickerOpen}
            onClose={() => {
              setVoicePickerOpen(false)
              setVoiceModalLoading(false)
            }}
            voices={voiceModalLoading ? undefined : getRetellVoicesCache() ?? []}
            loadError={voiceModalError}
            selectedVoiceId={voiceId}
            onSelect={(v) => {
              setVoiceId(v.voice_id)
              setVoiceListTick((n) => n + 1)
            }}
          />

          <section>
            <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">Business hours</h2>
            <div className="mt-3 rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[var(--color-margen-text)]">Enable business hours</p>
                  <p className="mt-1 text-xs text-[var(--color-margen-muted)]">
                    Outside open hours, the agent uses the after-hours message.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setHoursEnabled((v) => !v)}
                  className={[
                    'rounded-md border px-3 py-1.5 text-xs font-medium',
                    hoursEnabled
                      ? 'border-[var(--margen-accent)] bg-[var(--margen-accent-muted)] text-[var(--margen-accent)]'
                      : 'border-[var(--color-margen-border)] text-[var(--color-margen-muted)] hover:bg-[var(--color-margen-hover)] hover:text-[var(--color-margen-text)]',
                  ].join(' ')}
                >
                  {hoursEnabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              <div className="mt-4 space-y-2">
                {(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const).map((d) => (
                  <div key={d} className="grid items-center gap-2 sm:grid-cols-[90px_1fr_1fr_90px]">
                    <p className="text-sm font-medium text-[var(--color-margen-text)] uppercase">{d}</p>
                    <input
                      value={hoursByDay[d].open}
                      onChange={(e) => setHoursByDay((p) => ({ ...p, [d]: { ...p[d], open: e.target.value } }))}
                      className="w-full rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2 font-mono text-sm text-[var(--color-margen-text)] outline-none focus:border-[var(--margen-accent)]"
                      placeholder="09:00"
                      disabled={!hoursByDay[d].enabled}
                    />
                    <input
                      value={hoursByDay[d].close}
                      onChange={(e) => setHoursByDay((p) => ({ ...p, [d]: { ...p[d], close: e.target.value } }))}
                      className="w-full rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2 font-mono text-sm text-[var(--color-margen-text)] outline-none focus:border-[var(--margen-accent)]"
                      placeholder="17:00"
                      disabled={!hoursByDay[d].enabled}
                    />
                    <button
                      type="button"
                      onClick={() => setHoursByDay((p) => ({ ...p, [d]: { ...p[d], enabled: !p[d].enabled } }))}
                      className={[
                        'rounded-md border px-3 py-2 text-xs font-medium',
                        hoursByDay[d].enabled
                          ? 'border-[var(--margen-accent)] bg-[var(--margen-accent-muted)] text-[var(--margen-accent)]'
                          : 'border-[var(--color-margen-border)] text-[var(--color-margen-muted)] hover:bg-[var(--color-margen-hover)] hover:text-[var(--color-margen-text)]',
                      ].join(' ')}
                    >
                      {hoursByDay[d].enabled ? 'On' : 'Off'}
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <label className="block text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
                  After-hours message
                </label>
                <input
                  value={afterHoursMsg}
                  onChange={(e) => setAfterHoursMsg(e.target.value)}
                  className="mt-2 w-full rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2 text-sm text-[var(--color-margen-text)] outline-none focus:border-[var(--margen-accent)]"
                  placeholder="Thanks for calling — we’re closed right now…"
                />
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">Escalation rules</h2>
            <div className="mt-3 grid gap-3 rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] p-4 sm:grid-cols-3">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={escEmergencySms}
                  onChange={(e) => setEscEmergencySms(e.target.checked)}
                />
                <span className="text-sm text-[var(--color-margen-text)]">
                  If caller mentions <span className="font-semibold">emergency</span> → text owner immediately
                </span>
              </label>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={escHumanTransfer}
                  onChange={(e) => setEscHumanTransfer(e.target.checked)}
                />
                <span className="text-sm text-[var(--color-margen-text)]">
                  If caller asks for a <span className="font-semibold">human</span> → transfer to owner
                </span>
              </label>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={escUnsureCallback}
                  onChange={(e) => setEscUnsureCallback(e.target.checked)}
                />
                <span className="text-sm text-[var(--color-margen-text)]">
                  If AI is <span className="font-semibold">unsure</span> → offer callback
                </span>
              </label>
            </div>
          </section>

          <section>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void testCall()}
                className="rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-4 py-2 text-sm font-semibold text-[var(--color-margen-text)] hover:bg-[var(--color-margen-hover)] disabled:opacity-60"
              >
                Test Call
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveAndDeploy()}
                className="rounded-md bg-[var(--margen-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Save &amp; Deploy
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

