'use client'

import { useState } from 'react'
import { SiteFooter } from '../../components/SiteFooter'
import { SiteNav } from '../../components/SiteNav'
import { YesNoToggle } from '../../components/YesNoToggle'

const EARNINGS = [
  { deal: 'Close 2 clients at $1,000/mo', amount: '$200 that month' },
  { deal: 'Close 5 clients at $1,000/mo', amount: '$500 that month' },
  { deal: 'Close 10 clients at $1,000/mo', amount: '$1,000 that month' },
]

const STEPS = [
  'Find businesses with bad or outdated websites',
  'Get them on a free 20-minute audit call with Margen',
  'We close the deal on the call',
  'You earn 10% of their first month the moment payment clears',
]

const REQUIREMENTS = [
  'Comfortable with cold outreach, cold calls, and walking into businesses',
  'Have a car for in-person outreach',
  'Self-motivated, no hand-holding',
  'Commission only, no base salary',
]

export default function SalesCareersPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [age, setAge] = useState('')
  const [cityState, setCityState] = useState('')
  const [hasSalesExperience, setHasSalesExperience] = useState<boolean | null>(null)
  const [doesColdCalls, setDoesColdCalls] = useState<boolean | null>(null)
  const [approachDescription, setApproachDescription] = useState('')
  const [hasCar, setHasCar] = useState<boolean | null>(null)
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
    if (!age.trim()) next.age = true
    if (!cityState.trim()) next.cityState = true
    if (hasSalesExperience === null) next.hasSalesExperience = true
    if (doesColdCalls === null) next.doesColdCalls = true
    if (!approachDescription.trim()) next.approachDescription = true
    if (hasCar === null) next.hasCar = true
    if (!whyJoin.trim()) next.whyJoin = true
    if (!commissionOk) next.commissionOk = true
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/sales-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName, email, age, cityState, hasSalesExperience, doesColdCalls, approachDescription, hasCar, whyJoin, commissionOk,
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
            <h1 className="careers-role-title">Join as a Sales Rep</h1>
            <p className="section-subtext">
              Find businesses with bad websites and connect them with Margen. Earn 10% of the first month for every
              client you close. No cap, full commission.
            </p>
          </div>
        </section>

        <section className="section">
          <div className="container container--narrow">
            <h2 className="careers-section-head">What you can earn</h2>
            <div className="earnings-grid">
              {EARNINGS.map((row) => (
                <div key={row.deal} className="earnings-card">
                  <span>{row.deal}</span>
                  <strong>{row.amount}</strong>
                </div>
              ))}
            </div>
            <p className="careers-section-note">Every client you close pays you once. Stack as many as you can.</p>
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

        <section className="section">
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
                <label className={`form-field${err('age')}`}>
                  <span className="form-label">Age</span>
                  <input className="form-input" value={age} onChange={(e) => setAge(e.target.value)} />
                </label>
                <label className={`form-field${err('cityState')}`}>
                  <span className="form-label">City and state</span>
                  <input className="form-input" value={cityState} onChange={(e) => setCityState(e.target.value)} />
                </label>
                <div className={`form-field${err('hasSalesExperience')}`}>
                  <span className="form-label">Do you have any sales or outreach experience?</span>
                  <YesNoToggle name="sales-exp" value={hasSalesExperience} onChange={setHasSalesExperience} />
                </div>
                <div className={`form-field${err('doesColdCalls')}`}>
                  <span className="form-label">Are you comfortable making cold calls and walking into businesses?</span>
                  <YesNoToggle name="cold-calls" value={doesColdCalls} onChange={setDoesColdCalls} />
                </div>
                <label className={`form-field${err('approachDescription')}`}>
                  <span className="form-label">How would you approach a business owner about their website?</span>
                  <textarea className="form-input form-textarea" rows={4} value={approachDescription} onChange={(e) => setApproachDescription(e.target.value)} />
                </label>
                <div className={`form-field${err('hasCar')}`}>
                  <span className="form-label">Do you have a car?</span>
                  <YesNoToggle name="has-car" value={hasCar} onChange={setHasCar} />
                </div>
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
