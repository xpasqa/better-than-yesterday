// Endpoint Finance — docs/feature/30.finance/spec.md §8.
import { Hono } from 'hono'
import { z } from 'zod'
import { and, desc, eq, isNull, lt, gte } from 'drizzle-orm'
import { todayInTimezone, firstOfNextMonth } from '@better/core/date'
import { AppError } from '../../http/errors.ts'
import { db } from '../../db/client.ts'
import { appUser } from '../../db/schema/user.ts'
import { financeCategory, financeTransaction } from '../../db/schema/finance.ts'
import { ensureFinanceSeed } from './seed.ts'
import { accountBalances, monthlySummary, netWorth, receivables, spendablePersonal } from './queries.ts'
import { toTransactionDto } from './dto.ts'

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
      .map((r) => ({ id: r.id, name: r.name, type: r.type, icon: r.icon, isArchived: r.isArchived, sortOrder: r.sortOrder }))
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
  // Cursor adalah id transaksi terakhir halaman sebelumnya. UUIDv7 monoton,
  // jadi "id < cursor" berarti "lebih lama" tanpa kolom tambahan.
  if (q.data.cursor) filters.push(lt(financeTransaction.id, q.data.cursor))

  const rows = await db.select().from(financeTransaction)
    .where(and(...filters))
    .orderBy(desc(financeTransaction.date), desc(financeTransaction.id))
    .limit(PAGE_SIZE + 1)

  const page = rows.slice(0, PAGE_SIZE)
  return c.json({
    transactions: page.map(toTransactionDto),
    nextCursor: rows.length > PAGE_SIZE ? page[page.length - 1]!.id : null,
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
