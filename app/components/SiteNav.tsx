'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  COMPANY_LINKS,
  LOGO,
  SERVICES_LINKS,
} from '../../lib/site'

type SiteNavProps = {
  logoSrc?: string
}

export function SiteNav({ logoSrc = LOGO }: SiteNavProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mobileServicesOpen, setMobileServicesOpen] = useState(false)
  const [mobileCompanyOpen, setMobileCompanyOpen] = useState(false)

  useEffect(() => {
    setMobileOpen(false)
    setMobileServicesOpen(false)
    setMobileCompanyOpen(false)
  }, [pathname])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  function isServicesActive() {
    return SERVICES_LINKS.some((l) => isActive(l.href))
  }

  function isCompanyActive() {
    return COMPANY_LINKS.some((l) => isActive(l.href))
  }

  return (
    <header className="nav">
      <div className="nav__bar">
        <Link href="/" className="nav-logo" onClick={() => setMobileOpen(false)}>
          <img src={logoSrc} alt="Margen" height={44} />
        </Link>

        <nav className="nav__desktop" aria-label="Main">
          <Link href="/" className={`nav__link${pathname === '/' ? ' nav__link--active' : ''}`}>
            Home
          </Link>

          <div className={`nav__dropdown${isServicesActive() ? ' nav__dropdown--active' : ''}`}>
            <button type="button" className="nav__link nav__dropdown-trigger" aria-haspopup="true">
              Services
              <span className="nav__chevron" aria-hidden>
                ▾
              </span>
            </button>
            <div className="nav__dropdown-panel" role="menu">
              {SERVICES_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav__dropdown-item${isActive(item.href) ? ' nav__dropdown-item--active' : ''}`}
                  role="menuitem"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div className={`nav__dropdown${isCompanyActive() ? ' nav__dropdown--active' : ''}`}>
            <button type="button" className="nav__link nav__dropdown-trigger" aria-haspopup="true">
              Company
              <span className="nav__chevron" aria-hidden>
                ▾
              </span>
            </button>
            <div className="nav__dropdown-panel" role="menu">
              {COMPANY_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav__dropdown-item${isActive(item.href) ? ' nav__dropdown-item--active' : ''}`}
                  role="menuitem"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <Link
            href="/careers"
            className={`nav__link${isActive('/careers') ? ' nav__link--active' : ''}`}
          >
            Careers
          </Link>

          <Link href="/quote-builder" className="btn btn--accent nav__cta">
            Get a Quote
          </Link>
        </nav>

        <button
          type="button"
          className={`nav__toggle${mobileOpen ? ' nav__toggle--open' : ''}`}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((o) => !o)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      <div className={`nav__mobile${mobileOpen ? ' nav__mobile--open' : ''}`} aria-hidden={!mobileOpen}>
        <nav className="nav__mobile-inner" aria-label="Mobile">
          <Link href="/" className="nav__mobile-link" onClick={() => setMobileOpen(false)}>
            Home
          </Link>

          <div className="nav__mobile-group">
            <button
              type="button"
              className="nav__mobile-link nav__mobile-trigger"
              aria-expanded={mobileServicesOpen}
              onClick={() => setMobileServicesOpen((o) => !o)}
            >
              Services
              <span className="nav__chevron" aria-hidden>
                {mobileServicesOpen ? '▴' : '▾'}
              </span>
            </button>
            {mobileServicesOpen ? (
              <div className="nav__mobile-sub">
                {SERVICES_LINKS.map((item) => (
                  <Link key={item.href} href={item.href} className="nav__mobile-sublink" onClick={() => setMobileOpen(false)}>
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          <div className="nav__mobile-group">
            <button
              type="button"
              className="nav__mobile-link nav__mobile-trigger"
              aria-expanded={mobileCompanyOpen}
              onClick={() => setMobileCompanyOpen((o) => !o)}
            >
              Company
              <span className="nav__chevron" aria-hidden>
                {mobileCompanyOpen ? '▴' : '▾'}
              </span>
            </button>
            {mobileCompanyOpen ? (
              <div className="nav__mobile-sub">
                {COMPANY_LINKS.map((item) => (
                  <Link key={item.href} href={item.href} className="nav__mobile-sublink" onClick={() => setMobileOpen(false)}>
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          <Link href="/careers" className="nav__mobile-link" onClick={() => setMobileOpen(false)}>
            Careers
          </Link>

          <Link href="/quote-builder" className="btn btn--accent nav__mobile-cta" onClick={() => setMobileOpen(false)}>
            Get a Quote
          </Link>
        </nav>
      </div>
    </header>
  )
}
