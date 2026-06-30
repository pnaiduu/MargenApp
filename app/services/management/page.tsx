import type { Metadata } from 'next'
import { PageShell } from '../../components/PageShell'
import { PageIntro } from '../../components/PageIntro'
import { FadeIn } from '../../components/FadeIn'
import { HERO_STATS, HERO_VALUE_PROP, STEPS } from '../../../lib/site'

export const metadata: Metadata = {
  title: 'Website Management | Margen',
  description: 'Your own dedicated developer on a flat monthly retainer. Text them anything, anytime.',
}

export default function ManagementPage() {
  const textStep = STEPS[2]
  const rateStep = STEPS[3]

  return (
    <PageShell>
      <main className="inner-page">
        <PageIntro label="Services" headline="Your web presence. Handled." subtext={HERO_VALUE_PROP} />

        <section className="section section--alt">
          <div className="container container--narrow">
            <FadeIn>
              <div className="hero-stats hero-stats--inline">
                {HERO_STATS.map((stat) => (
                  <span key={stat} className="hero-stat">
                    {stat}
                  </span>
                ))}
              </div>
            </FadeIn>
          </div>
        </section>

        <section className="section">
          <div className="container container--narrow">
            <FadeIn>
              <p className="section-label">How it works</p>
              <h2 className="section-headline">Set it and forget it.</h2>
            </FadeIn>
            <div className="steps">
              <FadeIn>
                <div className="step">
                  <span className="step-num">3</span>
                  <div>
                    <p className="step-title">{textStep.title}</p>
                    <p className="step-desc">{textStep.desc}</p>
                  </div>
                </div>
              </FadeIn>
              <FadeIn>
                <div className="step">
                  <span className="step-num">4</span>
                  <div>
                    <p className="step-title">{rateStep.title}</p>
                    <p className="step-desc">{rateStep.desc}</p>
                  </div>
                </div>
              </FadeIn>
            </div>
          </div>
        </section>

        <section className="section section--alt">
          <div className="container container--narrow">
            <FadeIn>
              <blockquote className="developer-callout">
                Your developer&apos;s number is in your phone. Not a ticket system. Not a chatbot. A real person who
                knows your business.
              </blockquote>
            </FadeIn>
          </div>
        </section>
      </main>
    </PageShell>
  )
}
