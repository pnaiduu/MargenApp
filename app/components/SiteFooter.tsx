import Link from 'next/link'
import {
  CALENDLY,
  CONTACT_EMAIL,
  FOOTER_LINKS,
  LOGO,
  SITE_DOMAIN,
  SITE_LOCATION,
  SITE_PHONE,
  SITE_PHONE_DISPLAY,
} from '../../lib/site'

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="footer__brand">
        <Link href="/" className="footer__logo">
          <img src={LOGO} alt="Margen" height={40} />
        </Link>
        <p className="footer__tagline">
          {SITE_LOCATION} ·{' '}
          <a href={`https://${SITE_DOMAIN}`} target="_blank" rel="noopener noreferrer">
            {SITE_DOMAIN}
          </a>
        </p>
        {SITE_PHONE ? (
          <p className="footer__phone">
            <a href={`tel:${SITE_PHONE.replace(/\D/g, '')}`}>{SITE_PHONE_DISPLAY}</a>
          </p>
        ) : (
          <p className="footer__phone">
            <a href={CALENDLY} target="_blank" rel="noopener noreferrer">
              Book a free audit
            </a>
            {' · '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
        )}
      </div>

      <nav className="footer__nav" aria-label="Footer">
        {FOOTER_LINKS.map((link) => (
          <Link key={link.href} href={link.href}>
            {link.label}
          </Link>
        ))}
      </nav>

      <p className="footer__copy">© {new Date().getFullYear()} Margen</p>
    </footer>
  )
}
