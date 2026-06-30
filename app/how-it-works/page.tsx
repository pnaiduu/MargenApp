import type { Metadata } from 'next'
import { PageShell } from '../components/PageShell'
import { PageIntro } from '../components/PageIntro'
import { StepsList } from '../components/StepsList'

export const metadata: Metadata = {
  title: 'How It Works | Margen',
  description: 'Free audit, custom build, text-based updates, and one flat monthly rate.',
}

export default function HowItWorksPage() {
  return (
    <PageShell>
      <main className="inner-page">
        <PageIntro label="Company" headline="Set it and forget it." />

        <section className="section section--alt">
          <div className="container container--narrow">
            <StepsList />
          </div>
        </section>
      </main>
    </PageShell>
  )
}
