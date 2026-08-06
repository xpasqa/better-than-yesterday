// Storage service — area, folder, file CRUD + quota.
// docs/feature/2.backend/4.storage/spec.md §4, §6, §7
import { and, eq, isNull, sql, sum } from 'drizzle-orm'
import { db } from '../../db/client.ts'
import { storageArea, storageFolder, storageFile } from '../../db/schema/storage.ts'
import { appUser } from '../../db/schema/user.ts'
import { uuidv7 } from '@better/core/id'
import { wouldCreateCycle } from '@better/core/storage-tree'
import { AppError } from '../../http/errors.ts'

// ── Area ─────────────────────────────────────────────────────────────────────

export async function getOrCreatePersonalArea(userId: string) {
  const [existing] = await db
    .select()
    .from(storageArea)
    .where(and(eq(storageArea.userId, userId), eq(storageArea.kind, 'personal')))
    .limit(1)
  if (existing) return existing
  const [created] = await db
    .insert(storageArea)
    .values({ id: uuidv7(), userId, kind: 'personal', ownerId: null })
    .returning()
  return created!
}

export async function getOrCreateOwnerArea(userId: string, kind: string, ownerId: string) {
  const [existing] = await db
    .select()
    .from(storageArea)
    .where(and(eq(storageArea.userId, userId), eq(storageArea.ownerId, ownerId)))
    .limit(1)
  if (existing) return existing
  const [created] = await db
    .insert(storageArea)
    .values({ id: uuidv7(), userId, kind, ownerId })
    .returning()
  return created!
}

// ── Quota ─────────────────────────────────────────────────────────────────────

export async function getQuota(userId: string): Promise<{ usedBytes: bigint; limitBytes: bigint }> {
  const [usageRow] = await db
    .select({ used: sum(storageFile.sizeBytes) })
    .from(storageFile)
    .where(and(eq(storageFile.userId, userId), eq(storageFile.status, 'ready')))

  const [userRow] = await db
    .select({ quota: appUser.storageQuotaBytes })
    .from(appUser)
    .where(eq(appUser.id, userId))
    .limit(1)

  const usedBytes = BigInt(usageRow?.used ?? 0)
  const limitBytes = BigInt(userRow?.quota ?? 10737418240)
  return { usedBytes, limitBytes }
}

// ── Folders ───────────────────────────────────────────────────────────────────

export interface FolderDto {
  id: string
  areaId: string
  parentId: string | null
  name: string
  createdAt: string
  updatedAt: string
}

function folderToDto(row: typeof storageFolder.$inferSelect): FolderDto {
  return {
    id: row.id,
    areaId: row.areaId,
    parentId: row.parentId,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function getTreeFolders(areaId: string): Promise<FolderDto[]> {
  const rows = await db
    .select()
    .from(storageFolder)
    .where(eq(storageFolder.areaId, areaId))
    .orderBy(storageFolder.name)
  return rows.map(folderToDto)
}

export async function createFolder(
  userId: string,
  areaId: string,
  parentId: string | null,
  name: string,
): Promise<FolderDto> {
  const id = uuidv7()
  const now = new Date()
  const [row] = await db
    .insert(storageFolder)
    .values({ id, userId, areaId, parentId, name, createdAt: now, updatedAt: now })
    .returning()
  return folderToDto(row!)
}

export async function renameFolder(
  userId: string,
  folderId: string,
  name: string,
): Promise<FolderDto> {
  const [row] = await db
    .update(storageFolder)
    .set({ name, updatedAt: new Date() })
    .where(and(eq(storageFolder.id, folderId), eq(storageFolder.userId, userId)))
    .returning()
  if (!row) throw new AppError('NOT_FOUND', 404, 'Folder not found')
  return folderToDto(row)
}

export async function moveFolder(
  userId: string,
  folderId: string,
  newParentId: string | null,
): Promise<FolderDto> {
  // Load all folders for this user to detect cycles
  const allFolders = await db
    .select({ id: storageFolder.id, parentId: storageFolder.parentId })
    .from(storageFolder)
    .where(eq(storageFolder.userId, userId))

  if (wouldCreateCycle(allFolders, folderId, newParentId)) {
    throw new AppError('VALIDATION_ERROR', 400, 'Moving this folder would create a cycle')
  }

  const [row] = await db
    .update(storageFolder)
    .set({ parentId: newParentId, updatedAt: new Date() })
    .where(and(eq(storageFolder.id, folderId), eq(storageFolder.userId, userId)))
    .returning()
  if (!row) throw new AppError('NOT_FOUND', 404, 'Folder not found')
  return folderToDto(row)
}

export async function deleteFolder(userId: string, folderId: string): Promise<void> {
  // Cascade is handled by FK — deletes subfolders and files at DB level
  // S3 cleanup happens first via the route handler
  const result = await db
    .delete(storageFolder)
    .where(and(eq(storageFolder.id, folderId), eq(storageFolder.userId, userId)))
    .returning({ id: storageFolder.id })
  if (!result.length) throw new AppError('NOT_FOUND', 404, 'Folder not found')
}

// ── Files ─────────────────────────────────────────────────────────────────────

export interface FileDto {
  id: string
  areaId: string
  folderId: string | null
  name: string
  s3Key: string
  sizeBytes: string // bigint serialized as string
  mimeType: string
  status: string
  createdAt: string
  updatedAt: string
}

function fileToDto(row: typeof storageFile.$inferSelect): FileDto {
  return {
    id: row.id,
    areaId: row.areaId,
    folderId: row.folderId,
    name: row.name,
    s3Key: row.s3Key,
    sizeBytes: row.sizeBytes.toString(),
    mimeType: row.mimeType,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function getTreeFiles(areaId: string, folderId: string | null): Promise<FileDto[]> {
  const rows = await db
    .select()
    .from(storageFile)
    .where(
      and(
        eq(storageFile.areaId, areaId),
        folderId ? eq(storageFile.folderId, folderId) : isNull(storageFile.folderId),
        eq(storageFile.status, 'ready'),
      ),
    )
    .orderBy(storageFile.name)
  return rows.map(fileToDto)
}

export async function createPendingFile(
  userId: string,
  areaId: string,
  folderId: string | null,
  name: string,
  sizeBytes: bigint,
  mimeType: string,
  s3Key: string,
): Promise<FileDto> {
  const now = new Date()
  const [row] = await db
    .insert(storageFile)
    .values({ id: uuidv7(), userId, areaId, folderId, name, s3Key, sizeBytes, mimeType, status: 'pending', createdAt: now, updatedAt: now })
    .returning()
  return fileToDto(row!)
}

export async function confirmFile(userId: string, fileId: string, confirmedBytes: bigint): Promise<FileDto> {
  const [existing] = await db
    .select()
    .from(storageFile)
    .where(and(eq(storageFile.id, fileId), eq(storageFile.userId, userId)))
    .limit(1)
  if (!existing) throw new AppError('NOT_FOUND', 404, 'File not found')
  if (existing.sizeBytes !== confirmedBytes) {
    throw new AppError('CONFLICT', 409, `Size mismatch: expected ${existing.sizeBytes}, got ${confirmedBytes}`)
  }
  const [row] = await db
    .update(storageFile)
    .set({ status: 'ready', updatedAt: new Date() })
    .where(eq(storageFile.id, fileId))
    .returning()
  return fileToDto(row!)
}

export async function renameFile(userId: string, fileId: string, name: string): Promise<FileDto> {
  const [row] = await db
    .update(storageFile)
    .set({ name, updatedAt: new Date() })
    .where(and(eq(storageFile.id, fileId), eq(storageFile.userId, userId)))
    .returning()
  if (!row) throw new AppError('NOT_FOUND', 404, 'File not found')
  return fileToDto(row)
}

export async function moveFile(userId: string, fileId: string, newFolderId: string | null): Promise<FileDto> {
  const [row] = await db
    .update(storageFile)
    .set({ folderId: newFolderId, updatedAt: new Date() })
    .where(and(eq(storageFile.id, fileId), eq(storageFile.userId, userId)))
    .returning()
  if (!row) throw new AppError('NOT_FOUND', 404, 'File not found')
  return fileToDto(row)
}

export async function deleteFile(userId: string, fileId: string): Promise<{ s3Key: string }> {
  const [row] = await db
    .delete(storageFile)
    .where(and(eq(storageFile.id, fileId), eq(storageFile.userId, userId)))
    .returning({ s3Key: storageFile.s3Key })
  if (!row) throw new AppError('NOT_FOUND', 404, 'File not found')
  return { s3Key: row.s3Key }
}

// ── Orphan sweep ──────────────────────────────────────────────────────────────

/** Returns pending file rows older than `olderThanMs` milliseconds. */
export async function getPendingOrphans(olderThanMs: number): Promise<Array<{ id: string; s3Key: string }>> {
  const cutoff = new Date(Date.now() - olderThanMs)
  return db
    .select({ id: storageFile.id, s3Key: storageFile.s3Key })
    .from(storageFile)
    .where(and(eq(storageFile.status, 'pending'), sql`${storageFile.createdAt} < ${cutoff}`))
}

export async function deletePendingOrphans(ids: string[]): Promise<void> {
  if (!ids.length) return
  await db.delete(storageFile).where(sql`${storageFile.id} = ANY(${ids})`)
}
