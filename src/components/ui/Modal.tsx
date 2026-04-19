import { useEffect, useId, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { easePremium, transitionOverlay } from '../../lib/motion'

type ModalProps = {
  open: boolean
  onClose: () => void
  title?: string
  /** Tailwind max-width etc. for the dialog panel */
  panelClassName?: string
  children: ReactNode
}

export function Modal({ open, onClose, title, panelClassName, children }: ModalProps) {
  const titleId = useId()
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="presentation">
          <motion.button
            type="button"
            aria-label="Close dialog"
            className="absolute inset-0 bg-black/25"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transitionOverlay}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            className={`relative z-10 w-full rounded-xl border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] p-6 ${panelClassName ?? 'max-w-md'}`}
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.27, ease: easePremium }}
            onClick={(e) => e.stopPropagation()}
          >
            {title ? (
              <h2 id={titleId} className="text-lg font-semibold text-[var(--color-margen-text)]">
                {title}
              </h2>
            ) : null}
            <div className={title ? 'mt-4' : ''}>{children}</div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
