'use client'

import { QuoteCta } from './QuoteCta'
import { SiteFooter } from './SiteFooter'
import { SiteNav } from './SiteNav'

type PageShellProps = {
  children: React.ReactNode
  showQuoteCta?: boolean
}

export function PageShell({ children, showQuoteCta = true }: PageShellProps) {
  return (
    <div className="page">
      <SiteNav />
      {children}
      {showQuoteCta ? <QuoteCta /> : null}
      <SiteFooter />
    </div>
  )
}
