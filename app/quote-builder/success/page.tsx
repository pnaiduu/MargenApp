import Link from 'next/link'
import { PageShell } from '../../components/PageShell'
import { CALENDLY } from '../../../lib/site'

export default function QuoteSuccessPage() {
  return (
    <PageShell showQuoteCta={false}>
      <main className="success-main">
        <img src="/margen-logo.png" alt="Margen" className="success-logo" height={80} />
        <h1 className="success-headline">We got you.</h1>
        <p className="success-subheadline">We will reach out to you shortly.</p>
        <p className="success-note">
          You will receive a text from one of our team members shortly. In the meantime feel free to book a time that
          works for you.
        </p>
        <a href={CALENDLY} target="_blank" rel="noopener noreferrer" className="btn btn--accent">
          Book your audit now
        </a>
        <Link href="/" className="btn btn--ghost success-home-btn">
          Back to home
        </Link>
      </main>
    </PageShell>
  )
}
