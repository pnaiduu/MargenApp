import Link from 'next/link'

export function SiteFooter() {
  return (
    <footer className="footer">
      <span>Margen · Allen, Texas · trymargen.com</span>
      <nav className="footer-nav" aria-label="Footer">
        <Link href="/careers">Join the team</Link>
      </nav>
      <span>© 2026 Margen</span>
    </footer>
  )
}
