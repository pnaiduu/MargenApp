const CALENDLY = 'https://calendly.com/davynaidu/30min'

export function SiteNav() {
  return (
    <header className="nav">
      <a href="/" className="nav-logo">
        Margen
      </a>
      <a href={CALENDLY} target="_blank" rel="noopener noreferrer" className="btn btn--accent">
        Book a free audit
      </a>
    </header>
  )
}
