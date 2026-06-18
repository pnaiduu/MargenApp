import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteFooter } from '../components/SiteFooter'
import { SiteNav } from '../components/SiteNav'

export const metadata: Metadata = {
  title: 'Careers | Margen',
  description: 'Join Margen as a developer or sales representative.',
}

const ROLES = [
  {
    href: '/careers/developer',
    title: 'Developer',
    desc: 'Build sites. Earn recurring commission.',
  },
  {
    href: '/careers/sales',
    title: 'Sales Rep',
    desc: 'Close clients. Earn per deal.',
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
            <p className="section-subtext">Choose your path. Commission only. No cap.</p>
          </div>
        </section>
        <section className="section section--alt">
          <div className="container careers-pick-grid">
            {ROLES.map((role) => (
              <Link key={role.href} href={role.href} className="careers-pick-card">
                <h2 className="careers-pick-title">{role.title}</h2>
                <p className="careers-pick-desc">{role.desc}</p>
                <span className="careers-pick-arrow btn btn--accent">View role →</span>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
