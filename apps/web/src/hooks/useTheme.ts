import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'better:theme'

/*
 * The same resolution the inline script in index.html runs before first paint:
 * an explicit choice wins, otherwise follow the OS. Kept in sync by hand
 * rather than shared, because that script has to be dependency-free.
 */
function resolveTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(resolveTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  /* Keep following the OS until the user makes a choice of their own */
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return
    const list = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setTheme(list.matches ? 'dark' : 'light')
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      localStorage.setItem(STORAGE_KEY, next)
      return next
    })
  }, [])

  return { theme, toggleTheme }
}
