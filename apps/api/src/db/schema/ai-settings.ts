// docs/feature/2.backend/3.agent/spec.md §3.1 — AI provider settings per user.
// API key is stored AES-256-GCM encrypted; the plaintext never leaves the
// encryption layer (src/modules/agent/crypto.ts).
import { pgTable, text } from 'drizzle-orm/pg-core'
import { appUser } from './user.ts'

export const aiSettings = pgTable('ai_settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => appUser.id, { onDelete: 'cascade' }),
  baseUrl: text('base_url').notNull().default('https://aimurah.my.id/api/v1'),
  // AES-256-GCM ciphertext — format: <iv_hex>:<tag_hex>:<ciphertext_hex>
  apiKeyEnc: text('api_key_enc'),
  model: text('model').notNull().default('claude-sonnet-4.5'),
})
