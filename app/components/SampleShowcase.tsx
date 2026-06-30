'use client'

import { useCallback, useEffect, useState } from 'react'
import { SAMPLES } from '../../lib/site'
import { FadeIn } from './FadeIn'

export function SampleShowcase() {
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
    <>
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
    </>
  )
}
