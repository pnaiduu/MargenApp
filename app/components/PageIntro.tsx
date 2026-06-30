import { FadeIn } from './FadeIn'

type PageIntroProps = {
  label?: string
  headline: string
  subtext?: string
  children?: React.ReactNode
  narrow?: boolean
}

export function PageIntro({ label, headline, subtext, children, narrow = true }: PageIntroProps) {
  return (
    <section className="section page-intro">
      <div className={`container${narrow ? ' container--narrow' : ''}`}>
        <FadeIn>
          {label ? <p className="section-label">{label}</p> : null}
          <h1 className="page-headline">{headline}</h1>
          {subtext ? <p className="section-subtext">{subtext}</p> : null}
          {children}
        </FadeIn>
      </div>
    </section>
  )
}
