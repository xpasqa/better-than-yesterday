import { MoonIcon, SunIcon } from '@phosphor-icons/react'
import type { Theme } from '../hooks/useTheme'
import './ThemeToggle.css'

interface ThemeToggleProps {
  theme: Theme
  onToggle: () => void
  /* The compact top bar sizes its controls larger than the sidebar header */
  size?: 'small' | 'large'
}

export default function ThemeToggle({ theme, onToggle, size = 'small' }: ThemeToggleProps) {
  const isDark = theme === 'dark'
  return (
    <button
      className={`theme-toggle theme-toggle--${size}`}
      onClick={onToggle}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      type="button"
    >
      {isDark ? <SunIcon size={size === 'large' ? 20 : 18} /> : <MoonIcon size={size === 'large' ? 20 : 18} />}
    </button>
  )
}
