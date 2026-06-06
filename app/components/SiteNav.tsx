const CALENDLY = 'https://calendly.com/davynaidu/30min'

export function SiteNav() {
  return (
    <header className="nav">
      <a href="/" className="nav-logo">
        <img src="/logo.png" alt="Margen" height={36} />
      </a>
      <a href={CALENDLY} target="_blank" rel="noopener noreferrer" className="btn btn--accent">
        Book a free audit
      </a>
    </header>
  )
}
