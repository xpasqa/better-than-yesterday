// docs/feature/2.backend/3.agent/spec.md §4 — one agent project per user
// project node. Stores PROJECT.md (memory) and the manifest of artefact files.
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { appUser } from './user.ts'
import { node } from './node.ts'

export const agentProject = pgTable('agent_project', {
  id: text('id').primaryKey(), // UUIDv7
  userId: text('user_id')
    .notNull()
    .references(() => appUser.id, { onDelete: 'cascade' }),
  // The corresponding project node in the task tree (nullable: AGENT.md has no node)
  nodeId: text('node_id').references(() => node.id, { onDelete: 'cascade' }),
  // 'global' for the AGENT.md row; 'project' for PROJECT.md rows
  kind: text('kind', { enum: ['global', 'project'] }).notNull().default('project'),
  // Memory file content (AGENT.md or PROJECT.md) — max 4 000 / 8 000 chars enforced in service
  memory: text('memory').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
})
