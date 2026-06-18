'use client'

import { useState } from 'react'
import { SiteFooter } from '../../components/SiteFooter'
import { SiteNav } from '../../components/SiteNav'
import { CustomSelect } from '../../components/CustomSelect'
import { YesNoToggle } from '../../components/YesNoToggle'

const HOURS_OPTIONS = ['1 to 2 hours', '2 to 5 hours', '5 to 10 hours', '10 or more hours']

const EARNINGS = [
  { clients: '2 clients at $500/mo average', amount: '$100/mo' },
  { clients: '4 clients at $750/mo average', amount: '$300/mo' },
  { clients: '6 clients at $1,000/mo average', amount: '$600/mo' },
  { clients: '6 clients at $1,500/mo average', amount: '$900/mo' },
]

const STEPS = [
  'Get assigned a client with a full feature sheet',
  'Build the site in Cursor using the feature sheet',
  'Client texts you for updates. Respond within 24 hours',
  'Get paid 10% of their monthly fee every month they stay',
]

const REQUIREMENTS = [
  'Basic knowledge of HTML, CSS, and JavaScript',
  'Comfortable using Cursor or AI coding tools',
  'Available at least 2 hours per week',
  'Professional communication with clients',
  'Commission only, no base salary',
]

export default function DeveloperCareersPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [age, setAge] = useState('')
  const [cityState, setCityState] = useState('')
  const [experience, setExperience] = useState('')
  const [builtBefore, setBuiltBefore] = useState<boolean | null>(null)
  const [portfolioLink, setPortfolioLink] = useState('')
  const [usesCursor, setUsesCursor] = useState<boolean | null>(null)
  const [hoursPerWeek, setHoursPerWeek] = useState('')
  const [whyJoin, setWhyJoin] = useState('')
  const [commissionOk, setCommissionOk] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errors, setErrors] = useState<Record<string, boolean>>({})

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const next: Record<string, boolean> = {}
    if (!fullName.trim()) next.fullName = true
    if (!email.trim()) next.email = true
    if (!phone.trim()) next.phone = true
    if (!age.trim()) next.age = true
    if (!cityState.trim()) next.cityState = true
    if (!experience.trim()) next.experience = true
    if (builtBefore === null) next.builtBefore = true
    if (usesCursor === null) next.usesCursor = true
    if (!hoursPerWeek) next.hoursPerWeek = true
    if (!whyJoin.trim()) next.whyJoin = true
    if (!commissionOk) next.commissionOk = true
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/dev-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName, email, phone, age, cityState, experience, builtBefore, portfolioLink, usesCursor, hoursPerWeek, whyJoin, commissionOk,
        }),
      })
      if (!res.ok) throw new Error()
      setSuccess(true)
    } catch {
      alert('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const err = (k: string) => (errors[k] ? ' form-field--error' : '')

  return (
    <div className="page careers-role-page">
      <SiteNav />
      <main>
        <section className="section careers-role-hero">
          <div className="container container--narrow">
            <p className="section-label">Careers</p>
            <h1 className="careers-role-title">Join as a Developer</h1>
            <p className="section-subtext">
              Build websites for local businesses using Cursor. Earn 10% recurring monthly commission per client. Work 2
              to 3 hours a week from anywhere.
            </p>
          </div>
        </section>

        <section className="section section--alt">
          <div className="container container--narrow">
            <h2 className="careers-section-head">What you can earn</h2>
            <div className="earnings-grid">
              {EARNINGS.map((row) => (
                <div key={row.clients} className="earnings-card">
                  <span>{row.clients}</span>
                  <strong>{row.amount}</strong>
                </div>
              ))}
            </div>
            <p className="careers-section-note">Commission is recurring. Every month a client stays, you get paid.</p>
          </div>
        </section>

        <section className="section">
          <div className="container container--narrow">
            <h2 className="careers-section-head">How it works</h2>
            <ol className="careers-steps">
              {STEPS.map((step, i) => (
                <li key={step}><span className="careers-step-num">{i + 1}</span><span>{step}</span></li>
              ))}
            </ol>
          </div>
        </section>

        <section className="section section--alt">
          <div className="container container--narrow">
            <h2 className="careers-section-head">Requirements</h2>
            <ul className="careers-bullets">
              {REQUIREMENTS.map((r) => <li key={r}>{r}</li>)}
            </ul>
          </div>
        </section>

        <section className="section">
          <div className="container container--narrow">
            <h2 className="careers-section-head">Apply</h2>
            {success ? (
              <p className="apply-success">Application received. We will be in touch within 48 hours.</p>
            ) : (
              <form className="careers-form" onSubmit={(e) => void handleSubmit(e)}>
                <label className={`form-field${err('fullName')}`}>
                  <span className="form-label">Full name</span>
                  <input className="form-input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </label>
                <label className={`form-field${err('email')}`}>
                  <span className="form-label">Email address</span>
                  <input type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} />
                </label>
                <label className={`form-field${err('phone')}`}>
                  <span className="form-label">Phone number</span>
                  <input
                    type="tel"
                    className="form-input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. (214) 555-0123"
                    required
                  />
                </label>
                <label className={`form-field${err('age')}`}>
                  <span className="form-label">Age</span>
                  <input className="form-input" value={age} onChange={(e) => setAge(e.target.value)} />
                </label>
                <label className={`form-field${err('cityState')}`}>
                  <span className="form-label">City and state</span>
                  <input className="form-input" value={cityState} onChange={(e) => setCityState(e.target.value)} />
                </label>
                <label className={`form-field${err('experience')}`}>
                  <span className="form-label">Describe your development experience</span>
                  <textarea className="form-input form-textarea" rows={4} value={experience} onChange={(e) => setExperience(e.target.value)} />
                </label>
                <div className={`form-field${err('builtBefore')}`}>
                  <span className="form-label">Have you built a website before?</span>
                  <YesNoToggle name="built-before" value={builtBefore} onChange={setBuiltBefore} />
                </div>
                <label className="form-field">
                  <span className="form-label">Link to something you have built <span className="form-optional">(optional)</span></span>
                  <input className="form-input" value={portfolioLink} onChange={(e) => setPortfolioLink(e.target.value)} placeholder="https://" />
                </label>
                <div className={`form-field${err('usesCursor')}`}>
                  <span className="form-label">Have you used Cursor or any AI coding tools?</span>
                  <YesNoToggle name="uses-cursor" value={usesCursor} onChange={setUsesCursor} />
                </div>
                <label className={`form-field${err('hoursPerWeek')}`}>
                  <span className="form-label">How many hours per week can you dedicate?</span>
                  <CustomSelect
                    value={hoursPerWeek}
                    onChange={setHoursPerWeek}
                    placeholder="Select..."
                    options={HOURS_OPTIONS.map((o) => ({ label: o, value: o }))}
                  />
                </label>
                <label className={`form-field${err('whyJoin')}`}>
                  <span className="form-label">Why do you want to join Margen?</span>
                  <textarea className="form-input form-textarea" rows={3} value={whyJoin} onChange={(e) => setWhyJoin(e.target.value)} />
                </label>
                <label className={`form-field form-field--check${err('commissionOk')}`}>
                  <input type="checkbox" checked={commissionOk} onChange={(e) => setCommissionOk(e.target.checked)} />
                  <span>I understand this is commission only with no base salary</span>
                </label>
                <button type="submit" className="btn btn--accent" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit application'}
                </button>
              </form>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
