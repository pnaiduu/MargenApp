import type { Metadata } from 'next'
import { PageShell } from '../../components/PageShell'
import { PageIntro } from '../../components/PageIntro'
import { FeatureCatalog } from '../../components/FeatureCatalog'
import { FEATURE_SECTIONS } from '../../quote/quoteData'

export const metadata: Metadata = {
  title: 'SEO | Margen',
  description: 'Full SEO setup, local optimization, speed tuning, and monthly reporting — all included in your retainer.',
}

const SEO_SECTIONS = FEATURE_SECTIONS.filter((s) => s.id === 'seo')

export default function SeoPage() {
  return (
    <PageShell>
      <main className="inner-page">
        <PageIntro
          label="Services"
          headline="SEO and performance, handled."
          subtext="One flat monthly rate for your web presence. Updates, new pages, fixes, and SEO: all included."
          narrow={false}
        />

        <section className="section section--alt">
          <div className="container">
            <FeatureCatalog sections={SEO_SECTIONS} />
          </div>
        </section>
      </main>
    </PageShell>
  )
}
