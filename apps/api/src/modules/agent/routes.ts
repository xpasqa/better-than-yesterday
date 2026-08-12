// Assembles all agent sub-routes under /api/agent
// docs/feature/2.backend/3.agent/spec.md §7
import { Hono } from 'hono'
import { settingsRoutes } from './settings-routes.ts'
import { chatRoutes } from './chat-routes.ts'
import { sessionRoutes } from './session-routes.ts'

export const agentRoutes = new Hono()

agentRoutes.route('/agent', settingsRoutes)
agentRoutes.route('/agent', chatRoutes)
agentRoutes.route('/agent', sessionRoutes)
