import type { CSSProperties, ReactNode } from 'react'
import { HsvaColorPicker } from 'react-colorful'
import { usePreferences } from '../../contexts/usePreferences'
import { normalizeHex } from '../../lib/logoFilter'
import { hexToHsva, hsvaToHex } from '../../lib/appearanceTheme'

const CARD_BORDER = '#ebebeb'

const fieldClass =
  'min-w-0 flex-1 rounded-lg border border-[#ebebeb] bg-white px-3 py-2.5 text-sm text-[#111111] outline-none transition focus:border-[var(--margen-accent)] focus:ring-2 focus:ring-[var(--margen-accent-muted)]'

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
      style={style}
      className={[
        'flex min-h-[108px] flex-1 flex-col items-center justify-center gap-3 rounded-xl border-2 p-4 transition',
        selected ? 'border-[var(--margen-accent)]' : 'border-transparent',
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
        <p className="text-sm font-medium text-[#111111]">Theme</p>
        <p className="mt-1 text-xs leading-relaxed text-[#888888]">
          Applies immediately across the dashboard.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <ThemeCard
            selected={themeMode === 'light'}
            onClick={() => setThemeMode('light')}
            className="bg-white shadow-sm ring-1 ring-[#ebebeb]"
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
            className="relative overflow-hidden shadow-sm ring-1 ring-[#ebebeb]"
            style={{
              background: 'linear-gradient(90deg, #ffffff 50%, #111111 50%)',
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

      <div className="mt-8 border-t pt-8" style={{ borderColor: CARD_BORDER }}>
        <p className="text-sm font-medium text-[#111111]">Accent color</p>
        <p className="mt-1 text-xs leading-relaxed text-[#888888]">
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
            <label className="text-xs font-medium text-[#555555]" htmlFor="settings-accent-hex">
              Hex
            </label>
            <div className="flex items-center gap-3">
              <div
                className="h-11 w-11 shrink-0 rounded-lg border shadow-inner"
                style={{ backgroundColor: previewHex, borderColor: CARD_BORDER }}
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
