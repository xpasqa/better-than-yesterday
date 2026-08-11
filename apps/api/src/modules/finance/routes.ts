// Endpoint Finance — docs/feature/30.finance/spec.md §8.
import { Hono } from 'hono'
import { z } from 'zod'
import { and, desc, eq, isNull, lt, gte, sql } from 'drizzle-orm'
import { todayInTimezone, firstOfNextMonth } from '@better/core/date'
import { uuidv7 } from '@better/core/id'
import { AppError } from '../../http/errors.ts'
import { db } from '../../db/client.ts'
import { appUser } from '../../db/schema/user.ts'
import { financeAccount, financeCategory, financeTransaction } from '../../db/schema/finance.ts'
import { ensureFinanceSeed } from './seed.ts'
import { accountBalances, monthlySummary, netWorth, receivables, spendablePersonal } from './queries.ts'
import { toAccountDto, toCategoryDto, toTransactionDto } from './dto.ts'
import { createTransaction, updateTransaction, deleteTransaction } from './service.ts'

export const financeRoutes = new Hono()

// Seed lazy di depan tiap request — user lama tidak butuh backfill (§8).
// Hasilnya tidak disimpan di context: ensureFinanceSeed pulang lewat satu
// SELECT setelah seed pertama, jadi rute yang butuh id Piutang cukup
// memanggilnya lagi ketimbang menambah tipe variabel context.
financeRoutes.use('/finance/*', async (c, next) => {
  await ensureFinanceSeed(c.get('userId'))
  await next()
})

async function currentUser(userId: string) {
  const [user] = await db.select().from(appUser).where(eq(appUser.id, userId))
  if (!user) throw new AppError('UNAUTHORIZED', 401, 'Session refers to a user that no longer exists')
  return user
}

const monthPattern = /^\d{4}-\d{2}$/
const summaryQuery = z.object({
  month: z.string().regex(monthPattern).optional(),
  pocket: z.enum(['personal', 'business']).default('personal'),
  account_id: z.string().optional(),
})

financeRoutes.get('/finance/accounts', async (c) => {
  const accounts = await accountBalances(c.get('userId'))
  return c.json({ accounts })
})

financeRoutes.get('/finance/networth', async (c) => {
  return c.json({ total: await netWorth(c.get('userId')) })
})

financeRoutes.get('/finance/categories', async (c) => {
  const rows = await db.select().from(financeCategory).where(eq(financeCategory.userId, c.get('userId')))
  return c.json({
    categories: rows
      .map(toCategoryDto)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
  })
})

financeRoutes.get('/finance/receivables', async (c) => {
  const userId = c.get('userId')
  const { receivableAccountId } = await ensureFinanceSeed(userId)
  return c.json({ receivables: await receivables(userId, receivableAccountId) })
})

financeRoutes.get('/finance/summary', async (c) => {
  const userId = c.get('userId')
  const q = summaryQuery.safeParse(Object.fromEntries(new URL(c.req.url).searchParams))
  if (!q.success) throw new AppError('VALIDATION_ERROR', 422, 'Invalid query', q.error.flatten())
  const user = await currentUser(userId)
  const month = q.data.month ?? todayInTimezone(user.timezone).slice(0, 7)
  return c.json(await monthlySummary(userId, month, q.data.pocket, q.data.account_id ?? null))
})

const listQuery = summaryQuery.extend({ cursor: z.string().optional() })
const PAGE_SIZE = 50

financeRoutes.get('/finance/transactions', async (c) => {
  const userId = c.get('userId')
  const q = listQuery.safeParse(Object.fromEntries(new URL(c.req.url).searchParams))
  if (!q.success) throw new AppError('VALIDATION_ERROR', 422, 'Invalid query', q.error.flatten())

  const filters = [eq(financeTransaction.userId, userId), isNull(financeTransaction.deletedAt)]
  if (q.data.month) {
    filters.push(gte(financeTransaction.date, `${q.data.month}-01`))
    filters.push(lt(financeTransaction.date, firstOfNextMonth(`${q.data.month}-01`)))
  }
  // Cursor membawa (date, id) dari baris terakhir halaman sebelumnya, bukan
  // id saja — transaksi boleh backdate bebas (§11.5), jadi id (UUIDv7,
  // monoton menurut waktu dibuat) tidak selalu sejalan dengan date (bisnis,
  // bisa mundur). Perbandingan tuple Postgres "(date, id) < (cursorDate,
  // cursorId)" mengikuti urutan ORDER BY date DESC, id DESC persis: baris
  // yang dibuat belakangan tapi tanggalnya lebih tua tetap ditemukan di
  // halaman berikutnya, bukan hilang permanen.
  if (q.data.cursor) {
    const sep = q.data.cursor.indexOf('|')
    if (sep === -1) throw new AppError('VALIDATION_ERROR', 422, 'Invalid cursor')
    const cursorDate = q.data.cursor.slice(0, sep)
    const cursorId = q.data.cursor.slice(sep + 1)
    filters.push(sql`(${financeTransaction.date}, ${financeTransaction.id}) < (${cursorDate}, ${cursorId})`)
  }

  const rows = await db.select().from(financeTransaction)
    .where(and(...filters))
    .orderBy(desc(financeTransaction.date), desc(financeTransaction.id))
    .limit(PAGE_SIZE + 1)

  const page = rows.slice(0, PAGE_SIZE)
  const last = page[page.length - 1]
  return c.json({
    transactions: page.map(toTransactionDto),
    nextCursor: rows.length > PAGE_SIZE && last ? `${last.date}|${last.id}` : null,
  })
})

financeRoutes.get('/finance/overview', async (c) => {
  const userId = c.get('userId')
  const user = await currentUser(userId)
  const { receivableAccountId } = await ensureFinanceSeed(userId)
  const month = todayInTimezone(user.timezone).slice(0, 7)

  const [spendable, summary, accounts] = await Promise.all([
    spendablePersonal(userId),
    monthlySummary(userId, month, 'personal'),
    accountBalances(userId),
  ])

  const piutangTotal = accounts.find((a) => a.id === receivableAccountId)?.balance ?? 0
  const businessTotal = accounts.reduce((sum, a) => sum + a.pockets.business, 0)

  // Chip hanya dikirim kalau nilainya ≠ 0 (§8) — beranda user tanpa piutang
  // dan tanpa bisnis tidak menampilkan baris kosong.
  const chips: { piutangTotal?: number; businessTotal?: number } = {}
  if (piutangTotal !== 0) chips.piutangTotal = piutangTotal
  if (businessTotal !== 0) chips.businessTotal = businessTotal

  const mode = user.financeSavingsTargetMode
  const value = user.financeSavingsTargetValue
  const target = mode && value !== null
    // percent dihitung ulang dari Masuk bulan berjalan, jadi targetnya ikut
    // turun di bulan sepi dan progress bar tidak selalu merah (§5.5).
    ? {
        mode,
        value,
        targetAmount: mode === 'percent' ? Math.round((summary.masuk * value) / 100) : value,
        saved: summary.tersimpan,
      }
    : null

  return c.json({
    spendablePersonal: spendable,
    summary,
    target,
    chips,
    businessEnabled: user.financeBusinessEnabled,
  })
})

const pocketEnum = z.enum(['personal', 'business'])

const draftSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(['income', 'expense', 'transfer']),
  amount: z.number().int(),
  categoryId: z.string().nullable().default(null),
  fromAccountId: z.string().nullable().default(null),
  fromPocket: pocketEnum.nullable().default(null),
  toAccountId: z.string().nullable().default(null),
  toPocket: pocketEnum.nullable().default(null),
  counterparty: z.string().trim().min(1).nullable().default(null),
  note: z.string().nullable().default(null),
})

financeRoutes.post('/finance/transactions', async (c) => {
  const parsed = draftSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) throw new AppError('VALIDATION_ERROR', 422, 'Invalid body', parsed.error.flatten())

  const key = c.req.header('idempotency-key') ?? null
  const { row, created } = await createTransaction(c.get('userId'), parsed.data, key)
  return c.json({ transaction: toTransactionDto(row) }, created ? 201 : 200)
})

financeRoutes.patch('/finance/transactions/:id', async (c) => {
  const parsed = draftSchema.partial().safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) throw new AppError('VALIDATION_ERROR', 422, 'Invalid body', parsed.error.flatten())

  const row = await updateTransaction(c.get('userId'), c.req.param('id'), parsed.data)
  return c.json({ transaction: toTransactionDto(row) })
})

financeRoutes.delete('/finance/transactions/:id', async (c) => {
  const cascade = new URL(c.req.url).searchParams.get('cascade')
  if (cascade !== null && cascade !== 'one' && cascade !== 'all') {
    throw new AppError('VALIDATION_ERROR', 422, 'cascade must be "one" or "all"')
  }
  return c.json(await deleteTransaction(c.get('userId'), c.req.param('id'), cascade))
})

const accountInput = z.object({
  name: z.string().trim().min(1).max(60),
  // 'receivable' tidak ada di sini: akun Piutang hanya lahir dari seed.
  kind: z.enum(['cash', 'bank']),
  pocket: pocketEnum.default('personal'),
  isSpendable: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
})

financeRoutes.post('/finance/accounts', async (c) => {
  const parsed = accountInput.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) throw new AppError('VALIDATION_ERROR', 422, 'Invalid body', parsed.error.flatten())

  const [row] = await db.insert(financeAccount)
    .values({ id: uuidv7(), userId: c.get('userId'), ...parsed.data })
    .returning()
  return c.json({ account: toAccountDto(row!) }, 201)
})

/** Akun sistem (Piutang) kebal rename dan arsip — spec §5.1. */
async function ownedAccount(userId: string, id: string) {
  const [row] = await db.select().from(financeAccount)
    .where(and(eq(financeAccount.userId, userId), eq(financeAccount.id, id)))
  if (!row) throw new AppError('NOT_FOUND', 404, 'Account not found')
  if (row.isSystem) throw new AppError('CONFLICT', 409, 'System account cannot be modified')
  return row
}

financeRoutes.patch('/finance/accounts/:id', async (c) => {
  const parsed = accountInput.partial().safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) throw new AppError('VALIDATION_ERROR', 422, 'Invalid body', parsed.error.flatten())

  const userId = c.get('userId')
  await ownedAccount(userId, c.req.param('id'))
  // ownedAccount() sudah memastikan baris ini milik user & bukan akun sistem
  // (404/409 duluan) — filter user_id di UPDATE ini adalah defense-in-depth,
  // bukan pengganti: setiap UPDATE/DELETE tetap wajib terikat langsung ke
  // user_id sesi, bukan cuma percaya id dari client.
  const [row] = await db.update(financeAccount).set(parsed.data)
    .where(and(eq(financeAccount.userId, userId), eq(financeAccount.id, c.req.param('id'))))
    .returning()
  return c.json({ account: toAccountDto(row!) })
})

financeRoutes.delete('/finance/accounts/:id', async (c) => {
  const userId = c.get('userId')
  await ownedAccount(userId, c.req.param('id'))
  await db.update(financeAccount).set({ isArchived: true })
    .where(and(eq(financeAccount.userId, userId), eq(financeAccount.id, c.req.param('id'))))
  return c.json({ ok: true })
})

const categoryInput = z.object({
  name: z.string().trim().min(1).max(60),
  type: z.enum(['income', 'expense']),
  icon: z.string().nullable().default(null),
  sortOrder: z.number().int().default(0),
})

financeRoutes.post('/finance/categories', async (c) => {
  const parsed = categoryInput.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) throw new AppError('VALIDATION_ERROR', 422, 'Invalid body', parsed.error.flatten())

  const [row] = await db.insert(financeCategory)
    .values({ id: uuidv7(), userId: c.get('userId'), ...parsed.data })
    .returning()
  return c.json({ category: toCategoryDto(row!) }, 201)
})

financeRoutes.patch('/finance/categories/:id', async (c) => {
  const parsed = categoryInput.partial().safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) throw new AppError('VALIDATION_ERROR', 422, 'Invalid body', parsed.error.flatten())

  const [row] = await db.update(financeCategory).set(parsed.data)
    .where(and(eq(financeCategory.userId, c.get('userId')), eq(financeCategory.id, c.req.param('id'))))
    .returning()
  if (!row) throw new AppError('NOT_FOUND', 404, 'Category not found')
  return c.json({ category: toCategoryDto(row) })
})

financeRoutes.delete('/finance/categories/:id', async (c) => {
  const [row] = await db.update(financeCategory).set({ isArchived: true })
    .where(and(eq(financeCategory.userId, c.get('userId')), eq(financeCategory.id, c.req.param('id'))))
    .returning()
  if (!row) throw new AppError('NOT_FOUND', 404, 'Category not found')
  return c.json({ ok: true })
})
