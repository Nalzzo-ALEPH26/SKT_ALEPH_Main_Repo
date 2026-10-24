export type KeychatsTheme = 'light' | 'dark'

export function normalizeTheme(value: unknown): KeychatsTheme {
  if (value === 'light' || value === 'dark') return value
  throw new Error('THEME_INVALID')
}
