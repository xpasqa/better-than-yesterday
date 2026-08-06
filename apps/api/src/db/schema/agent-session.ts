// docs/feature/2.backend/3.agent/spec.md §4 — one row per conversation. Stores
// SESSION.md (working notes) and the full message history for undo support.
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { appUser } from './user.ts'
import { agentProject } from './agent-project.ts'

export const agentSession = pgTable('agent_session', {
  id: text('id').primaryKey(), // UUIDv7
  userId: text('user_id')
    .notNull()
    .references(() => appUser.id, { onDelete: 'cascade' }),
  projectId: text('project_id')
    .notNull()
    .references(() => agentProject.id, { onDelete: 'cascade' }),
  // SESSION.md content — max 8 000 chars enforced in service
  memory: text('memory').notNull().default(''),
  // Full message history as JSON (array of OpenAI ChatCompletionMessageParam)
  // Used for undo and context assembly. Max ~50 turns before compaction.
  history: text('history').notNull().default('[]'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  // null = active session; set when user starts "New task"
  closedAt: timestamp('closed_at', { withTimezone: true }),
})
