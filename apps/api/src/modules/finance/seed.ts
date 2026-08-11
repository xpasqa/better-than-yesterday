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

export async function ensureFinanceSeed(userId: string): Promise<FinanceSeed> {
  const [existing] = await db
    .select({ id: financeAccount.id })
    .from(financeAccount)
    .where(and(eq(financeAccount.userId, userId), eq(financeAccount.kind, 'receivable')))
    .limit(1)
  if (existing) return { receivableAccountId: existing.id }

  const receivableId = uuidv7()
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
  return { receivableAccountId: receivableId }
}
