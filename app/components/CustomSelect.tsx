'use client'

import { useEffect, useId, useRef, useState } from 'react'

export type CustomSelectOption = {
  label: string
  value: string
}

type CustomSelectProps = {
  options: CustomSelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  onClick?: (e: React.MouseEvent) => void
  disabled?: boolean
}

export function CustomSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  className = '',
  onClick,
  disabled = false,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  const selected = options.find((o) => o.value === value)
  const display = selected?.label ?? placeholder

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  function handleSelect(next: string) {
    onChange(next)
    setOpen(false)
  }

  return (
    <div
      ref={rootRef}
      className={`custom-select${open ? ' custom-select--open' : ''}${disabled ? ' custom-select--disabled' : ''}${className ? ` ${className}` : ''}`}
      onClick={onClick}
    >
      <button
        type="button"
        className="custom-select__trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (!disabled) setOpen((prev) => !prev)
        }}
      >
        <span className={selected ? 'custom-select__value' : 'custom-select__placeholder'}>{display}</span>
        <svg className="custom-select__chevron" viewBox="0 0 12 8" width="12" height="8" aria-hidden="true">
          <path
            d="M1 1.5L6 6.5L11 1.5"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open ? (
        <ul id={listId} className="custom-select__panel" role="listbox">
          {options.map((opt) => {
            const isSelected = opt.value === value
            return (
              <li key={opt.value} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`custom-select__option${isSelected ? ' custom-select__option--selected' : ''}`}
                  onClick={() => handleSelect(opt.value)}
                >
                  {isSelected ? <span className="custom-select__check" aria-hidden="true">✓</span> : null}
                  <span>{opt.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
