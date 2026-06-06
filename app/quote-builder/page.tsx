'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SiteFooter } from '../components/SiteFooter'
import { SiteNav } from '../components/SiteNav'
import { CustomSelect } from '../components/CustomSelect'
import { YesNoToggle } from '../components/YesNoToggle'
import { FEATURE_SECTIONS, PLANS } from '../quote/quoteData'
import { formatUsd } from '../../lib/formatUsd'

const TIMELINE_OPTIONS = ['ASAP', 'Within a month', 'No rush']

const FIELD_ORDER = [
  'firstName', 'lastName', 'businessName', 'email', 'phone', 'cityState', 'businessDescription',
  'hasExistingSite', 'existingSiteUrl', 'hasLogo', 'hasPhotos', 'timeline', 'heardFrom', 'plan',
] as const

type Errors = Record<string, boolean>

export default function QuoteBuilderPage() {
  const router = useRouter()
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({})

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [cityState, setCityState] = useState('')
  const [businessDescription, setBusinessDescription] = useState('')
  const [hasExistingSite, setHasExistingSite] = useState<boolean | null>(null)
  const [existingSiteUrl, setExistingSiteUrl] = useState('')
  const [hasLogo, setHasLogo] = useState<boolean | null>(null)
  const [hasPhotos, setHasPhotos] = useState<boolean | null>(null)
  const [timeline, setTimeline] = useState('')
  const [heardFrom, setHeardFrom] = useState('')
  const [repCode, setRepCode] = useState('')
  const [anythingElse, setAnythingElse] = useState('')

  const [selectedPlanId, setSelectedPlanId] = useState('standard')
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ design: true })
  const [selectedFeatures, setSelectedFeatures] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Errors>({})
  const [submitting, setSubmitting] = useState(false)

  const selectedPlan = PLANS.find((p) => p.id === selectedPlanId) ?? PLANS[1]

  const addonsTotal = useMemo(() => {
    let sum = 0
    for (const section of FEATURE_SECTIONS) {
      for (const f of section.features) {
        if (selectedFeatures[f.id]) sum += f.price
      }
    }
    return sum
  }, [selectedFeatures])

  const selectedFeatureList = useMemo(() => {
    const list: { name: string; price: number }[] = []
    for (const section of FEATURE_SECTIONS) {
      for (const f of section.features) {
        if (selectedFeatures[f.id]) list.push({ name: f.name, price: f.price })
      }
    }
    return list
  }, [selectedFeatures])

  const notSelectedFeatureList = useMemo(() => {
    const list: { name: string; price: number }[] = []
    for (const section of FEATURE_SECTIONS) {
      for (const f of section.features) {
        if (!selectedFeatures[f.id]) list.push({ name: f.name, price: f.price })
      }
    }
    return list
  }, [selectedFeatures])

  const monthlyTotal = selectedPlan.price + addonsTotal

  function sectionSelectedCount(sectionId: string) {
    const section = FEATURE_SECTIONS.find((s) => s.id === sectionId)
    if (!section) return 0
    return section.features.filter((f) => selectedFeatures[f.id]).length
  }

  function toggleSection(id: string) {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function toggleFeature(id: string) {
    setSelectedFeatures((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function setRef(key: string) {
    return (el: HTMLElement | null) => {
      fieldRefs.current[key] = el
    }
  }

  function validate(): Errors {
    const e: Errors = {}
    if (!firstName.trim()) e.firstName = true
    if (!lastName.trim()) e.lastName = true
    if (!businessName.trim()) e.businessName = true
    if (!email.trim()) e.email = true
    if (!phone.trim()) e.phone = true
    if (!cityState.trim()) e.cityState = true
    if (!businessDescription.trim()) e.businessDescription = true
    if (hasExistingSite === null) e.hasExistingSite = true
    if (hasExistingSite === true && !existingSiteUrl.trim()) e.existingSiteUrl = true
    if (hasLogo === null) e.hasLogo = true
    if (hasPhotos === null) e.hasPhotos = true
    if (!timeline) e.timeline = true
    if (!heardFrom.trim()) e.heardFrom = true
    if (!selectedPlanId) e.plan = true
    return e
  }

  async function handleSubmit() {
    const nextErrors = validate()
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      const firstKey = FIELD_ORDER.find((k) => nextErrors[k])
      if (firstKey) fieldRefs.current[firstKey]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: `${firstName.trim()} ${lastName.trim()}`,
          businessName: businessName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          cityState: cityState.trim(),
          businessDescription: businessDescription.trim(),
          hasExistingSite: hasExistingSite === true,
          existingSiteUrl: hasExistingSite ? existingSiteUrl.trim() : undefined,
          hasLogo: hasLogo === true,
          hasPhotos: hasPhotos === true,
          timeline,
          heardFrom: heardFrom.trim(),
          repCode: repCode.trim() || undefined,
          planId: selectedPlan.id,
          plan: selectedPlan.name,
          planPrice: selectedPlan.price,
          selectedFeatures: selectedFeatureList,
          notSelectedFeatures: notSelectedFeatureList,
          monthlyTotal,
          anythingElse: anythingElse.trim() || undefined,
        }),
      })
      if (!res.ok) throw new Error('Submit failed')
      router.push('/quote-builder/success')
    } catch {
      alert('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const err = (key: string) => (errors[key] ? ' form-field--error' : '')

  return (
    <div className="page qb-page">
      <SiteNav />
      <main className="qb-main">
        <div className="container">
          <header className="qb-header">
            <h1 className="qb-title">Build your quote</h1>
            <p className="qb-subtitle">
              Tell us about your business and select what you need. We will reach out within 24 hours.
            </p>
          </header>

          <section className="qb-section">
            <h2 className="qb-section-title">Your business</h2>
            <div className="qb-grid qb-grid--2">
              <label className={`form-field${err('firstName')}`} ref={setRef('firstName')}>
                <span className="form-label">First name</span>
                <input className="form-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </label>
              <label className={`form-field${err('lastName')}`} ref={setRef('lastName')}>
                <span className="form-label">Last name</span>
                <input className="form-input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </label>
              <label className={`form-field${err('businessName')}`} ref={setRef('businessName')}>
                <span className="form-label">Business name</span>
                <input className="form-input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
              </label>
              <label className={`form-field${err('email')}`} ref={setRef('email')}>
                <span className="form-label">Email address</span>
                <input type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label className={`form-field${err('phone')}`} ref={setRef('phone')}>
                <span className="form-label">Phone number</span>
                <input type="tel" className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </label>
              <label className={`form-field${err('cityState')}`} ref={setRef('cityState')}>
                <span className="form-label">City and state</span>
                <input className="form-input" value={cityState} onChange={(e) => setCityState(e.target.value)} />
              </label>
            </div>
            <label className={`form-field${err('businessDescription')}`} ref={setRef('businessDescription')}>
              <span className="form-label">Tell us about your business</span>
              <textarea
                className="form-input form-textarea"
                rows={5}
                value={businessDescription}
                onChange={(e) => setBusinessDescription(e.target.value)}
                placeholder="e.g. Personal injury law firm in Dallas, been open 12 years, 4 attorneys. Looking to modernize and get more leads online."
              />
            </label>
            <div className="qb-grid qb-grid--2">
              <div className={`form-field${err('hasExistingSite')}`} ref={setRef('hasExistingSite')}>
                <span className="form-label">Do you have an existing website?</span>
                <YesNoToggle name="existing-site" value={hasExistingSite} onChange={setHasExistingSite} hasError={errors.hasExistingSite} />
              </div>
              {hasExistingSite === true ? (
                <label className={`form-field${err('existingSiteUrl')}`} ref={setRef('existingSiteUrl')}>
                  <span className="form-label">Website URL</span>
                  <input className="form-input" value={existingSiteUrl} onChange={(e) => setExistingSiteUrl(e.target.value)} placeholder="https://" />
                </label>
              ) : null}
              <div className={`form-field${err('hasLogo')}`} ref={setRef('hasLogo')}>
                <span className="form-label">Do you have a logo and brand assets ready?</span>
                <YesNoToggle name="has-logo" value={hasLogo} onChange={setHasLogo} hasError={errors.hasLogo} />
              </div>
              <div className={`form-field${err('hasPhotos')}`} ref={setRef('hasPhotos')}>
                <span className="form-label">Do you have photos or videos we can use?</span>
                <YesNoToggle name="has-photos" value={hasPhotos} onChange={setHasPhotos} hasError={errors.hasPhotos} />
              </div>
              <label className={`form-field${err('timeline')}`} ref={setRef('timeline')}>
                <span className="form-label">How soon do you want your site live?</span>
                <CustomSelect
                  value={timeline}
                  onChange={setTimeline}
                  placeholder="Select..."
                  options={TIMELINE_OPTIONS.map((o) => ({ label: o, value: o }))}
                />
              </label>
              <label className={`form-field${err('heardFrom')}`} ref={setRef('heardFrom')}>
                <span className="form-label">How did you hear about us?</span>
                <input className="form-input" value={heardFrom} onChange={(e) => setHeardFrom(e.target.value)} />
              </label>
              <label className="form-field">
                <span className="form-label">Rep code <span className="form-optional">(optional)</span></span>
                <input className="form-input" value={repCode} onChange={(e) => setRepCode(e.target.value)} placeholder="Enter your rep code if you have one" />
              </label>
            </div>
          </section>

          <section className="qb-section" ref={setRef('plan')}>
            <h2 className="qb-section-title">Base plan</h2>
            <div className={`plan-grid${errors.plan ? ' plan-grid--error' : ''}`}>
              {PLANS.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  className={`plan-card${selectedPlanId === plan.id ? ' plan-card--selected' : ''}`}
                  onClick={() => setSelectedPlanId(plan.id)}
                >
                  <span className="plan-card-name">{plan.name}</span>
                  <span className="plan-card-price">{formatUsd(plan.price)}/mo</span>
                  <span className="plan-card-pages">{plan.pages}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="qb-section">
            <h2 className="qb-section-title">Add-ons</h2>
            <div className="feature-sections">
              {FEATURE_SECTIONS.map((section) => {
                const isOpen = Boolean(openSections[section.id])
                return (
                  <div key={section.id} className="feature-section">
                    <button type="button" className="feature-section-header" onClick={() => toggleSection(section.id)} aria-expanded={isOpen}>
                      <span>
                        {section.title}
                        {sectionSelectedCount(section.id) > 0 ? (
                          <span className="feature-section-count"> ({sectionSelectedCount(section.id)} selected)</span>
                        ) : null}
                      </span>
                      <span className="feature-section-chevron" aria-hidden>{isOpen ? '−' : '+'}</span>
                    </button>
                    {isOpen ? (
                      <ul className="feature-list">
                        {section.features.map((f) => (
                          <li key={f.id}>
                            <label className="feature-row">
                              <input type="checkbox" checked={Boolean(selectedFeatures[f.id])} onChange={() => toggleFeature(f.id)} />
                              <span className="feature-row-body">
                                <span className="feature-row-top">
                                  <span className="feature-name">{f.name}</span>
                                  <span className="feature-price">+{formatUsd(f.price)}</span>
                                </span>
                                <span className="feature-desc">{f.description}</span>
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </section>

          <section className="qb-section">
            <h2 className="qb-section-title">Anything else?</h2>
            <label className="form-field">
              <span className="form-label">Anything else you want us to know</span>
              <textarea
                className="form-input form-textarea"
                rows={4}
                value={anythingElse}
                onChange={(e) => setAnythingElse(e.target.value)}
                placeholder="Special requests, sites you like the look of, specific goals, anything at all"
              />
            </label>
          </section>
        </div>
      </main>

      <div className="qb-sticky">
        <div className="qb-sticky-inner container">
          <div className="qb-sticky-totals">
            <span className="qb-sticky-amount">{formatUsd(monthlyTotal)}/mo</span>
          </div>
          <button type="button" className="btn btn--accent" onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? 'Sending...' : 'Send my quote request'}
          </button>
        </div>
      </div>

      <SiteFooter />
    </div>
  )
}
