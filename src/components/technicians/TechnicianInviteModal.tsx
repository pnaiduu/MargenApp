import { QRCode } from 'react-qr-code'
import { useEffect, useState, type FormEvent } from 'react'
import { Modal } from '../ui/Modal'
import { supabase } from '../../lib/supabase'
import { inviteAppDeepLink } from '../../lib/inviteUrl'
import { easePremium, tapButton } from '../../lib/motion'
import { motion } from 'framer-motion'

type Step = 'form' | 'share'

const INVITE_CODE_LENGTH = 6

function randomInviteToken() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let out = ''
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]!
  return out
}

/** Uppercase display for invite codes; legacy long tokens still copy the full value. */
function formatInviteCode(token: string) {
  return token.trim().toUpperCase()
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
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const appDeepLink = token ? inviteAppDeepLink(token) : ''
  const inviteCode = token ? formatInviteCode(token) : ''

  function reset() {
    setStep('form')
    setName('')
    setPhone('')
    setRole('')
    setToken(null)
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

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={step === 'form' ? 'Add Technician' : 'Technician invite'}
      panelClassName={step === 'share' ? 'max-w-sm w-full mx-4 !p-4' : 'max-w-md w-full mx-4'}
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
              {submitting ? 'Adding…' : 'Add Technician'}
            </motion.button>
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          <p className="text-xs leading-snug text-[var(--color-margen-muted)]">
            Share the code or QR so they can sign up in the Margen app.
          </p>
          <div className="rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">Invite code</p>
            <div className="mt-1.5 max-w-full overflow-hidden">
              <p
                className="select-all break-all text-center font-mono text-2xl font-bold tracking-widest text-[var(--color-margen-text)]"
                style={{ wordBreak: 'break-all' }}
                title={inviteCode}
              >
                {inviteCode}
              </p>
            </div>
            {inviteCode.length > INVITE_CODE_LENGTH ? (
              <p className="mt-1.5 break-all text-center text-xs text-[var(--color-margen-muted)]">
                Legacy invite — add a new technician for a 6-character code.
              </p>
            ) : null}
            <motion.button
              type="button"
              onClick={() => void copyCode()}
              className="mt-2 w-full rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface)] px-3 py-1.5 text-sm font-medium text-[var(--margen-accent)] hover:bg-[var(--color-margen-hover)]"
              whileTap={tapButton}
              transition={{ duration: 0.14, ease: easePremium }}
            >
              {copied ? 'Copied' : 'Copy'}
            </motion.button>
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">QR code</p>
            <div className="mx-auto flex max-h-[160px] max-w-[160px] items-center justify-center overflow-hidden rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] p-1">
              {appDeepLink ? (
                <QRCode
                  value={appDeepLink}
                  size={160}
                  className="h-auto max-h-[160px] max-w-[160px] w-full"
                />
              ) : null}
            </div>
            <p className="text-center text-xs leading-snug text-[var(--color-margen-muted)]">
              Scan to fill the code in the app.
            </p>
          </div>
          {error ? (
            <p className="break-all text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <motion.button
            type="button"
            className="w-full rounded-md border border-transparent bg-[var(--margen-accent)] py-2 text-sm font-semibold text-[var(--margen-accent-fg)] hover:opacity-90"
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
