import type { CSSProperties, ReactNode } from 'react'
import { HsvaColorPicker } from 'react-colorful'
import { usePreferences } from '../../contexts/usePreferences'
import { normalizeHex } from '../../lib/logoFilter'
import { hexToHsva, hsvaToHex } from '../../lib/appearanceTheme'

const fieldClass =
  'min-w-0 flex-1 rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2.5 text-sm text-[var(--color-margen-text)] outline-none transition focus:border-[var(--margen-accent)] focus:ring-2 focus:ring-[var(--margen-accent-muted)]'

function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
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

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 14.5A8.5 8.5 0 0 1 9.5 3 10 10 0 0 0 21 14.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function MonitorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 20h8M12 16v4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

function ThemeCard({
  selected,
  onClick,
  children,
  className,
  style,
}: {
  selected: boolean
  onClick: () => void
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...style,
        borderColor: selected ? 'var(--margen-accent)' : 'var(--color-margen-border)',
        boxShadow: selected ? '0 0 0 1px var(--margen-accent)' : undefined,
      }}
      className={[
        'flex min-h-[108px] flex-1 flex-col items-center justify-center gap-3 rounded-xl border-2 p-4 transition',
        className ?? '',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

export function AppearanceSettings() {
  const { accentHex, setAccentHex, themeMode, setThemeMode } = usePreferences()
  const previewHex = normalizeHex(accentHex)

  return (
    <>
      <div>
        <p className="text-sm font-medium text-[var(--color-margen-text)]">Theme</p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--color-margen-muted)]">
          Applies immediately across the dashboard.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <ThemeCard
            selected={themeMode === 'light'}
            onClick={() => setThemeMode('light')}
            className="bg-white shadow-sm"
          >
            <SunIcon className="text-[#111111]" />
            <span className="text-sm font-medium text-[#111111]">Light</span>
          </ThemeCard>

          <ThemeCard
            selected={themeMode === 'dark'}
            onClick={() => setThemeMode('dark')}
            className="bg-[#111111] shadow-sm"
          >
            <MoonIcon className="text-white" />
            <span className="text-sm font-medium text-white">Dark</span>
          </ThemeCard>

          <ThemeCard
            selected={themeMode === 'system'}
            onClick={() => setThemeMode('system')}
            className="relative overflow-hidden shadow-sm"
            style={{
              background: 'linear-gradient(90deg, #ffffff 50%, #1a1a1a 50%)',
            }}
          >
            <span className="relative z-[1] flex flex-col items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/90 text-[#111111] shadow-sm">
                <MonitorIcon />
              </span>
              <span className="rounded-md bg-white/90 px-2 py-0.5 text-sm font-medium text-[#111111] shadow-sm">
                System
              </span>
            </span>
          </ThemeCard>
        </div>
      </div>

      <div className="mt-8 border-t border-[var(--color-margen-border)] pt-8">
        <p className="text-sm font-medium text-[var(--color-margen-text)]">Accent color</p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--color-margen-muted)]">
          Pick a color on the wheel — no system dialogs. Save to keep it on your account.
        </p>
        <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-start">
          <div
            className="settings-color-wheel w-full max-w-[240px] shrink-0 [&_.react-colorful]:h-[200px] [&_.react-colorful]:w-full [&_.react-colorful]:rounded-lg"
            role="group"
            aria-label="Accent color wheel"
          >
            <HsvaColorPicker
              color={hexToHsva(accentHex)}
              onChange={(hsva) => setAccentHex(hsvaToHex(hsva))}
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 sm:max-w-xs">
            <label className="text-xs font-medium text-[var(--color-margen-text-secondary)]" htmlFor="settings-accent-hex">
              Hex
            </label>
            <div className="flex items-center gap-3">
              <div
                className="h-11 w-11 shrink-0 rounded-lg border shadow-inner"
                style={{ backgroundColor: previewHex, borderColor: 'var(--color-margen-border)' }}
                title={previewHex}
                aria-label={`Preview ${previewHex}`}
              />
              <input
                id="settings-accent-hex"
                type="text"
                inputMode="text"
                autoComplete="off"
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
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
