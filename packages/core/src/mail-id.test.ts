import { describe, it, expect } from 'vitest'
import { encodeMailId, decodeMailId } from './mail-id.ts'
import type { MailRole } from './mail-id.ts'

describe('mail-id', () => {
  describe('round-trip', () => {
    it('decodes what encodeMailId encodes', () => {
      expect(decodeMailId(encodeMailId('inbox', 42))).toEqual({ role: 'inbox', uid: 42 })
    })
  })

  describe('all 5 valid roles', () => {
    const roles: MailRole[] = ['inbox', 'sent', 'drafts', 'junk', 'trash']
    for (const role of roles) {
      it(`round-trips role "${role}"`, () => {
        expect(decodeMailId(encodeMailId(role, 1))).toEqual({ role, uid: 1 })
      })
    }
  })

  describe('invalid ids throw', () => {
    it('throws on empty string', () => {
      expect(() => decodeMailId('')).toThrow()
    })

    it('throws on missing uid: "inbox"', () => {
      expect(() => decodeMailId('inbox')).toThrow()
    })

    it('throws on non-integer uid: "inbox:abc"', () => {
      expect(() => decodeMailId('inbox:abc')).toThrow()
    })

    it('throws on negative uid: "inbox:-1"', () => {
      expect(() => decodeMailId('inbox:-1')).toThrow()
    })

    it('throws on zero uid: "inbox:0"', () => {
      expect(() => decodeMailId('inbox:0')).toThrow()
    })

    it('throws on unknown role: "bogus:1"', () => {
      expect(() => decodeMailId('bogus:1')).toThrow()
    })

    it('throws on too many segments: "inbox:1:2"', () => {
      expect(() => decodeMailId('inbox:1:2')).toThrow()
    })
  })
})
