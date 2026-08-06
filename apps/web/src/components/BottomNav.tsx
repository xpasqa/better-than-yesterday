import { useNavigate, useLocation } from 'react-router-dom'
import { CalendarCheckIcon, TrayIcon, RobotIcon, DotsThreeIcon } from '@phosphor-icons/react'
import { deriveViewFromPathname, pathForView } from '../routes'
import './BottomNav.css'

interface BottomNavProps {
  onMorePress: () => void
}

export default function BottomNav({ onMorePress }: BottomNavProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { view: activeView } = deriveViewFromPathname(location.pathname)

  const tabs = [
    { id: 'today', label: 'Today', icon: CalendarCheckIcon },
    { id: 'inbox', label: 'Inbox', icon: TrayIcon },
    { id: 'agent', label: 'Agent', icon: RobotIcon },
  ] as const

  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          className={`bottom-nav__tab${activeView === id ? ' bottom-nav__tab--active' : ''}`}
          onClick={() => navigate(pathForView(id))}
          type="button"
          aria-label={label}
          aria-current={activeView === id ? 'page' : undefined}
        >
          <Icon size={24} weight={activeView === id ? 'fill' : 'regular'} />
          <span className="bottom-nav__label">{label}</span>
        </button>
      ))}
      <button
        className="bottom-nav__tab"
        onClick={onMorePress}
        type="button"
        aria-label="More"
      >
        <DotsThreeIcon size={24} />
        <span className="bottom-nav__label">More</span>
      </button>
    </nav>
  )
}
