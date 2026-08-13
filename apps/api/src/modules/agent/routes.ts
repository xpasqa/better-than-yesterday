// Assembles all agent sub-routes under /api/agent
// docs/feature/35.agent-orchestrator/spec.md §4
import { Hono } from 'hono'
import { settingsRoutes } from './settings-routes.ts'
import { chatRoutes } from './chat-routes.ts'
import { sessionRoutes } from './session-routes.ts'
import { commandRoutes } from './command-routes.ts'

export const agentRoutes = new Hono()

agentRoutes.route('/agent', settingsRoutes)
agentRoutes.route('/agent', chatRoutes)
agentRoutes.route('/agent', sessionRoutes)
agentRoutes.route('/agent', commandRoutes)
