import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { easePremium, tapButton, transitionOverlay } from '../../lib/motion'
import { useAuth } from '../../contexts/useAuth'

type NotifRow = {
  id: string
  type: string | null
  title: string
  message: string | null
  link: string | null
  read: boolean
  created_at: string
}

function formatWhen(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function NotificationsBell() {
  const { user } = useAuth()
  /** Unique Realtime topic per mount so React Strict Mode / fast remounts never reuse a subscribed channel. */
  const realtimeTopicSeq = useRef(0)
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<NotifRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const unread = useMemo(() => rows.filter((r) => !r.read).length, [rows])

  const load = useCallback(async () => {
    if (!user) return
    setError(null)
    const { data, error: qErr } = await supabase
      .from('notifications')
      .select('id, type, title, message, link, read, created_at')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
      .limit(40)
    if (qErr) {
      setError(qErr.message)
      setRows([])
      return
    }
    setRows((data ?? []) as NotifRow[])
  }, [user])

  useEffect(() => {
    if (!user) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()

    realtimeTopicSeq.current += 1
    const topic = `notifications:${user.id}:${realtimeTopicSeq.current}`
    const channel = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `owner_id=eq.${user.id}` },
        () => void load(),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user, load])

  async function markAllRead() {
    if (!user) return
    setBusy(true)
    setError(null)
    const { error: upErr } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('owner_id', user.id)
      .eq('read', false)
    if (upErr) setError(upErr.message)
    await load()
    setBusy(false)
  }

  async function markRead(id: string) {
    if (!user) return
    const { error: upErr } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('owner_id', user.id)
    if (upErr) setError(upErr.message)
  }

  return (
    <>
      <motion.button
        type="button"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--color-margen-border)] text-[var(--color-margen-text)] hover:bg-[var(--color-margen-hover)]"
        aria-label="Notifications"
        onClick={() => setOpen(true)}
        whileTap={tapButton}
        transition={{ duration: 0.14, ease: easePremium }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 22a2.2 2.2 0 0 0 2.2-2.2H9.8A2.2 2.2 0 0 0 12 22Zm7-6V11a7 7 0 1 0-14 0v5l-2 2v1h18v-1l-2-2Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--margen-accent)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--margen-accent-fg)]">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </motion.button>

      <AnimatePresence>
        {open ? (
          <>
            <motion.button
              key="notif-backdrop"
              type="button"
              className="fixed inset-0 z-[60] bg-black/20"
              aria-label="Close notifications"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={transitionOverlay}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              key="notif-panel"
              className="fixed right-0 top-0 z-[70] h-dvh w-[360px] max-w-[92vw] border-l border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] shadow-xl"
              initial={{ x: 380 }}
              animate={{ x: 0 }}
              exit={{ x: 380 }}
              transition={{ duration: 0.28, ease: easePremium }}
            >
              <div className="flex items-center justify-between gap-3 border-b border-[var(--color-margen-border)] px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-margen-text)]">Notifications</p>
                  <p className="text-xs text-[var(--color-margen-muted)]">{unread} unread</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busy || unread === 0}
                    onClick={() => void markAllRead()}
                    className="rounded-md border border-[var(--color-margen-border)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-margen-text)] hover:bg-[var(--color-margen-hover)] disabled:opacity-60"
                  >
                    Mark all as read
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-md border border-[var(--color-margen-border)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-margen-text)] hover:bg-[var(--color-margen-hover)]"
                  >
                    Close
                  </button>
                </div>
              </div>

              {error ? <p className="px-4 py-3 text-sm text-danger">{error}</p> : null}

              <div className="h-[calc(100dvh-56px)] overflow-y-auto">
                {rows.length === 0 ? (
                  <p className="px-4 py-10 text-center text-sm text-[var(--color-margen-muted)]">
                    No notifications yet.
                  </p>
                ) : (
                  <ul className="divide-y divide-[var(--color-margen-border)]">
                    {rows.map((n) => {
                      const content = (
                        <div className="flex items-start gap-3 px-4 py-3">
                          <span
                            className={[
                              'mt-1 inline-flex h-2 w-2 shrink-0 rounded-full',
                              n.read ? 'bg-[var(--color-margen-border)]' : 'bg-[var(--margen-accent)]',
                            ].join(' ')}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[var(--color-margen-text)]">{n.title}</p>
                            {n.message ? <p className="mt-0.5 text-sm text-[var(--color-margen-muted)]">{n.message}</p> : null}
                            <p className="mt-1 text-xs text-[var(--color-margen-muted)]">{formatWhen(n.created_at)}</p>
                          </div>
                        </div>
                      )

                      return (
                        <li key={n.id} onClick={() => void markRead(n.id)} className="hover:bg-[var(--color-margen-hover)]">
                          {n.link ? (
                            <Link to={n.link} onClick={() => setOpen(false)} className="block">
                              {content}
                            </Link>
                          ) : (
                            <div>{content}</div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  )
}
