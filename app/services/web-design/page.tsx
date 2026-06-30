import type { Metadata } from 'next'
import { PageShell } from '../../components/PageShell'
import { PageIntro } from '../../components/PageIntro'
import { SampleShowcase } from '../../components/SampleShowcase'
import { FadeIn } from '../../components/FadeIn'
import { CALENDLY, STEPS } from '../../../lib/site'

export const metadata: Metadata = {
  title: 'Web Design | Margen',
  description: 'Custom websites built for local businesses. Clean, fast, and mobile-first.',
}

export default function WebDesignPage() {
  const buildStep = STEPS[1]
  const auditStep = STEPS[0]

  return (
    <PageShell>
      <main className="inner-page">
        <PageIntro
          label="Services"
          headline="A glimpse of what we build."
          subtext="Every site is custom. This is just the beginning."
        />

        <section className="section section--alt">
          <div className="container container--narrow">
            <FadeIn>
              <p className="section-label">Process</p>
              <h2 className="section-headline">{auditStep.title}</h2>
              <p className="section-subtext">{auditStep.desc}</p>
            </FadeIn>
            <FadeIn>
              <div className="content-block">
                <h3 className="content-block-title">{buildStep.title}</h3>
                <p className="content-block-text">{buildStep.desc}</p>
              </div>
            </FadeIn>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <SampleShowcase />
          </div>
        </section>

        <section className="section section--alt">
          <div className="container">
            <FadeIn>
              <div className="work-cta">
                <p className="work-cta-text">
                  Our work speaks for itself. Book an audit to see what we can build for you.
                </p>
                <a href={CALENDLY} target="_blank" rel="noopener noreferrer" className="btn btn--accent">
                  Book a free audit
                </a>
              </div>
            </FadeIn>
          </div>
        </section>
      </main>
    </PageShell>
  )
}
