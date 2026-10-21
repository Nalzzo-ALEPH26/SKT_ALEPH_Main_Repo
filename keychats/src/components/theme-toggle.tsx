export type KeychatsTheme = 'light' | 'dark'

type ThemeToggleProps = {
  theme: KeychatsTheme
}

export function ThemeToggle({ theme }: ThemeToggleProps) {
  return (
    <div data-current-theme={theme} className="inline-flex rounded-xl border border-black/10 bg-black/[0.03] p-1">
      {(['light', 'dark'] as const).map((value) => (
        <button
          key={value}
          type="submit"
          name="theme"
          value={value}
          aria-pressed={theme === value}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            theme === value ? 'bg-white shadow-sm' : 'text-black/55'
          }`}
        >
          {value === 'light' ? 'Light' : 'Dark'}
        </button>
      ))}
    </div>
  )
}
