import { FEATURE_SECTIONS, type FeatureSection } from '../quote/quoteData'
import { FadeIn } from './FadeIn'
import { formatUsd } from '../../lib/formatUsd'

type FeatureCatalogProps = {
  sections?: FeatureSection[]
  showPrices?: boolean
}

export function FeatureCatalog({ sections = FEATURE_SECTIONS, showPrices = true }: FeatureCatalogProps) {
  return (
    <div className="feature-catalog">
      {sections.map((section) => (
        <FadeIn key={section.id}>
          <div className="feature-catalog-section">
            <h2 className="feature-catalog-title">{section.title}</h2>
            <ul className="feature-catalog-list">
              {section.features.map((f) => (
                <li key={f.id} className="feature-catalog-item">
                  <div className="feature-catalog-item-head">
                    <span className="feature-catalog-name">{f.name}</span>
                    {showPrices ? <span className="feature-catalog-price">+{formatUsd(f.price)}</span> : null}
                  </div>
                  <p className="feature-catalog-desc">{f.description}</p>
                </li>
              ))}
            </ul>
          </div>
        </FadeIn>
      ))}
    </div>
  )
}
