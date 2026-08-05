import { useEffect, useState } from 'react'

/*
 * Reads a media query from JS. Only for the handful of decisions CSS can't
 * make on its own — e.g. the sidebar is a docked column on desktop but a
 * drawer with its own open/closed state below 1024px, and that state has to
 * live in React.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches
  )

  useEffect(() => {
    const list = window.matchMedia(query)
    const onChange = () => setMatches(list.matches)
    onChange()
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [query])

  return matches
}
