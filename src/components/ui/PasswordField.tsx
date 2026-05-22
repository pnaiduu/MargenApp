import { useState, type InputHTMLAttributes } from 'react'

const inputClassName =
  'w-full rounded-md border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2 pr-10 text-sm text-[var(--color-margen-text)] outline-none focus:border-[var(--margen-accent)]'

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  )
}

type PasswordFieldProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
} & Pick<InputHTMLAttributes<HTMLInputElement>, 'autoComplete' | 'required' | 'minLength'>

export function PasswordField({ id, label, value, onChange, autoComplete, required, minLength }: PasswordFieldProps) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-[var(--color-margen-text)]">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={showPassword ? 'text' : 'password'}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClassName}
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-[var(--color-margen-muted)] transition hover:text-[var(--color-margen-text)]"
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          aria-pressed={showPassword}
        >
          {showPassword ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </div>
  )
}
