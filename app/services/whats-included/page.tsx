import type { Metadata } from 'next'
import Link from 'next/link'
import { PageShell } from '../../components/PageShell'
import { PageIntro } from '../../components/PageIntro'
import { FeatureCatalog } from '../../components/FeatureCatalog'
import { FadeIn } from '../../components/FadeIn'

export const metadata: Metadata = {
  title: "What's Included | Margen",
  description: 'See everything you can add to your Margen site. Build your own quote with no commitment.',
}

export default function WhatsIncludedPage() {
  return (
    <PageShell>
      <main className="inner-page">
        <PageIntro
          label="Services"
          headline="Build your own quote"
          subtext="See exactly what your site would cost. No commitment."
          narrow={false}
        />

        <section className="section section--alt">
          <div className="container">
            <FeatureCatalog />
          </div>
        </section>

        <section className="section">
          <div className="container container--narrow">
            <FadeIn>
              <div className="work-cta">
                <p className="work-cta-text">Ready to price your site? Select your plan and features in the quote builder.</p>
                <Link href="/quote-builder" className="btn btn--accent">
                  Start building
                </Link>
              </div>
            </FadeIn>
          </div>
        </section>
      </main>
    </PageShell>
  )
}
