import type { ReactNode } from 'react'
import { HsvaColorPicker } from 'react-colorful'
import { usePreferences } from '../../contexts/usePreferences'
import { normalizeHex } from '../../lib/logoFilter'
import { hexToHsva, hsvaToHex, type ThemeMode } from '../../lib/appearanceTheme'

const CARD_BORDER = '#ebebeb'

const fieldClass =
  'w-full rounded-lg border border-[#ebebeb] bg-white px-3 py-2.5 text-sm text-[#111111] outline-none transition focus:border-[var(--margen-accent)] focus:ring-2 focus:ring-[var(--margen-accent-muted)]'

const THEME_OPTIONS: {
  id: ThemeMode
  label: string
  description: string
  Icon: () => ReactNode
}[] = [
  {
    id: 'light',
    label: 'Light',
    description: 'Bright workspace',
    Icon: SunIcon,
  },
  {
    id: 'dark',
    label: 'Dark',
    description: 'Dimmed interface',
    Icon: MoonIcon,
  },
  {
    id: 'system',
    label: 'System',
    description: 'Match your device',
    Icon: ComputerIcon,
  },
]

function SunIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 14.5A8.5 8.5 0 0 1 9.5 3 10 10 0 0 0 21 14.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ComputerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 20h8M12 16v4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

export function AppearanceSettings() {
  const { accentHex, setAccentHex, themeMode, setThemeMode } = usePreferences()
  const previewHex = normalizeHex(accentHex)

  return (
    <>
      <div>
        <p className="text-sm font-medium text-[#111111]">Theme</p>
        <p className="mt-1 text-xs leading-relaxed text-[#888888]">
          Applies across the dashboard as soon as you choose an option.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {THEME_OPTIONS.map(({ id, label, description, Icon }) => {
            const selected = themeMode === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setThemeMode(id)}
                className={[
                  'flex flex-col items-start gap-3 rounded-xl border p-4 text-left transition',
                  selected
                    ? 'border-[var(--margen-accent)] bg-[var(--margen-accent-muted)] ring-2 ring-[var(--margen-accent)]'
                    : 'border-[#ebebeb] bg-[#fafafa] hover:border-[#d4d4d4] hover:bg-white',
                ].join(' ')}
              >
                <span
                  className={[
                    'inline-flex h-10 w-10 items-center justify-center rounded-lg',
                    selected ? 'bg-white text-[var(--margen-accent)]' : 'bg-white text-[#555555]',
                  ].join(' ')}
                >
                  <Icon />
                </span>
                <span>
                  <span className="block text-sm font-medium text-[#111111]">{label}</span>
                  <span className="mt-0.5 block text-xs text-[#888888]">{description}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-8 border-t pt-8" style={{ borderColor: CARD_BORDER }}>
        <p className="text-sm font-medium text-[#111111]">Accent color</p>
        <p className="mt-1 text-xs leading-relaxed text-[#888888]">
          Used for buttons and highlights. The save button previews your selection.
        </p>
        <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="settings-color-wheel shrink-0 [&_.react-colorful]:h-[180px] [&_.react-colorful]:w-full [&_.react-colorful]:max-w-[220px] [&_.react-colorful]:rounded-lg">
            <HsvaColorPicker
              color={hexToHsva(accentHex)}
              onChange={(hsva) => setAccentHex(hsvaToHex(hsva))}
            />
          </div>
          <div className="min-w-0 flex-1 sm:max-w-[12rem]">
            <label className="mb-1.5 block text-xs font-medium text-[#555555]" htmlFor="settings-accent-hex">
              Hex
            </label>
            <input
              id="settings-accent-hex"
              type="text"
              value={accentHex}
              onChange={(e) => {
                const raw = e.target.value
                setAccentHex(raw.startsWith('#') ? raw : `#${raw}`)
              }}
              onBlur={() => setAccentHex(normalizeHex(accentHex))}
              className={`${fieldClass} font-mono uppercase`}
              placeholder="#111111"
              spellCheck={false}
              maxLength={7}
            />
            <div
              className="mt-4 h-11 w-full rounded-lg border"
              style={{ backgroundColor: previewHex, borderColor: CARD_BORDER }}
              aria-hidden
            />
          </div>
        </div>
      </div>
    </>
  )
}
