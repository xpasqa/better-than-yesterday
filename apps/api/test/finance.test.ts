import { beforeEach, describe, expect, it } from 'vitest'
import { and, eq } from 'drizzle-orm'
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

import { financeTransaction } from '../src/db/schema/finance.ts'
import { uuidv7 } from '@better/core/id'
import { accountBalances, spendablePersonal, monthlySummary, receivables, netWorth } from '../src/modules/finance/queries.ts'

/** Menyisipkan satu transaksi apa adanya — melewati validator, karena yang diuji di sini agregasinya. */
async function insertTx(userId: string, tx: Record<string, unknown>) {
  await db.insert(financeTransaction).values({
    id: uuidv7(), userId, date: '2026-08-05', amount: 0, type: 'expense', ...tx,
  } as typeof financeTransaction.$inferInsert)
}

async function accountIdByName(userId: string, name: string): Promise<string> {
  const [row] = await db.select().from(financeAccount)
    .where(and(eq(financeAccount.userId, userId), eq(financeAccount.name, name)))
  return row!.id
}

describe('agregasi §9', () => {
  it('saldo akun = masuk lewat to_ dikurangi keluar lewat from_ (§9.1)', async () => {
    const user = await createTestUser('agg1@example.com')
    await ensureFinanceSeed(user.id)
    const dompet = await accountIdByName(user.id, 'Dompet')

    await insertTx(user.id, { type: 'income', amount: 1_000_000, toAccountId: dompet, toPocket: 'personal' })
    await insertTx(user.id, { type: 'expense', amount: 250_000, fromAccountId: dompet, fromPocket: 'personal' })

    const balances = await accountBalances(user.id)
    expect(balances.find((a) => a.id === dompet)!.balance).toBe(750_000)
  })

  it('transaksi terhapus tidak dihitung', async () => {
    const user = await createTestUser('agg2@example.com')
    await ensureFinanceSeed(user.id)
    const dompet = await accountIdByName(user.id, 'Dompet')

    await insertTx(user.id, { type: 'income', amount: 1_000_000, toAccountId: dompet, toPocket: 'personal' })
    await insertTx(user.id, { type: 'income', amount: 9_000_000, toAccountId: dompet, toPocket: 'personal', deletedAt: new Date() })

    const balances = await accountBalances(user.id)
    expect(balances.find((a) => a.id === dompet)!.balance).toBe(1_000_000)
  })

  it('satu rekening memecah saldonya per kantong (§9.3)', async () => {
    const user = await createTestUser('agg3@example.com')
    await ensureFinanceSeed(user.id)
    const dompet = await accountIdByName(user.id, 'Dompet')

    await insertTx(user.id, { type: 'income', amount: 1_000_000, toAccountId: dompet, toPocket: 'personal' })
    await insertTx(user.id, { type: 'income', amount: 4_000_000, toAccountId: dompet, toPocket: 'business' })

    const row = (await accountBalances(user.id)).find((a) => a.id === dompet)!
    expect(row.pockets).toEqual({ personal: 1_000_000, business: 4_000_000 })
    expect(row.balance).toBe(5_000_000)
  })

  it('headline mengecualikan akun non-spendable (§9.4)', async () => {
    const user = await createTestUser('agg4@example.com')
    await ensureFinanceSeed(user.id)
    const dompet = await accountIdByName(user.id, 'Dompet')
    const piutang = await accountIdByName(user.id, 'Piutang')

    await insertTx(user.id, { type: 'income', amount: 1_000_000, toAccountId: dompet, toPocket: 'personal' })
    await insertTx(user.id, {
      type: 'transfer', amount: 200_000, counterparty: 'Budi',
      fromAccountId: dompet, fromPocket: 'personal', toAccountId: piutang, toPocket: 'personal',
    })

    // Uang yang aman dipakai = 800rb. Piutang 200rb tidak ikut.
    expect(await spendablePersonal(user.id)).toBe(800_000)
    expect(await netWorth(user.id)).toBe(1_000_000)
  })

  it('nabung dan ngutangin bukan Keluar; prive adalah Masuk (§9.5)', async () => {
    const user = await createTestUser('agg5@example.com')
    await ensureFinanceSeed(user.id)
    const dompet = await accountIdByName(user.id, 'Dompet')
    const piutang = await accountIdByName(user.id, 'Piutang')
    const [tabungan] = await db.insert(financeAccount).values({
      id: uuidv7(), userId: user.id, name: 'Tabungan', kind: 'bank', pocket: 'personal', isSpendable: false,
    }).returning()

    await insertTx(user.id, { type: 'income', amount: 9_000_000, toAccountId: dompet, toPocket: 'personal' })
    await insertTx(user.id, { type: 'expense', amount: 1_000_000, fromAccountId: dompet, fromPocket: 'personal' })
    // Nabung — transfer dalam kantong yang sama, tidak muncul di Masuk maupun Keluar.
    await insertTx(user.id, { type: 'transfer', amount: 2_000_000, fromAccountId: dompet, fromPocket: 'personal', toAccountId: tabungan!.id, toPocket: 'personal' })
    // Ngutangin — sama, transfer dalam kantong.
    await insertTx(user.id, { type: 'transfer', amount: 500_000, counterparty: 'Budi', fromAccountId: dompet, fromPocket: 'personal', toAccountId: piutang, toPocket: 'personal' })
    // Prive — lintas kantong, ini yang menambah Masuk personal.
    await insertTx(user.id, { type: 'transfer', amount: 3_000_000, fromAccountId: dompet, fromPocket: 'business', toAccountId: dompet, toPocket: 'personal' })

    const s = await monthlySummary(user.id, '2026-08', 'personal')
    expect(s.masuk).toBe(12_000_000)
    expect(s.keluar).toBe(1_000_000)
    expect(s.tersimpan).toBe(11_000_000)
  })

  it('prive adalah Keluar dari sisi kantong bisnis', async () => {
    const user = await createTestUser('agg6@example.com')
    await ensureFinanceSeed(user.id)
    const dompet = await accountIdByName(user.id, 'Dompet')

    await insertTx(user.id, { type: 'income', amount: 5_000_000, toAccountId: dompet, toPocket: 'business' })
    await insertTx(user.id, { type: 'transfer', amount: 3_000_000, fromAccountId: dompet, fromPocket: 'business', toAccountId: dompet, toPocket: 'personal' })

    const s = await monthlySummary(user.id, '2026-08', 'business')
    expect(s.masuk).toBe(5_000_000)
    expect(s.keluar).toBe(3_000_000)
  })

  it('ringkasan disaring per akun untuk memisahkan dua bisnis (§4.4)', async () => {
    const user = await createTestUser('agg7@example.com')
    await ensureFinanceSeed(user.id)
    const [a] = await db.insert(financeAccount).values({ id: uuidv7(), userId: user.id, name: 'Bisnis A', kind: 'bank', pocket: 'business' }).returning()
    const [b] = await db.insert(financeAccount).values({ id: uuidv7(), userId: user.id, name: 'Bisnis B', kind: 'bank', pocket: 'business' }).returning()

    await insertTx(user.id, { type: 'income', amount: 5_000_000, toAccountId: a!.id, toPocket: 'business' })
    await insertTx(user.id, { type: 'income', amount: 2_000_000, toAccountId: b!.id, toPocket: 'business' })

    expect((await monthlySummary(user.id, '2026-08', 'business', a!.id)).masuk).toBe(5_000_000)
    expect((await monthlySummary(user.id, '2026-08', 'business')).masuk).toBe(7_000_000)
  })

  it('bulan lain tidak ikut terhitung (§11.5)', async () => {
    const user = await createTestUser('agg8@example.com')
    await ensureFinanceSeed(user.id)
    const dompet = await accountIdByName(user.id, 'Dompet')

    await insertTx(user.id, { date: '2026-07-31', type: 'expense', amount: 111_000, fromAccountId: dompet, fromPocket: 'personal' })
    await insertTx(user.id, { date: '2026-08-01', type: 'expense', amount: 222_000, fromAccountId: dompet, fromPocket: 'personal' })
    await insertTx(user.id, { date: '2026-09-01', type: 'expense', amount: 333_000, fromAccountId: dompet, fromPocket: 'personal' })

    expect((await monthlySummary(user.id, '2026-08', 'personal')).keluar).toBe(222_000)
  })

  it('piutang lunas hilang dari daftar tanpa kolom status (§9.6)', async () => {
    const user = await createTestUser('agg9@example.com')
    const { receivableAccountId } = await ensureFinanceSeed(user.id)
    const dompet = await accountIdByName(user.id, 'Dompet')

    const lend = (n: string, amount: number) => insertTx(user.id, {
      type: 'transfer', amount, counterparty: n,
      fromAccountId: dompet, fromPocket: 'personal', toAccountId: receivableAccountId, toPocket: 'personal',
    })
    const repay = (n: string, amount: number) => insertTx(user.id, {
      type: 'transfer', amount, counterparty: n,
      fromAccountId: receivableAccountId, fromPocket: 'personal', toAccountId: dompet, toPocket: 'personal',
    })

    await lend('Budi', 500_000)
    await repay('Budi', 500_000) // lunas → hilang
    await lend('Cici', 300_000)
    await repay('Cici', 100_000) // sisa 200rb

    expect(await receivables(user.id, receivableAccountId)).toEqual([{ counterparty: 'Cici', sisa: 200_000 }])
  })
})

import { createApp } from '../src/app.ts'
import { extractSessionCookie, readJson } from './helpers.ts'
import { appUser } from '../src/db/schema/user.ts'

const app = createApp()

async function loginCookie(email: string, password = 'testpassword123'): Promise<string> {
  const res = await app.request('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return extractSessionCookie(res)
}

describe('endpoint baca §8', () => {
  it('GET /finance/accounts men-seed saat pertama diakses', async () => {
    await createTestUser('read1@example.com')
    const cookie = await loginCookie('read1@example.com')

    const res = await app.request('/api/finance/accounts', { headers: { cookie } })
    expect(res.status).toBe(200)
    const body = await readJson(res)
    expect(body.accounts.map((a: { name: string }) => a.name).sort()).toEqual(['Dompet', 'Piutang'])
    expect(body.accounts[0]).toHaveProperty('isSpendable') // camelCase, bukan is_spendable
  })

  it('GET /finance/overview mengirim headline, ringkasan, dan chip', async () => {
    const user = await createTestUser('read2@example.com')
    const cookie = await loginCookie('read2@example.com')
    const { receivableAccountId } = await ensureFinanceSeed(user.id)
    const dompet = await accountIdByName(user.id, 'Dompet')
    const today = new Date().toISOString().slice(0, 10)

    await insertTx(user.id, { date: today, type: 'income', amount: 5_000_000, toAccountId: dompet, toPocket: 'personal' })
    await insertTx(user.id, {
      date: today, type: 'transfer', amount: 500_000, counterparty: 'Budi',
      fromAccountId: dompet, fromPocket: 'personal', toAccountId: receivableAccountId, toPocket: 'personal',
    })

    const body = await readJson(await app.request('/api/finance/overview', { headers: { cookie } }))
    expect(body.spendablePersonal).toBe(4_500_000)
    expect(body.summary.masuk).toBe(5_000_000)
    expect(body.chips.piutangTotal).toBe(500_000)
    expect(body.chips).not.toHaveProperty('businessTotal') // chip nol tidak dikirim
  })

  it('progress target percent dihitung dari Masuk bulan berjalan (§5.5)', async () => {
    const user = await createTestUser('read3@example.com')
    const cookie = await loginCookie('read3@example.com')
    await db.update(appUser)
      .set({ financeSavingsTargetMode: 'percent', financeSavingsTargetValue: 20 })
      .where(eq(appUser.id, user.id))
    await ensureFinanceSeed(user.id)
    const dompet = await accountIdByName(user.id, 'Dompet')
    const today = new Date().toISOString().slice(0, 10)

    await insertTx(user.id, { date: today, type: 'income', amount: 10_000_000, toAccountId: dompet, toPocket: 'personal' })
    await insertTx(user.id, { date: today, type: 'expense', amount: 9_000_000, fromAccountId: dompet, fromPocket: 'personal' })

    const body = await readJson(await app.request('/api/finance/overview', { headers: { cookie } }))
    expect(body.target).toEqual({ mode: 'percent', value: 20, targetAmount: 2_000_000, saved: 1_000_000 })
  })

  it('data user lain tidak pernah bocor', async () => {
    const owner = await createTestUser('read4@example.com')
    await createTestUser('other@example.com')
    await ensureFinanceSeed(owner.id)
    const dompet = await accountIdByName(owner.id, 'Dompet')
    await insertTx(owner.id, { type: 'income', amount: 7_000_000, toAccountId: dompet, toPocket: 'personal' })

    const cookie = await loginCookie('other@example.com')
    const body = await readJson(await app.request('/api/finance/overview', { headers: { cookie } }))
    expect(body.spendablePersonal).toBe(0)
  })

  it('menolak tanpa sesi', async () => {
    const res = await app.request('/api/finance/overview')
    expect(res.status).toBe(401)
  })
})
