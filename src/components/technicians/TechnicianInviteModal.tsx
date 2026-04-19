import { QRCodeSVG } from 'qrcode.react'
import { useState, type FormEvent } from 'react'
import { Modal } from '../ui/Modal'
import { supabase } from '../../lib/supabase'
import { inviteJoinAbsoluteUrl } from '../../lib/inviteUrl'
import { easePremium, tapButton } from '../../lib/motion'
import { motion } from 'framer-motion'

type Step = 'form' | 'share'

function normalizeSmsPhone(raw: string) {
  const d = raw.replace(/[^\d+]/g, '')
  if (!d) return ''
  if (d.startsWith('+')) return d
  if (d.length === 10) return `+1${d}`
  if (d.length === 11 && d.startsWith('1')) return `+${d}`
  return d.startsWith('1') && d.length === 11 ? `+${d}` : `+${d}`
}

function randomInviteToken() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '')
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`
}

export function TechnicianInviteModal({
  open,
  onClose,
  ownerId,
  onCreated,
  inviteBlockedReason,
}: {
  open: boolean
  onClose: () => void
  ownerId: string
  onCreated: () => void
  /** When set, invite submit is blocked and this message is shown */
  inviteBlockedReason?: string | null
}) {
  const [step, setStep] = useState<Step>('form')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [invitedPhone, setInvitedPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const inviteUrl = token ? inviteJoinAbsoluteUrl(token) : ''

  function reset() {
    setStep('form')
    setName('')
    setPhone('')
    setRole('')
    setToken(null)
    setInvitedPhone('')
    setError(null)
    setCopied(false)
    setSubmitting(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!ownerId) {
      setError('You must be signed in to invite technicians.')
      return
    }
    const n = name.trim()
    const r = role.trim()
    if (!n || !r) {
      setError('Name and role are required.')
      return
    }
    if (inviteBlockedReason) {
      setError(inviteBlockedReason)
      return
    }
    setSubmitting(true)
    const newToken = randomInviteToken()
    const { data: tech, error: tErr } = await supabase
      .from('technicians')
      .insert({
        owner_id: ownerId,
        name: n,
        phone: phone.trim() || null,
        role: r,
        status: 'off_duty',
      })
      .select('id')
      .single()

    if (tErr || !tech) {
      setSubmitting(false)
      setError(tErr?.message ?? 'Could not create technician.')
      return
    }

    const { error: iErr } = await supabase.from('technician_invites').insert({
      owner_id: ownerId,
      technician_id: tech.id,
      token: newToken,
      invited_name: n,
      invited_phone: phone.trim() || null,
      role: r,
    })

    if (iErr) {
      await supabase.from('technicians').delete().eq('id', tech.id)
      setSubmitting(false)
      setError(iErr.message)
      return
    }

    setToken(newToken)
    setInvitedPhone(phone.trim())
    setStep('share')
    setSubmitting(false)
    onCreated()
  }

  async function copyLink() {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy to clipboard.')
    }
  }

  function sendViaText() {
    if (!inviteUrl) return
    const body = encodeURIComponent(`You're invited to Margen — join here: ${inviteUrl}`)
    const smsPhone = normalizeSmsPhone(invitedPhone)
    const href = smsPhone ? `sms:${smsPhone}?&body=${body}` : `sms:&body=${body}`
    const a = document.createElement('a')
    a.href = href
    a.rel = 'noopener noreferrer'
    a.click()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={step === 'form' ? 'Invite technician' : 'Share invite'}
      panelClassName={step === 'share' ? 'max-w-lg' : 'max-w-md'}
    >
      {step === 'form' ? (
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          {inviteBlockedReason ? (
            <p className="rounded-md border px-3 py-2 text-sm alert-warning">{inviteBlockedReason}</p>
          ) : null}
          <p className="text-sm text-[var(--color-margen-muted)]">
            They&apos;ll appear as <span className="font-medium text-[var(--color-margen-text)]">Pending</span> until they
            finish signup.
          </p>
          <div>
            <label htmlFor="inv-name" className="mb-1 block text-xs font-medium text-[var(--color-margen-text)]">
              Name
            </label>
            <input
              id="inv-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface)] px-3 py-2 text-sm text-[var(--color-margen-text)] outline-none focus:border-[var(--margen-accent)]"
              autoComplete="name"
              required
            />
          </div>
          <div>
            <label htmlFor="inv-phone" className="mb-1 block text-xs font-medium text-[var(--color-margen-text)]">
              Phone <span className="font-normal text-[var(--color-margen-muted)]">(optional)</span>
            </label>
            <input
              id="inv-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface)] px-3 py-2 text-sm text-[var(--color-margen-text)] outline-none focus:border-[var(--margen-accent)]"
              autoComplete="tel"
              placeholder="+1 · · ·"
            />
          </div>
          <div>
            <label htmlFor="inv-role" className="mb-1 block text-xs font-medium text-[var(--color-margen-text)]">
              Role
            </label>
            <input
              id="inv-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface)] px-3 py-2 text-sm text-[var(--color-margen-text)] outline-none focus:border-[var(--margen-accent)]"
              placeholder="e.g. Plumber, HVAC Tech, Electrician"
              required
            />
          </div>
          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
            <motion.button
              type="button"
              className="rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-4 py-2 text-sm font-medium text-[var(--color-margen-text)] hover:bg-[var(--color-margen-hover)]"
              onClick={handleClose}
              whileTap={tapButton}
              transition={{ duration: 0.14, ease: easePremium }}
            >
              Cancel
            </motion.button>
            <motion.button
              type="submit"
              disabled={submitting || Boolean(inviteBlockedReason)}
              className="rounded-md border border-transparent bg-[var(--margen-accent)] px-4 py-2 text-sm font-medium text-[var(--margen-accent-fg)] hover:opacity-90 disabled:opacity-60"
              whileTap={submitting ? undefined : tapButton}
              transition={{ duration: 0.14, ease: easePremium }}
            >
              {submitting ? 'Creating…' : 'Create invite'}
            </motion.button>
          </div>
        </form>
      ) : (
        <div className="space-y-5">
          <p className="text-sm text-[var(--color-margen-muted)]">
            Scan the code or share the link. The technician will set their name and password on the next screen.
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div className="shrink-0 rounded-lg border border-[var(--color-margen-border)] bg-white p-3">
              {inviteUrl ? (
                <QRCodeSVG value={inviteUrl} size={168} level="M" marginSize={0} />
              ) : null}
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
                  Invite link
                </p>
                <p className="mt-1 break-all font-mono text-xs text-[var(--color-margen-text)]">{inviteUrl}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <motion.button
                  type="button"
                  onClick={() => void copyLink()}
                  className="rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface)] px-3 py-1.5 text-xs font-medium text-[var(--margen-accent)] hover:bg-[var(--color-margen-hover)]"
                  whileTap={tapButton}
                  transition={{ duration: 0.14, ease: easePremium }}
                >
                  {copied ? 'Copied' : 'Copy invite link'}
                </motion.button>
                <motion.button
                  type="button"
                  onClick={sendViaText}
                  className="rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface)] px-3 py-1.5 text-xs font-medium text-[var(--margen-accent)] hover:bg-[var(--color-margen-hover)]"
                  whileTap={tapButton}
                  transition={{ duration: 0.14, ease: easePremium }}
                >
                  Send via text
                </motion.button>
              </div>
            </div>
          </div>
          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <motion.button
            type="button"
            className="w-full rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] py-2.5 text-sm font-medium text-[var(--color-margen-text)] hover:bg-[var(--color-margen-hover)]"
            onClick={handleClose}
            whileTap={tapButton}
            transition={{ duration: 0.14, ease: easePremium }}
          >
            Done
          </motion.button>
        </div>
      )}
    </Modal>
  )
}
