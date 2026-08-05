// URL <-> view mapping (2.outline/spec.md §8: every view gets a real
// address, not just Outline's zoom). Parsed by hand rather than via
// react-router's <Route>/useParams — App.tsx is one component mounted at
// "/*", and a handful of paths this shallow don't earn the extra structure.
import type { ViewType } from './types'

const PLAIN_VIEWS: ViewType[] = ['inbox', 'today', 'upcoming', 'filters', 'outline', 'mail', 'storage', 'agent']

export function pathForView(view: ViewType, projectId?: string | null): string {
  if (view === 'project' && projectId) return `/project/${projectId}`
  return `/${view}`
}

export function deriveViewFromPathname(pathname: string): { view: ViewType; projectId: string | null } {
  const [, first, second] = pathname.split('/')
  if (first === 'project' && second) return { view: 'project', projectId: second }
  if (first && (PLAIN_VIEWS as string[]).includes(first)) {
    return { view: first as ViewType, projectId: null }
  }
  return { view: 'today', projectId: null }
}
