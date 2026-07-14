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

  function closeMobile() {
    setMobileOpen(false)
    setMobileServicesOpen(false)
    setMobileCompanyOpen(false)
  }

  useEffect(() => {
    setMobileOpen(false)
    setMobileServicesOpen(false)
    setMobileCompanyOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!mobileOpen) return

    document.body.style.overflow = 'hidden'

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeMobile()
    }
    window.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
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
        <Link href="/" className="nav-logo" onClick={closeMobile}>
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
          aria-controls="mobile-nav-panel"
          onClick={() => setMobileOpen((o) => !o)}
        >
          <span aria-hidden />
          <span aria-hidden />
          <span aria-hidden />
        </button>
      </div>

      {/* Backdrop */}
      <button
        type="button"
        className={`nav__backdrop${mobileOpen ? ' nav__backdrop--open' : ''}`}
        aria-label="Close menu"
        tabIndex={mobileOpen ? 0 : -1}
        onClick={closeMobile}
      />

      {/* Mobile drawer */}
      <div
        id="mobile-nav-panel"
        className={`nav__mobile${mobileOpen ? ' nav__mobile--open' : ''}`}
        aria-hidden={!mobileOpen}
      >
        <nav className="nav__mobile-inner" aria-label="Mobile">
          <Link href="/" className="nav__mobile-link" onClick={closeMobile}>
            Home
          </Link>

          <div className="nav__mobile-group">
            <button
              type="button"
              className={`nav__mobile-link nav__mobile-trigger${mobileServicesOpen ? ' nav__mobile-trigger--open' : ''}`}
              aria-expanded={mobileServicesOpen}
              onClick={() => setMobileServicesOpen((o) => !o)}
            >
              Services
              <span className="nav__chevron" aria-hidden>
                {mobileServicesOpen ? '▴' : '▾'}
              </span>
            </button>
            <div className={`nav__mobile-sub${mobileServicesOpen ? ' nav__mobile-sub--open' : ''}`}>
              {SERVICES_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="nav__mobile-sublink"
                  onClick={closeMobile}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="nav__mobile-group">
            <button
              type="button"
              className={`nav__mobile-link nav__mobile-trigger${mobileCompanyOpen ? ' nav__mobile-trigger--open' : ''}`}
              aria-expanded={mobileCompanyOpen}
              onClick={() => setMobileCompanyOpen((o) => !o)}
            >
              Company
              <span className="nav__chevron" aria-hidden>
                {mobileCompanyOpen ? '▴' : '▾'}
              </span>
            </button>
            <div className={`nav__mobile-sub${mobileCompanyOpen ? ' nav__mobile-sub--open' : ''}`}>
              {COMPANY_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="nav__mobile-sublink"
                  onClick={closeMobile}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <Link href="/careers" className="nav__mobile-link" onClick={closeMobile}>
            Careers
          </Link>

          <Link
            href="/quote-builder"
            className="btn btn--accent nav__mobile-cta"
            onClick={closeMobile}
          >
            Get a Quote
          </Link>
        </nav>
      </div>
    </header>
  )
}
