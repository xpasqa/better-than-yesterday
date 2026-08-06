// docs/feature/2.backend/3.agent/spec.md §5 — artefact files created by the
// agent. Only markdown. Content is stored in full; size limit enforced in service.
import { pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { appUser } from './user.ts'
import { agentProject } from './agent-project.ts'

export const agentFile = pgTable(
  'agent_file',
  {
    id: text('id').primaryKey(), // UUIDv7
    userId: text('user_id')
      .notNull()
      .references(() => appUser.id, { onDelete: 'cascade' }),
    projectId: text('project_id')
      .notNull()
      .references(() => agentProject.id, { onDelete: 'cascade' }),
    // Slash-separated relative path, e.g. 'docs/riset-pasar.md'
    path: text('path').notNull(),
    content: text('content').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    // Each path is unique within a project (deleted rows keep the path locked until hard-deleted)
    uniqueIndex('agent_file_project_path').on(table.projectId, table.path),
  ],
)
