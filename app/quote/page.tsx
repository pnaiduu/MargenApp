'use client'

import { useMemo, useState } from 'react'
import { PageShell } from '../components/PageShell'
import { FEATURE_SECTIONS, PLANS } from './quoteData'

function formatUsd(n: number) {
  return `$${n.toLocaleString('en-US')}`
}

function getUpsellTip(total: number): string {
  if (total >= 1000) return 'Strong quote. Growth tier client.'
  if (total >= 600) return 'Consider upselling: Monthly SEO reporting (+$100) and Priority same-day support (+$150)'
  return 'Consider upselling: Full SEO setup (+$100) and Google Reviews feed (+$75)'
}

export default function QuotePage() {
  const [clientName, setClientName] = useState('')
  const [businessInfo, setBusinessInfo] = useState('')
  const [selectedPlanId, setSelectedPlanId] = useState('standard')
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ design: true })
  const [selectedFeatures, setSelectedFeatures] = useState<Record<string, boolean>>({})
  const [copyStatus, setCopyStatus] = useState<string | null>(null)

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

  const monthlyTotal = selectedPlan.price + addonsTotal

  const selectedFeatureList = useMemo(() => {
    const list: { name: string; price: number }[] = []
    for (const section of FEATURE_SECTIONS) {
      for (const f of section.features) {
        if (selectedFeatures[f.id]) list.push({ name: f.name, price: f.price })
      }
    }
    return list
  }, [selectedFeatures])

  function toggleSection(id: string) {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function toggleFeature(id: string) {
    setSelectedFeatures((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function reset() {
    setClientName('')
    setBusinessInfo('')
    setSelectedPlanId('standard')
    setOpenSections({ design: true })
    setSelectedFeatures({})
    setCopyStatus(null)
  }

  async function copyQuote() {
    const lines = [
      'MARGEN WEBSITE QUOTE',
      '='.repeat(40),
      clientName ? `Client: ${clientName}` : 'Client: (not set)',
      businessInfo ? `Business: ${businessInfo}` : '',
      '',
      `Base plan: ${selectedPlan.name}, ${formatUsd(selectedPlan.price)}/mo (${selectedPlan.pages})`,
      '',
    ]

    if (selectedFeatureList.length > 0) {
      lines.push('Add-ons:')
      for (const f of selectedFeatureList) {
        lines.push(`  • ${f.name}: +${formatUsd(f.price)}/mo`)
      }
      lines.push('')
    }

    lines.push(`Monthly total: ${formatUsd(monthlyTotal)}/mo`)
    lines.push('')
    lines.push('Revenue split:')
    lines.push(`  • You (recurring): ${formatUsd(Math.round(monthlyTotal * 0.9))}/mo (90%)`)
    lines.push(`  • Dev (recurring): ${formatUsd(Math.round(monthlyTotal * 0.1))}/mo (10%)`)
    lines.push(`  • Sales (first month): ${formatUsd(Math.round(monthlyTotal * 0.1))} (10% one-time)`)
    lines.push('')
    lines.push('Margen · trymargen.com')

    try {
      await navigator.clipboard.writeText(lines.filter(Boolean).join('\n'))
      setCopyStatus('Copied!')
      setTimeout(() => setCopyStatus(null), 2000)
    } catch {
      setCopyStatus('Copy failed')
    }
  }

  return (
    <PageShell showQuoteCta={false}>
      <main className="quote-main quote-page">
        <div className="container">
          <header className="quote-header">
            <p className="section-label">Internal</p>
            <h1 className="quote-title">Quote Builder</h1>
            <p className="quote-subtitle">Internal tool for sales calls only</p>
          </header>

          <section className="quote-block">
            <h2 className="quote-block-title">Client info</h2>
            <div className="quote-input-row">
              <label className="quote-field">
                <span className="quote-label">Client name</span>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Jane Smith"
                  className="quote-input"
                />
              </label>
              <label className="quote-field">
                <span className="quote-label">Tell us about your business</span>
                <input
                  type="text"
                  value={businessInfo}
                  onChange={(e) => setBusinessInfo(e.target.value)}
                  placeholder="e.g. personal injury law firm in Dallas, 3 locations"
                  className="quote-input"
                />
              </label>
            </div>
          </section>

          <section className="quote-block">
            <h2 className="quote-block-title">Base plan</h2>
            <div className="plan-grid">
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

          <section className="quote-block">
            <h2 className="quote-block-title">Add-ons</h2>
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
          </section>
        </div>
      </main>

      <div className="quote-summary">
        <div className="quote-summary-inner container">
          <div className="quote-summary-grid">
            <div className="quote-summary-total">
              <span className="quote-summary-label">Monthly total</span>
              <span className="quote-summary-amount">{formatUsd(monthlyTotal)}/mo</span>
            </div>
            <div className="quote-summary-breakdown">
              <div className="quote-summary-line">
                <span>Base plan</span>
                <span>{formatUsd(selectedPlan.price)}</span>
              </div>
              <div className="quote-summary-line">
                <span>Add-ons</span>
                <span>+{formatUsd(addonsTotal)}</span>
              </div>
            </div>
            <div className="quote-summary-split">
              <p className="quote-split-title">Revenue split</p>
              <p className="quote-split-line">You: 90% recurring ({formatUsd(Math.round(monthlyTotal * 0.9))}/mo)</p>
              <p className="quote-split-line">Dev: 10% recurring ({formatUsd(Math.round(monthlyTotal * 0.1))}/mo)</p>
              <p className="quote-split-line">Sales: 10% first month only ({formatUsd(Math.round(monthlyTotal * 0.1))})</p>
            </div>
            <div className="quote-summary-actions">
              <button type="button" className="btn btn--accent" onClick={() => void copyQuote()}>
                {copyStatus ?? 'Copy quote'}
              </button>
              <button type="button" className="btn btn--ghost" onClick={reset}>
                Reset
              </button>
            </div>
          </div>
          <p className="quote-tip">{getUpsellTip(monthlyTotal)}</p>
        </div>
      </div>
    </PageShell>
  )
}
