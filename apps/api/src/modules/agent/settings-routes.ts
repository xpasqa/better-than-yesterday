// POST /api/agent/settings — GET/PUT AI provider settings
// docs/feature/2.backend/3.agent/spec.md §3.1
import { Hono } from 'hono'
import { z } from 'zod'
import { AppError } from '../../http/errors.ts'
import { getAiSettings, saveAiSettings } from './settings-service.ts'

export const settingsRoutes = new Hono()

const saveInput = z.object({
  baseUrl: z.string().url().max(200),
  model: z.string().min(1).max(100),
  apiKey: z.string().min(1).max(500).optional(),
})

settingsRoutes.get('/settings', async (c) => {
  const userId = c.get('userId')
  const settings = await getAiSettings(userId)
  return c.json({ settings })
})

settingsRoutes.put('/settings', async (c) => {
  const userId = c.get('userId')
  const body = await c.req.json().catch(() => null)
  const parsed = saveInput.safeParse(body)
  if (!parsed.success) {
    throw new AppError('VALIDATION_ERROR', 422, 'Invalid settings input', parsed.error.flatten())
  }
  await saveAiSettings(userId, parsed.data)
  return c.json({ ok: true })
})
