// Integration tests for mail account CRUD endpoints (Blok E).
// Tests that require real IMAP/SMTP connections are skipped when
// MAIL_PASSWORD is not set in the environment.
import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.ts'
import { resetDb, createTestUser, extractSessionCookie, readJson } from './helpers.ts'

const app = createApp()

const IMAP_HOST = process.env.MAIL_IMAP_HOST ?? 'imap.hostinger.com'
const IMAP_PORT = Number(process.env.MAIL_IMAP_PORT ?? 993)
const SMTP_HOST = process.env.MAIL_SMTP_HOST ?? 'smtp.hostinger.com'
const SMTP_PORT = Number(process.env.MAIL_SMTP_PORT ?? 465)
const MAIL_PASSWORD = process.env.MAIL_PASSWORD ?? ''
const MAIL_EMAIL = process.env.MAIL_EMAIL ?? 'pasqa@publion.org'

const hasCredentials = MAIL_PASSWORD.length > 0

async function loginCookie(email: string, password = 'testpassword123'): Promise<string> {
  const res = await app.request('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return extractSessionCookie(res)
}

beforeEach(async () => {
  await resetDb()
})

describe('GET /api/mail/account', () => {
  it('tanpa akun → 404 MAIL_NOT_CONFIGURED', async () => {
    await createTestUser('nomail@example.com')
    const cookie = await loginCookie('nomail@example.com')

    const res = await app.request('/api/mail/account', { headers: { cookie } })
    expect(res.status).toBe(404)
    const body = await readJson(res)
    expect(body.error.code).toBe('MAIL_NOT_CONFIGURED')
  })
})

describe('PUT /api/mail/account', () => {
  it('password kosong untuk akun baru → 422', async () => {
    await createTestUser('emptypass@example.com')
    const cookie = await loginCookie('emptypass@example.com')

    const res = await app.request('/api/mail/account', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        email: MAIL_EMAIL,
        password: '',
        imapHost: IMAP_HOST,
        imapPort: IMAP_PORT,
        smtpHost: SMTP_HOST,
        smtpPort: SMTP_PORT,
      }),
    })
    expect(res.status).toBe(422)
    const body = await readJson(res)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it.skipIf(!hasCredentials)('kredensial valid → 200, akun tersimpan', async () => {
    await createTestUser('validmail@example.com')
    const cookie = await loginCookie('validmail@example.com')

    const res = await app.request('/api/mail/account', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        email: MAIL_EMAIL,
        password: MAIL_PASSWORD,
        imapHost: IMAP_HOST,
        imapPort: IMAP_PORT,
        smtpHost: SMTP_HOST,
        smtpPort: SMTP_PORT,
      }),
    })
    expect(res.status).toBe(200)
    const body = await readJson(res)
    expect(body.ok).toBe(true)
  }, 30_000)
})

describe('GET /api/mail/account setelah PUT', () => {
  it.skipIf(!hasCredentials)('200, hasPassword: true, tidak ada password di response', async () => {
    await createTestUser('getafter@example.com')
    const cookie = await loginCookie('getafter@example.com')

    await app.request('/api/mail/account', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        email: MAIL_EMAIL,
        password: MAIL_PASSWORD,
        imapHost: IMAP_HOST,
        imapPort: IMAP_PORT,
        smtpHost: SMTP_HOST,
        smtpPort: SMTP_PORT,
      }),
    })

    const res = await app.request('/api/mail/account', { headers: { cookie } })
    expect(res.status).toBe(200)
    const body = await readJson(res)
    expect(body.email).toBe(MAIL_EMAIL)
    expect(body.hasPassword).toBe(true)
    expect(body.password).toBeUndefined()
    expect(body.passwordEnc).toBeUndefined()
    expect(body.imapPort).toBeTypeOf('number')
    expect(body.smtpPort).toBeTypeOf('number')
  }, 30_000)
})

describe('PUT tanpa password setelah akun ada', () => {
  it.skipIf(!hasCredentials)('password lama dipertahankan', async () => {
    await createTestUser('reuse@example.com')
    const cookie = await loginCookie('reuse@example.com')

    // Setup: simpan akun pertama kali
    await app.request('/api/mail/account', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        email: MAIL_EMAIL,
        password: MAIL_PASSWORD,
        imapHost: IMAP_HOST,
        imapPort: IMAP_PORT,
        smtpHost: SMTP_HOST,
        smtpPort: SMTP_PORT,
      }),
    })

    // Update tanpa password — harus pakai password lama
    const res = await app.request('/api/mail/account', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        email: MAIL_EMAIL,
        // password tidak disertakan
        imapHost: IMAP_HOST,
        imapPort: IMAP_PORT,
        smtpHost: SMTP_HOST,
        smtpPort: SMTP_PORT,
      }),
    })
    expect(res.status).toBe(200)
    const body = await readJson(res)
    expect(body.ok).toBe(true)
  }, 30_000)
})

describe('DELETE /api/mail/account', () => {
  it.skipIf(!hasCredentials)('DELETE → 204, GET sesudah → 404', async () => {
    await createTestUser('deletetest@example.com')
    const cookie = await loginCookie('deletetest@example.com')

    // Setup
    await app.request('/api/mail/account', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        email: MAIL_EMAIL,
        password: MAIL_PASSWORD,
        imapHost: IMAP_HOST,
        imapPort: IMAP_PORT,
        smtpHost: SMTP_HOST,
        smtpPort: SMTP_PORT,
      }),
    })

    const del = await app.request('/api/mail/account', { method: 'DELETE', headers: { cookie } })
    expect(del.status).toBe(204)

    const get = await app.request('/api/mail/account', { headers: { cookie } })
    expect(get.status).toBe(404)
    const body = await readJson(get)
    expect(body.error.code).toBe('MAIL_NOT_CONFIGURED')
  }, 30_000)
})
