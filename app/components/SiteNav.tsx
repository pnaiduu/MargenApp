const CALENDLY = 'https://calendly.com/davynaidu/30min'

type SiteNavProps = {
  logoSrc?: string
}

export function SiteNav({ logoSrc = '/margen-logo.png' }: SiteNavProps) {
  return (
    <header className="nav">
      <a href="/" className="nav-logo">
        <img src={logoSrc} alt="Margen" height={44} />
      </a>
      <a href={CALENDLY} target="_blank" rel="noopener noreferrer" className="btn btn--accent">
        Book a free audit
      </a>
    </header>
  )
}
