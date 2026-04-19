import { type MouseEvent, type ReactNode } from 'react'
import { useHref, useNavigate } from 'react-router-dom'

type Props = {
  to: string
  state?: unknown
  replace?: boolean
  className?: string
  children: ReactNode
}

/**
 * In-app navigation that avoids full document loads. Use when a plain {@link Link} misbehaves
 * (e.g. feels like a full reload) while keeping a real href for middle‑click / accessibility.
 */
export function SpaLink({ to, state, replace, className, children }: Props) {
  const navigate = useNavigate()
  const href = useHref(to)
  return (
    <a
      href={href}
      className={className}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
        if (e.defaultPrevented) return
        e.preventDefault()
        navigate(to, { state, replace })
      }}
    >
      {children}
    </a>
  )
}
