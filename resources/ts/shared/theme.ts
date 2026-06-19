const STORAGE_KEY = 'imtera-theme'

export type AppTheme = 'light' | 'dark'

export function getStoredTheme(): AppTheme {
  const stored = localStorage.getItem(STORAGE_KEY)

  if (stored === 'light' || stored === 'dark') {
    return stored
  }

  return 'dark'
}

export function storeTheme(theme: AppTheme): void {
  localStorage.setItem(STORAGE_KEY, theme)
}
