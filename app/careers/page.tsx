import type { Metadata } from 'next'
import { SiteFooter } from '../components/SiteFooter'
import { SiteNav } from '../components/SiteNav'

export const metadata: Metadata = {
  title: 'Careers | Margen',
  description: 'Join Margen as a developer or sales representative. Commission-based roles with a premium web retainer agency in Allen, Texas.',
}

const APPLY_URL = 'https://forms.google.com/placeholder'

const ROLES = [
  {
    id: 'developer',
    title: 'Developer',
    label: 'Build',
    description:
      'You build and maintain client websites on our retainer stack. Next.js, clean CSS, fast turnaround. Most sites go live within 7 to 10 days. You work remotely, async-friendly, with a steady pipeline of projects.',
    commission: [
      '10% recurring commission on every client site you build and maintain',
      'Paid monthly for as long as the client stays on retainer',
      'No cap on active accounts',
    ],
  },
  {
    id: 'sales',
    title: 'Sales Representative',
    label: 'Sell',
    description:
      'You bring in local businesses who need a better web presence. Run free audits, walk prospects through the quote builder, and close retainer clients. We handle fulfillment. You focus on relationships and revenue.',
    commission: [
      '10% one-time commission on the client\'s first month',
      'Paid when the client signs and pays their first invoice',
      'Average deal size: $500 to $2,000/mo',
    ],
  },
] as const

export default function CareersPage() {
  return (
    <div className="page careers-page">
      <SiteNav />

      <main>
        <section className="section careers-hero">
          <div className="container">
            <p className="section-label">Careers</p>
            <h1 className="section-headline">Join the team.</h1>
            <p className="section-subtext">
              Margen is growing. We are looking for developers and sales reps who want to build something real in
              North Texas and beyond.
            </p>
          </div>
        </section>

        <section className="section">
          <div className="container careers-grid">
            {ROLES.map((role) => (
              <article key={role.id} className="careers-card">
                <p className="section-label">{role.label}</p>
                <h2 className="careers-card-title">{role.title}</h2>
                <p className="careers-card-desc">{role.description}</p>
                <div className="careers-commission">
                  <h3 className="careers-commission-title">Commission structure</h3>
                  <ul className="careers-commission-list">
                    {role.commission.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <a href={APPLY_URL} target="_blank" rel="noopener noreferrer" className="btn btn--accent">
                  Apply now
                </a>
              </article>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
