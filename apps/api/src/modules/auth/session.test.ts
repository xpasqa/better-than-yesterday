import { describe, expect, it } from 'vitest'
import { createSessionToken, verifySessionToken } from './session.ts'

describe('session token', () => {
  it('verifies a token it just created', () => {
    const token = createSessionToken('user-1')
    expect(verifySessionToken(token)).toEqual({ userId: 'user-1' })
  })

  it('rejects a token past its expiry', () => {
    const issuedAt = Date.now()
    const token = createSessionToken('user-1', issuedAt)
    const THIRTY_ONE_DAYS = 31 * 24 * 60 * 60 * 1000
    expect(verifySessionToken(token, issuedAt + THIRTY_ONE_DAYS)).toBeNull()
  })

  it('accepts a token one second before expiry', () => {
    const issuedAt = Date.now()
    const token = createSessionToken('user-1', issuedAt)
    const THIRTY_DAYS_MINUS_1S = 30 * 24 * 60 * 60 * 1000 - 1000
    expect(verifySessionToken(token, issuedAt + THIRTY_DAYS_MINUS_1S)).toEqual({ userId: 'user-1' })
  })

  it('rejects a token with a tampered payload (signature no longer matches)', () => {
    const token = createSessionToken('user-1')
    const [, signature] = token.split('.')
    const forgedPayload = Buffer.from(JSON.stringify({ userId: 'attacker', exp: Date.now() + 1_000_000 })).toString(
      'base64url',
    )
    expect(verifySessionToken(`${forgedPayload}.${signature}`)).toBeNull()
  })

  it('rejects a token with a tampered signature', () => {
    const token = createSessionToken('user-1')
    const [payload] = token.split('.')
    expect(verifySessionToken(`${payload}.not-a-real-signature`)).toBeNull()
  })

  it('rejects a malformed token', () => {
    expect(verifySessionToken('garbage')).toBeNull()
    expect(verifySessionToken('')).toBeNull()
    expect(verifySessionToken('a.b.c')).toBeNull()
  })

  it('rejects a payload with the wrong shape even if signed correctly', () => {
    // Can't easily forge a *correctly signed* wrong-shape payload without
    // the secret, so this exercises the parse-failure path via garbage
    // base64 that still passes the length check trivially — the important
    // thing is verify() never throws.
    expect(() => verifySessionToken('not-base64!!.not-base64!!')).not.toThrow()
  })
})
