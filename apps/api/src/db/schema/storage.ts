// docs/feature/2.backend/4.storage/spec.md §4
// storage_area, storage_folder, storage_file — one bucket, four areas.
import { bigint, check, index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import { appUser } from './user.ts'

export const storageArea = pgTable(
  'storage_area',
  {
    id: text('id').primaryKey(), // UUIDv7, server-generated
    userId: text('user_id')
      .notNull()
      .references(() => appUser.id, { onDelete: 'cascade' }),
    // 'personal' | 'todo-attachment' | 'outline' | 'agent'
    kind: text('kind').notNull(),
    // For owner-scoped areas: node.id (todo/outline) or agent_project.id (agent)
    // NULL for 'personal'
    ownerId: text('owner_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One personal area per user
    uniqueIndex('storage_area_personal').on(table.userId).where(sql`${table.kind} = 'personal'`),
    // One area per owner (for owner-scoped areas)
    uniqueIndex('storage_area_owner').on(table.userId, table.ownerId).where(sql`${table.ownerId} IS NOT NULL`),
    check('storage_area_kind_check', sql`${table.kind} IN ('personal','todo-attachment','outline','agent')`),
  ],
)

export const storageFolder = pgTable(
  'storage_folder',
  {
    id: text('id').primaryKey(), // UUIDv7, server-generated
    userId: text('user_id')
      .notNull()
      .references(() => appUser.id, { onDelete: 'cascade' }),
    areaId: text('area_id')
      .notNull()
      .references(() => storageArea.id, { onDelete: 'cascade' }),
    parentId: text('parent_id').references((): AnyPgColumn => storageFolder.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('storage_folder_area_parent').on(table.areaId, table.parentId),
    index('storage_folder_user').on(table.userId),
    check('storage_folder_name_check', sql`length(trim(${table.name})) BETWEEN 1 AND 255`),
  ],
)

export const storageFile = pgTable(
  'storage_file',
  {
    id: text('id').primaryKey(), // UUIDv7, server-generated
    userId: text('user_id')
      .notNull()
      .references(() => appUser.id, { onDelete: 'cascade' }),
    areaId: text('area_id')
      .notNull()
      .references(() => storageArea.id, { onDelete: 'cascade' }),
    folderId: text('folder_id').references(() => storageFolder.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    // 'storage/{user_id}/{file_id}' — no original filename in key
    s3Key: text('s3_key').notNull().unique(),
    sizeBytes: bigint('size_bytes', { mode: 'bigint' }).notNull(),
    mimeType: text('mime_type').notNull(),
    // 'pending' until confirmed via HeadObject; 'ready' after confirm
    status: text('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('storage_file_area_folder').on(table.areaId, table.folderId),
    index('storage_file_user_ready').on(table.userId).where(sql`${table.status} = 'ready'`),
    index('storage_file_pending').on(table.createdAt).where(sql`${table.status} = 'pending'`),
    check('storage_file_size_check', sql`${table.sizeBytes} > 0`),
    check('storage_file_status_check', sql`${table.status} IN ('pending','ready')`),
    check('storage_file_name_check', sql`length(trim(${table.name})) BETWEEN 1 AND 255`),
  ],
)
