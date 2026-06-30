import Link from 'next/link'
import { FadeIn } from './FadeIn'

export function QuoteCta() {
  return (
    <section className="section quote-cta-section">
      <div className="container">
        <FadeIn>
          <div className="quote-cta-box">
            <p className="section-label">Pricing</p>
            <h2 className="section-headline">Build your own quote</h2>
            <p className="section-subtext">See exactly what your site would cost. No commitment.</p>
            <Link href="/quote-builder" className="btn btn--accent">
              Get a Quote
            </Link>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
