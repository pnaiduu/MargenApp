import type { Metadata } from 'next'
import { PageShell } from '../components/PageShell'
import { PageIntro } from '../components/PageIntro'
import { ContactForm } from '../components/ContactForm'
import { FadeIn } from '../components/FadeIn'
import { CALENDLY, CONTACT_EMAIL, SITE_DOMAIN, SITE_LOCATION } from '../../lib/site'

export const metadata: Metadata = {
  title: 'Contact | Margen',
  description: 'Get in touch with Margen. Book a free audit or send us a message.',
}

export default function ContactPage() {
  return (
    <PageShell>
      <main className="inner-page">
        <PageIntro
          label="Company"
          headline="Book a free audit."
          subtext="We'll review your site and tell you exactly what's costing you customers. 20 minutes, no charge, no obligation."
        />

        <section className="section section--alt">
          <div className="container">
            <div className="contact-layout">
              <FadeIn>
                <div className="contact-info">
                  <h2 className="contact-info-title">Get in touch</h2>
                  <p className="contact-info-item">
                    <strong>Location</strong>
                    <span>{SITE_LOCATION}</span>
                  </p>
                  <p className="contact-info-item">
                    <strong>Website</strong>
                    <a href={`https://${SITE_DOMAIN}`} target="_blank" rel="noopener noreferrer">
                      {SITE_DOMAIN}
                    </a>
                  </p>
                  <p className="contact-info-item">
                    <strong>Email</strong>
                    <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
                  </p>
                  <a href={CALENDLY} target="_blank" rel="noopener noreferrer" className="btn btn--dark">
                    Schedule my free audit
                  </a>
                </div>
              </FadeIn>
              <FadeIn>
                <ContactForm />
              </FadeIn>
            </div>
          </div>
        </section>
      </main>
    </PageShell>
  )
}
