// AI settings service — read/write per-user provider configuration.
// docs/feature/2.backend/3.agent/spec.md §3.1
import { eq } from 'drizzle-orm'
import { db } from '../../db/client.ts'
import { aiSettings } from '../../db/schema/ai-settings.ts'
import { encryptApiKey, decryptApiKey } from './crypto.ts'

export interface AiSettingsDto {
  baseUrl: string
  model: string
  hasApiKey: boolean
}

export async function getAiSettings(userId: string): Promise<AiSettingsDto> {
  const [row] = await db.select().from(aiSettings).where(eq(aiSettings.userId, userId)).limit(1)
  if (!row) {
    return { baseUrl: 'https://aimurah.my.id/api/v1', model: 'claude-sonnet-4.5', hasApiKey: false }
  }
  return { baseUrl: row.baseUrl, model: row.model, hasApiKey: row.apiKeyEnc !== null }
}

export async function getApiKey(userId: string): Promise<string | null> {
  const [row] = await db.select().from(aiSettings).where(eq(aiSettings.userId, userId)).limit(1)
  if (!row?.apiKeyEnc) return null
  return decryptApiKey(row.apiKeyEnc)
}

export interface SaveAiSettingsInput {
  baseUrl: string
  model: string
  apiKey?: string // if omitted, existing key is kept
}

export async function saveAiSettings(userId: string, input: SaveAiSettingsInput): Promise<void> {
  const existing = await db.select().from(aiSettings).where(eq(aiSettings.userId, userId)).limit(1)
  const existingKeyEnc = existing[0]?.apiKeyEnc ?? null

  const apiKeyEnc = input.apiKey ? encryptApiKey(input.apiKey) : existingKeyEnc

  await db
    .insert(aiSettings)
    .values({
      userId,
      baseUrl: input.baseUrl,
      model: input.model,
      apiKeyEnc,
    })
    .onConflictDoUpdate({
      target: aiSettings.userId,
      set: { baseUrl: input.baseUrl, model: input.model, apiKeyEnc },
    })
}
