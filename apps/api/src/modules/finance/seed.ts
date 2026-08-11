// Seed lazy, bukan migrasi — persis pola getOrCreatePersonalArea di modul
// storage. Dipanggil di awal tiap request finance (spec §8), jadi user lama
// tidak butuh backfill dan user baru tidak butuh langkah ekstra.
import { and, eq } from 'drizzle-orm'
import { uuidv7 } from '@better/core/id'
import { db } from '../../db/client.ts'
import { financeAccount, financeCategory } from '../../db/schema/finance.ts'

const INCOME_CATEGORIES = ['Gaji', 'Bonus', 'Project', 'Lain-lain']
const EXPENSE_CATEGORIES = ['Makan', 'Transport', 'Tagihan', 'Belanja', 'Hiburan', 'Kesehatan', 'Relasi', 'Lain-lain']

export interface FinanceSeed {
  receivableAccountId: string
}

async function selectExisting(userId: string) {
  const [existing] = await db
    .select({ id: financeAccount.id })
    .from(financeAccount)
    .where(and(eq(financeAccount.userId, userId), eq(financeAccount.kind, 'receivable')))
    .limit(1)
  return existing
}

/** Postgres unique_violation — the `postgres` package throws this shape, not a subclass we can `instanceof`. */
function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === '23505'
}

export async function ensureFinanceSeed(userId: string): Promise<FinanceSeed> {
  const existing = await selectExisting(userId)
  if (existing) return { receivableAccountId: existing.id }

  const receivableId = uuidv7()
  try {
    await db.transaction(async (tx) => {
      await tx.insert(financeAccount).values([
        {
          id: uuidv7(), userId, name: 'Dompet', kind: 'cash', pocket: 'personal',
          isSpendable: true, isSystem: false, sortOrder: 0,
        },
        {
          // Akun sistem: tidak bisa dihapus maupun di-rename (spec §5.1).
          id: receivableId, userId, name: 'Piutang', kind: 'receivable', pocket: 'personal',
          isSpendable: false, isSystem: true, sortOrder: 100,
        },
      ])
      await tx.insert(financeCategory).values([
        ...INCOME_CATEGORIES.map((name, i) => ({ id: uuidv7(), userId, name, type: 'income', sortOrder: i })),
        ...EXPENSE_CATEGORIES.map((name, i) => ({ id: uuidv7(), userId, name, type: 'expense', sortOrder: i })),
      ])
    })
  } catch (err) {
    // Lost the race to another concurrent first-call for the same user (§8):
    // the whole transaction above rolled back atomically, so there's no
    // partial seed to clean up — the winner's row is already committed.
    if (!isUniqueViolation(err)) throw err
    const winner = await selectExisting(userId)
    if (!winner) throw err // defensive: constraint fired, so a row must exist
    return { receivableAccountId: winner.id }
  }
  return { receivableAccountId: receivableId }
}
