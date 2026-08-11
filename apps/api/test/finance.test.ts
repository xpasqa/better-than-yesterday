import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '../src/db/client.ts'
import { financeAccount, financeCategory } from '../src/db/schema/finance.ts'
import { ensureFinanceSeed } from '../src/modules/finance/seed.ts'
import { resetDb, createTestUser } from './helpers.ts'

beforeEach(async () => {
  await resetDb()
})

describe('ensureFinanceSeed', () => {
  it('membuat Dompet dan Piutang, tanpa akun Tabungan (spec §4.3)', async () => {
    const user = await createTestUser('seed@example.com')
    await ensureFinanceSeed(user.id)

    const accounts = await db.select().from(financeAccount).where(eq(financeAccount.userId, user.id))
    expect(accounts.map((a) => a.name).sort()).toEqual(['Dompet', 'Piutang'])

    const piutang = accounts.find((a) => a.kind === 'receivable')!
    expect(piutang.isSystem).toBe(true)
    expect(piutang.isSpendable).toBe(false)

    const dompet = accounts.find((a) => a.kind === 'cash')!
    expect(dompet.isSpendable).toBe(true)
    expect(dompet.isSystem).toBe(false)
  })

  it('membuat 12 kategori default', async () => {
    const user = await createTestUser('seed2@example.com')
    await ensureFinanceSeed(user.id)

    const cats = await db.select().from(financeCategory).where(eq(financeCategory.userId, user.id))
    expect(cats.filter((c) => c.type === 'income').map((c) => c.name)).toEqual(['Gaji', 'Bonus', 'Project', 'Lain-lain'])
    expect(cats.filter((c) => c.type === 'expense')).toHaveLength(8)
  })

  it('idempoten — dipanggil dua kali tidak menggandakan apa pun', async () => {
    const user = await createTestUser('seed3@example.com')
    const first = await ensureFinanceSeed(user.id)
    const second = await ensureFinanceSeed(user.id)

    expect(second.receivableAccountId).toBe(first.receivableAccountId)
    const accounts = await db.select().from(financeAccount).where(eq(financeAccount.userId, user.id))
    expect(accounts).toHaveLength(2)
  })
})
