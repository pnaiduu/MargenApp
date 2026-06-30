import Link from 'next/link'
import { PageShell } from './components/PageShell'
import { HeroWaveDecor } from './components/HeroWaveDecor'
import { FadeIn } from './components/FadeIn'
import { SampleShowcase } from './components/SampleShowcase'
import { HERO_VALUE_PROP, LOGO } from '../lib/site'

export default function Home() {
  return (
    <PageShell>
      <section className="hero section">
        <HeroWaveDecor />
        <div className="container hero-content">
          <FadeIn>
            <img src={LOGO} alt="Margen" className="hero-logo" height={120} />
            <h1 className="hero-headline">Your web presence. Handled.</h1>
            <p className="hero-subtext">{HERO_VALUE_PROP}</p>
            <Link href="/quote-builder" className="btn btn--accent">
              Get a Quote
            </Link>
          </FadeIn>
        </div>
      </section>

      <section className="section section--alt">
        <div className="container container--narrow">
          <FadeIn>
            <p className="section-label">Why Margen</p>
            <h2 className="section-headline">A real developer, not a dashboard.</h2>
            <p className="section-subtext">
              One flat monthly rate covers your site, updates, and ongoing support. Text your developer anytime and
              changes are live within 48 hours.
            </p>
          </FadeIn>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <FadeIn>
            <p className="section-label">Portfolio</p>
            <h2 className="section-headline">A glimpse of what we build.</h2>
            <p className="section-subtext">Every site is custom. This is just the beginning.</p>
          </FadeIn>
          <SampleShowcase />
        </div>
      </section>
    </PageShell>
  )
}
