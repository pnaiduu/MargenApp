import QRCode from 'react-qr-code'
import { useEffect, useState, type FormEvent } from 'react'
import { Modal } from '../ui/Modal'
import { supabase } from '../../lib/supabase'
import { inviteAppDeepLink, inviteJoinAbsoluteUrl } from '../../lib/inviteUrl'
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
  // 6-char uppercase invite code (also used as the invite token)
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let out = ''
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]!
  return out
}

export function TechnicianInviteModal({
  open,
  onClose,
  ownerId,
  onCreated,
  inviteBlockedReason,
  existingInvite,
}: {
  open: boolean
  onClose: () => void
  ownerId: string
  onCreated: () => void
  /** When set, invite submit is blocked and this message is shown */
  inviteBlockedReason?: string | null
  /** Re-open share step for an existing pending invite */
  existingInvite?: {
    token: string
    invitedName: string
    invitedPhone?: string | null
    role: string
  } | null
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
  const appDeepLink = token ? inviteAppDeepLink(token) : ''
  const inviteCode = token ?? ''

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

  useEffect(() => {
    if (!open) return
    if (existingInvite) {
      setToken(existingInvite.token)
      setName(existingInvite.invitedName)
      setPhone(existingInvite.invitedPhone ?? '')
      setRole(existingInvite.role)
      setInvitedPhone(existingInvite.invitedPhone ?? '')
      setStep('share')
      setError(null)
      setCopied(false)
    } else {
      reset()
    }
  }, [open, existingInvite])

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
        status: 'pending',
      })
      .select('id')
      .single()

    if (tErr || !tech) {
      setSubmitting(false)
      const msg = tErr?.message ?? 'Could not create technician.'
      setError(/plan limit reached/i.test(msg) ? 'Plan limit reached. Upgrade your subscription to add more technicians.' : msg)
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

  async function copyCode() {
    if (!inviteCode) return
    try {
      await navigator.clipboard.writeText(inviteCode)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy to clipboard.')
    }
  }

  function sendViaText() {
    if (!inviteCode) return
    const body = encodeURIComponent(
      `Your Margen invite code is: ${inviteCode}\n\nOpen in the app: ${appDeepLink}\nBackup link: ${inviteUrl}`,
    )
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
      title={
        step === 'form'
          ? 'Invite technician'
          : existingInvite
            ? 'Technician invite'
            : "Send invite to technician's phone"
      }
      panelClassName={step === 'share' ? 'max-w-lg' : 'max-w-md'}
    >
      {step === 'form' ? (
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          {inviteBlockedReason ? (
            <p className="rounded-md border px-3 py-2 text-sm alert-warning">{inviteBlockedReason}</p>
          ) : null}
          <p className="text-sm text-[var(--color-margen-muted)]">
            They&apos;ll appear as <span className="font-medium text-[var(--color-margen-text)]">Pending</span> until they
            join via the Margen technician app using their invite code.
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
            Read this invite code to your technician (or text it to them). They&apos;ll enter it when creating their Margen
            account.
          </p>
          <div className="rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">Invite code</p>
            <div className="mt-2 flex flex-col items-center gap-3">
              <p className="select-all font-mono text-4xl font-extrabold tracking-[0.28em] text-[var(--color-margen-text)]">
                {inviteCode}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <motion.button
                  type="button"
                  onClick={() => void copyCode()}
                  className="rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface)] px-3 py-1.5 text-xs font-medium text-[var(--margen-accent)] hover:bg-[var(--color-margen-hover)]"
                  whileTap={tapButton}
                  transition={{ duration: 0.14, ease: easePremium }}
                >
                  {copied ? 'Copied' : 'Copy code'}
                </motion.button>
                <motion.button
                  type="button"
                  onClick={sendViaText}
                  className="rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface)] px-3 py-1.5 text-xs font-medium text-[var(--margen-accent)] hover:bg-[var(--color-margen-hover)]"
                  whileTap={tapButton}
                  transition={{ duration: 0.14, ease: easePremium }}
                >
                  Send invite to technician&apos;s phone
                </motion.button>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">QR code</p>
            <div className="rounded-lg border border-[var(--color-margen-border)] bg-white p-3">
              {appDeepLink ? <QRCode value={appDeepLink} size={176} /> : null}
            </div>
            <p className="text-xs text-[var(--color-margen-muted)]">
              They can scan this in the Margen app to fill the invite code automatically.
            </p>
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
