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
        dark ? 'border-white/10 bg-white/5' : 'border-black/10 bg-black/[0.03]'
      }`}
    >
      {(['light', 'dark'] as const).map((value) => (
        <button
          key={value}
          type="submit"
          name="theme"
          value={value}
          aria-pressed={theme === value}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            theme === value
              ? dark
                ? 'bg-white text-black shadow-sm'
                : 'bg-white text-black shadow-sm'
              : dark
                ? 'text-white/55'
                : 'text-black/55'
          }`}
        >
          {value === 'light' ? 'Light' : 'Dark'}
        </button>
      ))}
    </div>
  )
}
