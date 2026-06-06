'use client'

import { useMemo, useState } from 'react'
import { FEATURE_SECTIONS, PLANS } from '../quote/quoteData'

const CALENDLY = 'https://calendly.com/davynaidu/30min'

function formatUsd(n: number) {
  return `$${n.toLocaleString('en-US')}`
}

export function InlineQuoteBuilder() {
  const [selectedPlanId, setSelectedPlanId] = useState('standard')
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ design: true, pages: true })
  const [selectedFeatures, setSelectedFeatures] = useState<Record<string, boolean>>({})
  const [additionalNotes, setAdditionalNotes] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    const list: { id: string; name: string; price: number }[] = []
    for (const section of FEATURE_SECTIONS) {
      for (const f of section.features) {
        if (selectedFeatures[f.id]) list.push({ id: f.id, name: f.name, price: f.price })
      }
    }
    return list
  }, [selectedFeatures])

  const monthlyTotal = selectedPlan.price + addonsTotal

  function toggleSection(id: string) {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function toggleFeature(id: string) {
    setSelectedFeatures((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const trimmedPhone = phone.trim()
    if (!trimmedPhone) {
      setError('Please enter a phone number so we can reach you.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: selectedPlan.id,
          planName: selectedPlan.name,
          planPrice: selectedPlan.price,
          selectedFeatures: selectedFeatureList,
          addonsTotal,
          monthlyTotal,
          additionalNotes: additionalNotes.trim(),
          phone: trimmedPhone,
        }),
      })

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error ?? 'Something went wrong. Please try again.')
      }

      window.open(CALENDLY, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="inline-quote" onSubmit={(e) => void handleSubmit(e)}>
      <div className="inline-quote-block">
        <h3 className="inline-quote-label">Base plan</h3>
        <div className="plan-grid plan-grid--inline">
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
      </div>

      <div className="inline-quote-block">
        <h3 className="inline-quote-label">Add-ons</h3>
        <div className="feature-sections">
          {FEATURE_SECTIONS.map((section) => {
            const isOpen = Boolean(openSections[section.id])
            return (
              <div key={section.id} className="feature-section">
                <button
                  type="button"
                  className="feature-section-header"
                  onClick={() => toggleSection(section.id)}
                  aria-expanded={isOpen}
                >
                  <span>{section.title}</span>
                  <span className="feature-section-chevron" aria-hidden>
                    {isOpen ? '−' : '+'}
                  </span>
                </button>
                {isOpen ? (
                  <ul className="feature-list">
                    {section.features.map((f) => (
                      <li key={f.id}>
                        <label className="feature-row">
                          <input
                            type="checkbox"
                            checked={Boolean(selectedFeatures[f.id])}
                            onChange={() => toggleFeature(f.id)}
                          />
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
      </div>

      <div className="inline-quote-footer">
        <div className="inline-quote-total">
          <span className="inline-quote-total-label">Estimated monthly total</span>
          <span className="inline-quote-total-amount">{formatUsd(monthlyTotal)}/mo</span>
          <p className="inline-quote-total-note">
            {formatUsd(selectedPlan.price)} base plan
            {addonsTotal > 0 ? ` + ${formatUsd(addonsTotal)} add-ons` : ''}
          </p>
        </div>
      </div>

      <div className="inline-quote-block inline-quote-extra">
        <h3 className="inline-quote-label">Anything else?</h3>
        <label className="quote-field">
          <span className="quote-label">Tell us anything else you need or want for your site</span>
          <textarea
            className="quote-input quote-textarea"
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value)}
            placeholder="Special requests, inspiration sites you like, anything at all"
            rows={4}
          />
        </label>
        <label className="quote-field">
          <span className="quote-label">Best phone number to reach you</span>
          <input
            type="tel"
            className="quote-input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. (214) 555-0123"
            required
          />
          <p className="inline-quote-phone-note">
            A Margen representative will reach out from (808) 379-7937 to confirm your order and connect you with
            your dedicated developer.
          </p>
        </label>
      </div>

      {error ? <p className="inline-quote-error">{error}</p> : null}

      <div className="inline-quote-submit">
        <button type="submit" className="btn btn--accent" disabled={submitting}>
          {submitting ? 'Saving...' : 'Book your free audit'}
        </button>
      </div>
    </form>
  )
}
