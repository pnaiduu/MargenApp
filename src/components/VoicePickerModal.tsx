import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { RetellVoiceRow } from '../lib/retellDeploy'
import { easePremium } from '../lib/motion'

export type VoiceFilterTab = 'all' | 'male' | 'female' | 'american' | 'british' | 'australian'

const TABS: { id: VoiceFilterTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
  { id: 'american', label: 'American' },
  { id: 'british', label: 'British' },
  { id: 'australian', label: 'Australian' },
]

const PAGE = 12

function genderNorm(g: string) {
  return g.trim().toLowerCase()
}

function matchesTab(v: RetellVoiceRow, tab: VoiceFilterTab): boolean {
  if (tab === 'all') return true
  const g = genderNorm(v.gender)
  const a = v.accent.trim().toLowerCase()
  const blob = `${v.voice_id} ${v.voice_name}`.toLowerCase()
  if (tab === 'male') return (g.includes('male') && !g.includes('female')) || g === 'm'
  if (tab === 'female') return g.includes('female') || g === 'f'
  if (tab === 'american') return a.includes('american') || (a === 'general' && /\b(us|american)\b/.test(blob))
  if (tab === 'british') return a.includes('british') || a.includes('uk') || /\b(british|uk)\b/.test(blob)
  if (tab === 'australian') return a.includes('australian') || a.includes('australia') || /\b(aus|australian)\b/.test(blob)
  return true
}

function matchesSearch(v: RetellVoiceRow, q: string): boolean {
  if (!q.trim()) return true
  const s = q.trim().toLowerCase()
  return (
    v.voice_name.toLowerCase().includes(s) ||
    v.voice_id.toLowerCase().includes(s) ||
    v.gender.toLowerCase().includes(s) ||
    v.accent.toLowerCase().includes(s) ||
    v.provider.toLowerCase().includes(s)
  )
}

function VoiceRowSkeleton() {
  return (
    <div className="flex animate-pulse items-center gap-3 rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface)] px-3 py-3">
      <div className="h-10 w-10 shrink-0 rounded-full bg-[var(--color-margen-border)]" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-4 w-[66%] max-w-[200px] rounded bg-[var(--color-margen-border)]" />
        <div className="h-3 w-[45%] max-w-[140px] rounded bg-[var(--color-margen-border)]" />
      </div>
      <div className="h-9 w-9 shrink-0 rounded-md bg-[var(--color-margen-border)]" />
    </div>
  )
}

export function VoicePickerModal({
  open,
  onClose,
  voices,
  loadError,
  selectedVoiceId,
  onSelect,
}: {
  open: boolean
  onClose: () => void
  /** `undefined` = still loading; array (possibly empty) = finished loading */
  voices: RetellVoiceRow[] | undefined
  loadError: string | null
  selectedVoiceId: string
  onSelect: (v: RetellVoiceRow) => void
}) {
  const [tab, setTab] = useState<VoiceFilterTab>('all')
  const [search, setSearch] = useState('')
  const [visible, setVisible] = useState(PAGE)
  const [playingUrl, setPlayingUrl] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (!open) return
    setTab('all')
    setSearch('')
    setVisible(PAGE)
    setPlayingUrl(null)
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }
  }, [open])

  const filtered = useMemo(() => {
    if (voices === undefined) return []
    return voices.filter((v) => matchesTab(v, tab) && matchesSearch(v, search))
  }, [voices, tab, search])

  const slice = useMemo(() => filtered.slice(0, visible), [filtered, visible])

  const togglePreview = useCallback((url: string | undefined) => {
    if (!url) return
    const el = audioRef.current
    if (!el) return
    if (playingUrl === url) {
      el.pause()
      setPlayingUrl(null)
      return
    }
    el.src = url
    void el.play().catch(() => null)
    setPlayingUrl(url)
  }, [playingUrl])

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const onEnded = () => setPlayingUrl(null)
    el.addEventListener('ended', onEnded)
    return () => el.removeEventListener('ended', onEnded)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="voice-picker-layer"
          className="fixed inset-0 z-[200]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: easePremium }}
        >
          <button
            type="button"
            aria-label="Close voice picker"
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="voice-picker-title"
            className="absolute left-1/2 top-1/2 z-[1] flex max-h-[min(90vh,720px)] w-[min(100vw-24px,480px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] shadow-xl"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-margen-border)] px-4 py-3">
              <h2 id="voice-picker-title" className="text-base font-semibold text-[var(--color-margen-text)]">
                Choose voice
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-2 py-1 text-sm font-medium text-[var(--color-margen-muted)] hover:bg-[var(--color-margen-hover)] hover:text-[var(--color-margen-text)]"
              >
                Done
              </button>
            </div>

            <div className="shrink-0 border-b border-[var(--color-margen-border)] px-3 py-2">
              <div className="flex flex-wrap gap-1">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTab(t.id)
                      setVisible(PAGE)
                    }}
                    className={[
                      'rounded-full px-2.5 py-1 text-xs font-medium',
                      tab === t.id
                        ? 'bg-[var(--margen-accent)] text-white'
                        : 'bg-[var(--color-margen-surface)] text-[var(--color-margen-muted)] hover:text-[var(--color-margen-text)]',
                    ].join(' ')}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <label className="sr-only" htmlFor="voice-search">
                Search voices
              </label>
              <input
                id="voice-search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setVisible(PAGE)
                }}
                placeholder="Search by name, accent, gender…"
                className="mt-2 w-full rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface)] px-3 py-2 text-sm text-[var(--color-margen-text)] outline-none focus:border-[var(--margen-accent)]"
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              <audio ref={audioRef} className="hidden" preload="none" />
              {loadError ? (
                <p className="text-center text-sm text-danger" role="alert">
                  {loadError}
                </p>
              ) : voices === undefined ? (
                <div className="space-y-2">
                  {Array.from({ length: PAGE }).map((_, i) => (
                    <VoiceRowSkeleton key={i} />
                  ))}
                </div>
              ) : voices.length === 0 ? (
                <p className="py-8 text-center text-sm text-[var(--color-margen-muted)]">No voices returned from Retell.</p>
              ) : filtered.length === 0 ? (
                <p className="py-8 text-center text-sm text-[var(--color-margen-muted)]">No voices match your filters.</p>
              ) : (
                <ul className="space-y-2">
                  {slice.map((v) => {
                    const selected = selectedVoiceId === v.voice_id
                    const hasPreview = Boolean(v.preview_audio_url)
                    const isPlaying = Boolean(v.preview_audio_url && playingUrl === v.preview_audio_url)
                    return (
                      <li key={v.voice_id}>
                        <div
                          className={[
                            'flex items-center gap-3 rounded-lg border px-3 py-3',
                            selected
                              ? 'border-[var(--margen-accent)] bg-[var(--margen-accent-muted)]'
                              : 'border-[var(--color-margen-border)] bg-[var(--color-margen-surface)]',
                          ].join(' ')}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-[var(--color-margen-text)]">{v.voice_name}</p>
                            <p className="mt-0.5 truncate text-xs text-[var(--color-margen-muted)]">
                              {v.gender} · {v.accent}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={!hasPreview}
                            title={hasPreview ? 'Preview' : 'No preview'}
                            aria-label={`Play preview for ${v.voice_name}`}
                            onClick={() => togglePreview(v.preview_audio_url)}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] text-[var(--color-margen-text)] hover:bg-[var(--color-margen-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {isPlaying ? (
                              <span className="text-xs font-bold">■</span>
                            ) : (
                              <span className="text-lg leading-none">▶</span>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onSelect(v)
                              onClose()
                            }}
                            className="shrink-0 rounded-lg bg-[var(--margen-accent)] px-3 py-2 text-xs font-semibold text-white"
                          >
                            {selected ? 'Selected' : 'Use'}
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {voices !== undefined && voices.length > 0 && filtered.length > visible ? (
              <div className="shrink-0 border-t border-[var(--color-margen-border)] px-3 py-3">
                <button
                  type="button"
                  onClick={() => setVisible((n) => n + PAGE)}
                  className="w-full rounded-lg border border-[var(--color-margen-border)] py-2 text-sm font-semibold text-[var(--color-margen-text)] hover:bg-[var(--color-margen-hover)]"
                >
                  Load more ({filtered.length - visible} left)
                </button>
              </div>
            ) : null}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
