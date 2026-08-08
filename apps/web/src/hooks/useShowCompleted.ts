import { useCallback, useState } from 'react'

const STORAGE_KEY = 'better:show-completed'

function readStored(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true'
}

export function useShowCompleted(): [boolean, () => void] {
  const [showCompleted, setShowCompleted] = useState<boolean>(readStored)

  const toggle = useCallback(() => {
    setShowCompleted((prev) => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, String(next))
      return next
    })
  }, [])

  return [showCompleted, toggle]
}
