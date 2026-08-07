// Storage routes — presign, confirm, download, tree, folder CRUD, file ops, usage.
// docs/feature/2.backend/4.storage/spec.md §6
import { Hono } from 'hono'
import { z } from 'zod'
import { PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { AppError } from '../../http/errors.ts'
import { validateUpload } from '@better/core/storage-validate'
import { s3, S3_BUCKET, storageKey } from '../../db/s3-client.ts'
import {
  getOrCreatePersonalArea, getOrCreateOwnerArea,
  getQuota, getTreeFolders, getTreeFiles,
  createFolder, renameFolder, moveFolder, deleteFolder, getFileKeysUnderFolder,
  createPendingFile, confirmFile, renameFile, moveFile, deleteFile,
} from './service.ts'
import { uuidv7 } from '@better/core/id'

export const storageRoutes = new Hono()

function requireS3() {
  if (!s3) throw new AppError('INTERNAL', 500, 'Storage not configured')
}

// ── Tree ──────────────────────────────────────────────────────────────────────

const treeQuery = z.object({
  kind: z.enum(['personal', 'todo-attachment', 'outline', 'agent']).default('personal'),
  ownerId: z.string().optional(),
  folderId: z.string().nullable().optional(),
})

storageRoutes.get('/storage/tree', async (c) => {
  const userId = c.get('userId')
  const q = treeQuery.safeParse(Object.fromEntries(new URL(c.req.url).searchParams))
  if (!q.success) throw new AppError('VALIDATION_ERROR', 422, 'Invalid query', q.error.flatten())

  const area = q.data.kind === 'personal'
    ? await getOrCreatePersonalArea(userId)
    : await getOrCreateOwnerArea(userId, q.data.kind, q.data.ownerId ?? '')

  const [folders, files] = await Promise.all([
    getTreeFolders(area.id),
    getTreeFiles(area.id, q.data.folderId ?? null),
  ])

  return c.json({ area: { id: area.id, kind: area.kind }, folders, files })
})

// ── Usage / quota ─────────────────────────────────────────────────────────────

storageRoutes.get('/storage/usage', async (c) => {
  const userId = c.get('userId')
  const { usedBytes, limitBytes } = await getQuota(userId)
  return c.json({ usedBytes: usedBytes.toString(), limitBytes: limitBytes.toString() })
})

// ── Presign ───────────────────────────────────────────────────────────────────

const presignInput = z.object({
  areaKind: z.enum(['personal', 'todo-attachment', 'outline', 'agent']).default('personal'),
  ownerId: z.string().optional(),
  folderId: z.string().nullable().optional(),
  name: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(200),
  sizeBytes: z.number().int().positive(),
})

storageRoutes.post('/storage/files/presign', async (c) => {
  requireS3()
  const userId = c.get('userId')
  const body = await c.req.json().catch(() => null)
  const parsed = presignInput.safeParse(body)
  if (!parsed.success) throw new AppError('VALIDATION_ERROR', 422, 'Invalid input', parsed.error.flatten())

  const { areaKind, ownerId, folderId, name, mimeType, sizeBytes } = parsed.data
  const { usedBytes, limitBytes } = await getQuota(userId)

  const validation = validateUpload(
    { name, mimeType, sizeBytes },
    { usedBytes: Number(usedBytes), limitBytes: Number(limitBytes) },
  )
  if (!validation.ok) {
    throw new AppError('VALIDATION_ERROR', 422, 'Upload rejected', validation.error)
  }

  const area = areaKind === 'personal'
    ? await getOrCreatePersonalArea(userId)
    : await getOrCreateOwnerArea(userId, areaKind, ownerId ?? '')

  const fileId = uuidv7()
  const key = storageKey(userId, fileId)

  const url = await getSignedUrl(
    s3!,
    new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, ContentType: mimeType, ContentLength: sizeBytes }),
    { expiresIn: 300 }, // 5 minutes
  )

  const file = await createPendingFile(
    userId, area.id, folderId ?? null, name, BigInt(sizeBytes), mimeType, key,
  )

  return c.json({ file, uploadUrl: url }, 201)
})

// ── Confirm ───────────────────────────────────────────────────────────────────

storageRoutes.post('/storage/files/:id/confirm', async (c) => {
  requireS3()
  const userId = c.get('userId')
  const fileId = c.req.param('id')

  const head = await s3!.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: storageKey(userId, fileId) })) as { ContentLength?: number }
  if (!head.ContentLength) throw new AppError('CONFLICT', 409, 'Object not found in S3')

  const file = await confirmFile(userId, fileId, BigInt(head.ContentLength))
  return c.json({ file })
})

// ── Download ──────────────────────────────────────────────────────────────────

storageRoutes.get('/storage/files/:id/download', async (c) => {
  requireS3()
  const userId = c.get('userId')
  const fileId = c.req.param('id')

  const url = await getSignedUrl(
    s3!,
    new GetObjectCommand({ Bucket: S3_BUCKET, Key: storageKey(userId, fileId) }),
    { expiresIn: 300 },
  )
  return c.json({ url })
})

// ── File ops ──────────────────────────────────────────────────────────────────

storageRoutes.patch('/storage/files/:id/rename', async (c) => {
  const userId = c.get('userId')
  const fileId = c.req.param('id')
  const body = await c.req.json().catch(() => null)
  const parsed = z.object({ name: z.string().min(1).max(255) }).safeParse(body)
  if (!parsed.success) throw new AppError('VALIDATION_ERROR', 422, 'Invalid input', parsed.error.flatten())
  const file = await renameFile(userId, fileId, parsed.data.name)
  return c.json({ file })
})

storageRoutes.patch('/storage/files/:id/move', async (c) => {
  const userId = c.get('userId')
  const fileId = c.req.param('id')
  const body = await c.req.json().catch(() => null)
  const parsed = z.object({ folderId: z.string().nullable() }).safeParse(body)
  if (!parsed.success) throw new AppError('VALIDATION_ERROR', 422, 'Invalid input', parsed.error.flatten())
  const file = await moveFile(userId, fileId, parsed.data.folderId)
  return c.json({ file })
})

storageRoutes.delete('/storage/files/:id', async (c) => {
  requireS3()
  const userId = c.get('userId')
  const fileId = c.req.param('id')
  const { s3Key } = await deleteFile(userId, fileId)
  await s3!.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: s3Key }))
  return c.body(null, 204)
})

// ── Folder ops ────────────────────────────────────────────────────────────────

const folderCreateInput = z.object({
  areaId: z.string().min(1),
  parentId: z.string().nullable().default(null),
  name: z.string().min(1).max(255),
})

storageRoutes.post('/storage/folders', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json().catch(() => null)
  const parsed = folderCreateInput.safeParse(body)
  if (!parsed.success) throw new AppError('VALIDATION_ERROR', 422, 'Invalid input', parsed.error.flatten())
  const folder = await createFolder(userId, parsed.data.areaId, parsed.data.parentId, parsed.data.name)
  return c.json({ folder }, 201)
})

storageRoutes.patch('/storage/folders/:id/rename', async (c) => {
  const userId = c.get('userId')
  const folderId = c.req.param('id')
  const body = await c.req.json().catch(() => null)
  const parsed = z.object({ name: z.string().min(1).max(255) }).safeParse(body)
  if (!parsed.success) throw new AppError('VALIDATION_ERROR', 422, 'Invalid input', parsed.error.flatten())
  const folder = await renameFolder(userId, folderId, parsed.data.name)
  return c.json({ folder })
})

storageRoutes.patch('/storage/folders/:id/move', async (c) => {
  const userId = c.get('userId')
  const folderId = c.req.param('id')
  const body = await c.req.json().catch(() => null)
  const parsed = z.object({ parentId: z.string().nullable() }).safeParse(body)
  if (!parsed.success) throw new AppError('VALIDATION_ERROR', 422, 'Invalid input', parsed.error.flatten())
  const folder = await moveFolder(userId, folderId, parsed.data.parentId)
  return c.json({ folder })
})

storageRoutes.delete('/storage/folders/:id', async (c) => {
  requireS3()
  const userId = c.get('userId')
  const folderId = c.req.param('id')

  // Collect every file key in this folder and all its descendants before cascade delete
  const keys = await getFileKeysUnderFolder(userId, folderId)
  if (keys.length > 0) {
    await s3!.send(new DeleteObjectsCommand({
      Bucket: S3_BUCKET,
      Delete: { Objects: keys.map((key) => ({ Key: key })) },
    }))
  }

  await deleteFolder(userId, folderId)
  return c.body(null, 204)
})
