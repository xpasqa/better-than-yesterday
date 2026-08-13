import { useNavigate, useLocation } from 'react-router-dom'
import { CalendarBlankIcon, CalendarDotsIcon, TrayIcon, DotsThreeIcon } from '@phosphor-icons/react'
import { deriveViewFromPathname, pathForView } from '../routes'
import './BottomNav.css'

interface BottomNavProps {
  /** Whether the More popup is currently open — drives the tab's active/pressed look. */
  moreOpen: boolean
  onMorePress: () => void
}

// Three fixed tabs — everything else (Anytime, Someday, Logbook, Tags,
// Projects, Workspace, Recent Chats) lives behind More as a small popup,
// not a fourth/fifth tab (34.sidebar-workspace follow-up).
export default function BottomNav({ moreOpen, onMorePress }: BottomNavProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { view: activeView } = deriveViewFromPathname(location.pathname)

  const tabs = [
    { id: 'inbox', label: 'Inbox', icon: TrayIcon },
    { id: 'today', label: 'Today', icon: CalendarBlankIcon },
    { id: 'upcoming', label: 'Upcoming', icon: CalendarDotsIcon },
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
        className={`bottom-nav__tab${moreOpen ? ' bottom-nav__tab--active' : ''}`}
        onClick={onMorePress}
        type="button"
        aria-label="More"
        aria-haspopup="true"
        aria-expanded={moreOpen}
      >
        <DotsThreeIcon size={24} weight={moreOpen ? 'bold' : 'regular'} />
        <span className="bottom-nav__label">More</span>
      </button>
    </nav>
  )
}
