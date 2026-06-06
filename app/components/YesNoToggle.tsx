type YesNoToggleProps = {
  value: boolean | null
  onChange: (value: boolean) => void
  name: string
  hasError?: boolean
}

export function YesNoToggle({ value, onChange, name, hasError }: YesNoToggleProps) {
  return (
    <div className={`yes-no${hasError ? ' yes-no--error' : ''}`} role="group" aria-label={name}>
      <button
        type="button"
        className={`yes-no-btn${value === true ? ' yes-no-btn--active' : ''}`}
        onClick={() => onChange(true)}
      >
        Yes
      </button>
      <button
        type="button"
        className={`yes-no-btn${value === false ? ' yes-no-btn--active' : ''}`}
        onClick={() => onChange(false)}
      >
        No
      </button>
    </div>
  )
}
