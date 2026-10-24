import type { KeychatsTheme } from '@/lib/settings/theme'

type ThemeToggleProps = {
  theme: KeychatsTheme
}

export function ThemeToggle({ theme }: ThemeToggleProps) {
  const dark = theme === 'dark'

  return (
    <div
      data-current-theme={theme}
      className={`inline-flex rounded-xl border p-1 ${
        dark ? 'border-white/15 bg-white/5' : 'border-black/15 bg-black/[0.03]'
      }`}
    >
      {(['light', 'dark'] as const).map((value) => {
        const selected = theme === value
        return (
          <button
            key={value}
            type="submit"
            name="theme"
            value={value}
            aria-pressed={selected}
            data-theme-selected={selected ? value : undefined}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              selected
                ? dark
                  ? 'bg-white text-black shadow-sm ring-2 ring-white/80'
                  : 'bg-white text-black shadow-sm ring-2 ring-black/70'
                : dark
                  ? 'text-white/55 hover:text-white'
                  : 'text-black/55 hover:text-black'
            }`}
          >
            {selected ? '✓ ' : ''}{value === 'light' ? 'Light' : 'Dark'}
          </button>
        )
      })}
    </div>
  )
}
