'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const CALENDLY = 'https://calendly.com/davynaidu/30min'

const SAMPLES = [
  {
    id: 'atlas-law',
    business: 'Law Firm',
    name: 'Atlas Law Group',
    desc: 'Dark navy and gold. Old-money authority for personal injury and criminal defense.',
    src: '/samples/atlas-law.html',
    cardClass: 'sample-card--law',
  },
  {
    id: 'lumiere',
    business: 'Med Spa',
    name: 'Lumière Med Spa',
    desc: 'Warm cream and rose gold. Luxury aesthetics for Botox, fillers, and laser treatments.',
    src: '/samples/lumiere-medspa.html',
    cardClass: 'sample-card--spa',
  },
  {
    id: 'arctic-air',
    business: 'HVAC',
    name: 'Arctic Air HVAC',
    desc: 'Clean white and blue. Trustworthy local service for AC repair and 24/7 emergency calls.',
    src: '/samples/arctic-air.html',
    cardClass: 'sample-card--hvac',
  },
] as const

const STEPS = [
  {
    title: 'Free website audit',
    desc: "We review your site and show you exactly what's hurting your business.",
  },
  {
    title: 'We build or rebuild',
    desc: 'Clean, fast, mobile-first. Usually live within 7–10 days.',
  },
  {
    title: 'You text us changes',
    desc: 'New hours, services, photos, pages. Done within 48 hours.',
  },
  {
    title: 'One flat rate',
    desc: 'No surprise invoices. No per-update fees. Cancel anytime.',
  },
]

const FEATURES = [
  'Mobile technician app',
  'Stripe Connect billing',
  'Live map dispatch',
  'Role-based onboarding',
]

const TECH = ['Next.js', 'React Native', 'Expo', 'Supabase', 'Stripe', 'Google Maps API', 'TypeScript']

const PLANS = [
  {
    tier: 'Starter',
    price: '$500–$750/mo',
    audience: 'Solo operators, small local businesses',
    includes: [
      'Professional website build',
      'Unlimited text and copy updates',
      'Mobile-first design',
      'Basic SEO setup',
      '48hr turnaround',
    ],
    popular: false,
  },
  {
    tier: 'Growth',
    price: '$1,000–$1,500/mo',
    audience: 'Law firms, med spas, real estate teams',
    includes: [
      'Everything in Starter',
      'New pages on request',
      'Booking and contact integrations',
      'Monthly SEO improvements',
      'Speed and performance audits',
    ],
    popular: true,
  },
  {
    tier: 'Premium',
    price: '$1,500–$2,000/mo',
    audience: 'Multi-location businesses, high-revenue firms',
    includes: [
      'Everything in Growth',
      'Custom web app features',
      'Priority same-day updates',
      'Analytics dashboard',
      'Dedicated point of contact',
    ],
    popular: false,
  },
]

function FadeIn({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('is-visible')
          observer.unobserve(el)
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className={`fade-in ${className}`.trim()}>
      {children}
    </div>
  )
}

export default function Home() {
  const [activeSample, setActiveSample] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)

  const closeModal = useCallback(() => {
    setClosing(true)
    setTimeout(() => {
      setActiveSample(null)
      setClosing(false)
    }, 200)
  }, [])

  useEffect(() => {
    if (!activeSample) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [activeSample, closeModal])

  const sample = SAMPLES.find((s) => s.id === activeSample)

  return (
    <div className="page">
      {/* Nav */}
      <header className="nav">
        <a href="#" className="nav-logo">
          Margen
        </a>
        <a href={CALENDLY} target="_blank" rel="noopener noreferrer" className="btn btn--accent">
          Book a free audit
        </a>
      </header>

      {/* Hero */}
      <section className="hero section">
        <div className="container">
          <FadeIn>
            <h1 className="hero-headline">Your web presence. Handled.</h1>
            <p className="hero-subtext">
              One flat monthly rate. Updates, new pages, fixes, SEO — all included. You text us, it gets done. No
              project fees, no surprises, cancel anytime.
            </p>
            <a href={CALENDLY} target="_blank" rel="noopener noreferrer" className="btn btn--accent">
              Get a free 20-min audit
            </a>
            <div className="hero-stats">
              <span className="hero-stat">$500–$2k / flat monthly</span>
              <span className="hero-stat">Cancel anytime</span>
              <span className="hero-stat">48hr turnaround</span>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Sample sites */}
      <section id="work" className="section">
        <div className="container">
          <FadeIn>
            <p className="section-label">Portfolio</p>
            <h2 className="section-headline">See what we build</h2>
            <p className="section-subtext">
              Click any sample to preview a full website we could build for your business.
            </p>
          </FadeIn>
          <div className="samples-grid">
            {SAMPLES.map((s) => (
              <FadeIn key={s.id} className={`sample-card ${s.cardClass}`}>
                <p className="sample-business">{s.business}</p>
                <h3 className="sample-type">{s.name}</h3>
                <p className="sample-desc">{s.desc}</p>
                <button type="button" className="sample-btn" onClick={() => setActiveSample(s.id)}>
                  Preview site
                </button>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="process" className="section">
        <div className="container">
          <FadeIn>
            <p className="section-label">Process</p>
            <h2 className="section-headline">Set it and forget it.</h2>
          </FadeIn>
          <div className="steps">
            {STEPS.map((step, i) => (
              <FadeIn key={step.title}>
                <div className="step">
                  <span className="step-num">{i + 1}</span>
                  <div>
                    <p className="step-title">{step.title}</p>
                    <p className="step-desc">{step.desc}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Case study */}
      <section id="case-study" className="section">
        <div className="container">
          <FadeIn>
            <p className="section-label">Case study</p>
            <h2 className="section-headline">Built from scratch.</h2>
          </FadeIn>
          <FadeIn>
            <article className="case-card">
              <h3 className="case-name">Margen Field Operations Platform</h3>
              <p className="case-desc">
                Full-stack SaaS for home service companies. Live technician GPS tracking, job dispatch, Stripe
                payments, invoicing, and real-time analytics. Built for HVAC, plumbing, and electrical businesses.
              </p>
              <div className="tech-pills">
                {TECH.map((t) => (
                  <span key={t} className="tech-pill">
                    {t}
                  </span>
                ))}
              </div>
              <div className="features-grid">
                {FEATURES.map((f) => (
                  <div key={f} className="feature">
                    <p className="feature-label">{f}</p>
                  </div>
                ))}
              </div>
            </article>
          </FadeIn>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="section">
        <div className="container">
          <FadeIn>
            <p className="section-label">Pricing</p>
            <h2 className="section-headline">Simple, flat monthly rates.</h2>
            <p className="section-subtext">No project fees. No hourly billing. Cancel anytime.</p>
          </FadeIn>
          <div className="pricing-grid">
            {PLANS.map((plan) => (
              <FadeIn key={plan.tier}>
                <div className={`pricing-card${plan.popular ? ' pricing-card--popular' : ''}`}>
                  {plan.popular ? <span className="pricing-badge">Most popular</span> : null}
                  <h3 className="pricing-tier">{plan.tier}</h3>
                  <p className="pricing-price">{plan.price}</p>
                  <p className="pricing-audience">{plan.audience}</p>
                  <ul className="pricing-includes">
                    {plan.includes.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="contact" className="section">
        <div className="container">
          <FadeIn>
            <div className="cta-box">
              <h2 className="section-headline">Book a free audit.</h2>
              <p className="section-subtext">
                We&apos;ll review your site and tell you exactly what&apos;s costing you customers. 20 minutes, no
                charge, no obligation.
              </p>
              <a href={CALENDLY} target="_blank" rel="noopener noreferrer" className="btn btn--dark">
                Schedule my free audit
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <span>Margen · Allen, Texas · trymargen.com</span>
        <span>© 2026 Margen</span>
      </footer>

      {/* Modal */}
      {activeSample && sample ? (
        <div
          className={`modal-overlay${closing ? ' is-closing' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-label={`Preview: ${sample.name}`}
          onClick={closeModal}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="modal-close" onClick={closeModal} aria-label="Close preview">
              ×
            </button>
            <iframe title={sample.name} src={sample.src} className="modal-iframe" />
          </div>
        </div>
      ) : null}
    </div>
  )
}
