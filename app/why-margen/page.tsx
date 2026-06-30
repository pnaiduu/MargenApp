import type { Metadata } from 'next'
import { PageShell } from '../components/PageShell'
import { PageIntro } from '../components/PageIntro'
import { FadeIn } from '../components/FadeIn'
import { BUILDER_COMPARISON } from '../../lib/site'

export const metadata: Metadata = {
  title: 'Why Margen | Margen',
  description: 'Why a dedicated developer beats a website builder for local businesses.',
}

export default function WhyMargenPage() {
  return (
    <PageShell>
      <main className="inner-page">
        <PageIntro label="Company" headline="Why not just use a website builder?" />

        <section className="section section--alt">
          <div className="container container--narrow">
            <FadeIn>
              <ul className="comparison-points">
                {BUILDER_COMPARISON.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </FadeIn>
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
