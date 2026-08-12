import { describe, expect, it } from 'vitest'
import { decryptSecret, encryptSecret } from './crypto.ts'

describe('encryptSecret / decryptSecret', () => {
  it('round-trip: decryptSecret(encryptSecret(x)) === x', () => {
    const plaintext = 'my-super-secret-password-123!'
    expect(decryptSecret(encryptSecret(plaintext))).toBe(plaintext)
  })

  it('round-trip works with empty string', () => {
    expect(decryptSecret(encryptSecret(''))).toBe('')
  })

  it('random IV: two encryptions of the same value produce different ciphertexts', () => {
    const plaintext = 'same-value'
    const enc1 = encryptSecret(plaintext)
    const enc2 = encryptSecret(plaintext)
    expect(enc1).not.toBe(enc2)
  })

  it('format has three colon-separated parts', () => {
    const enc = encryptSecret('test')
    expect(enc.split(':')).toHaveLength(3)
  })

  it('throws on a bad payload (too few parts)', () => {
    expect(() => decryptSecret('bad')).toThrow()
  })

  it('throws on a tampered ciphertext', () => {
    const enc = encryptSecret('tamper-me')
    // Flip the last char of the ciphertext section to break the GCM auth tag
    const parts = enc.split(':')
    const last = parts[2]!
    parts[2] = last.slice(0, -1) + (last.endsWith('0') ? '1' : '0')
    expect(() => decryptSecret(parts.join(':'))).toThrow()
  })
})
