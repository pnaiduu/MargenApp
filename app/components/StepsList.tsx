import { STEPS } from '../../lib/site'
import { FadeIn } from './FadeIn'

type StepsListProps = {
  steps?: typeof STEPS
}

export function StepsList({ steps = STEPS }: StepsListProps) {
  return (
    <div className="steps">
      {steps.map((step, i) => (
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
  )
}
