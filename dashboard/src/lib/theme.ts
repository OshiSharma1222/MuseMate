import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const KEY = 'mm-theme'

/** Light unless this browser picked dark; the system setting is not followed. */
function stored(): Theme {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(stored)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(KEY, theme)
    } catch {
      // not persisted
    }
  }, [theme])

  return [theme, setTheme] as const
}
