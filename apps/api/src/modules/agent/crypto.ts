// AES-256-GCM encryption for AI API keys at rest.
// Format: <iv_hex>:<tag_hex>:<ciphertext_hex>
// Key is derived from APP_ENCRYPTION_KEY via SHA-256 to ensure exactly 32 bytes.
// docs/feature/2.backend/3.agent/spec.md §3.1
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { config } from '../../config.ts'

function derivedKey(): Buffer {
  return createHash('sha256').update(config.APP_ENCRYPTION_KEY).digest()
}

export function encryptApiKey(plaintext: string): string {
  const key = derivedKey()
  const iv = randomBytes(12) // 96-bit IV for GCM
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${ciphertext.toString('hex')}`
}

export function decryptApiKey(enc: string): string {
  const parts = enc.split(':')
  if (parts.length !== 3) throw new Error('Invalid encrypted API key format')
  const [ivHex, tagHex, ciphertextHex] = parts as [string, string, string]
  const key = derivedKey()
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const ciphertext = Buffer.from(ciphertextHex, 'hex')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8')
}
