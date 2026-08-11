// Semua saldo derived — docs/feature/30.finance/spec.md §9. Tidak ada satu
// pun kolom saldo yang dibaca di file ini, dan tidak boleh pernah ada
// (prinsip 2): itu yang membuat edit, hapus, dan backdate tidak butuh
// rekalkulasi apa pun.
import { sql } from 'drizzle-orm'
import { firstOfNextMonth } from '@better/core/date'
import type { Pocket } from '@better/core/finance-validate'
import { db } from '../../db/client.ts'

export interface AccountBalance {
  id: string
  name: string
  kind: string
  pocket: string
  isSpendable: boolean
  isSystem: boolean
  isArchived: boolean
  sortOrder: number
  balance: number
  pockets: { personal: number; business: number }
}

export interface Summary {
  month: string
  masuk: number
  keluar: number
  tersimpan: number
}

export interface Receivable {
  counterparty: string
  sisa: number
}

/**
 * Tiap transaksi dipecah jadi entri bertanda: +amount masuk ke akun tujuan,
 * −amount keluar dari akun asal. Semua rumus di §9 adalah SUM atas bentuk
 * ini, jadi tidak ada percabangan per `type` di mana pun.
 */
function entries(userId: string) {
  return sql`
    SELECT to_account_id AS account_id, to_pocket AS pocket, amount AS delta
    FROM finance_transaction
    WHERE user_id = ${userId} AND deleted_at IS NULL AND to_account_id IS NOT NULL
    UNION ALL
    SELECT from_account_id AS account_id, from_pocket AS pocket, -amount AS delta
    FROM finance_transaction
    WHERE user_id = ${userId} AND deleted_at IS NULL AND from_account_id IS NOT NULL
  `
}

// postgres-js mengembalikan SUM atas bigint sebagai string. Rupiah bulat jauh
// di bawah 2^53, jadi Number() aman — dan tipe frontend memang meminta number.
const num = (v: unknown): number => Number(v ?? 0)

/** §9.1 + §9.3 — saldo tiap akun, sekaligus pecahannya per kantong. */
export async function accountBalances(userId: string): Promise<AccountBalance[]> {
  const rows = await db.execute(sql`
    SELECT a.id, a.name, a.kind, a.pocket, a.is_spendable, a.is_system, a.is_archived, a.sort_order,
           COALESCE(SUM(e.delta), 0) AS balance,
           COALESCE(SUM(e.delta) FILTER (WHERE e.pocket = 'personal'), 0) AS personal,
           COALESCE(SUM(e.delta) FILTER (WHERE e.pocket = 'business'), 0) AS business
    FROM finance_account a
    LEFT JOIN (${entries(userId)}) e ON e.account_id = a.id
    WHERE a.user_id = ${userId}
    GROUP BY a.id
    ORDER BY a.sort_order, a.name
  `)
  return [...rows].map((r) => ({
    id: r.id as string,
    name: r.name as string,
    kind: r.kind as string,
    pocket: r.pocket as string,
    isSpendable: r.is_spendable as boolean,
    isSystem: r.is_system as boolean,
    isArchived: r.is_archived as boolean,
    sortOrder: num(r.sort_order),
    balance: num(r.balance),
    pockets: { personal: num(r.personal), business: num(r.business) },
  }))
}

/** §9.4 — angka besar di beranda: uang personal yang aman dipakai hari ini. */
export async function spendablePersonal(userId: string): Promise<number> {
  const rows = await db.execute(sql`
    SELECT COALESCE(SUM(e.delta), 0) AS total
    FROM (${entries(userId)}) e
    JOIN finance_account a ON a.id = e.account_id
    WHERE e.pocket = 'personal' AND a.is_spendable
  `)
  return num([...rows][0]?.total)
}

/** §9.7 — termasuk tabungan dan piutang. Halaman terpisah, bukan beranda. */
export async function netWorth(userId: string): Promise<number> {
  const rows = await db.execute(sql`SELECT COALESCE(SUM(e.delta), 0) AS total FROM (${entries(userId)}) e`)
  return num([...rows][0]?.total)
}

/**
 * §9.5 — `month` berbentuk YYYY-MM. Transfer dalam kantong yang sama (nabung,
 * ngutangin) sengaja tidak muncul di Masuk maupun Keluar; hanya transfer
 * lintas kantong — prive — yang menggeser angka.
 */
export async function monthlySummary(
  userId: string,
  month: string,
  pocket: Pocket,
  accountId?: string | null,
): Promise<Summary> {
  const start = `${month}-01`
  const end = firstOfNextMonth(start)
  const acc = accountId ?? null
  const rows = await db.execute(sql`
    SELECT
      COALESCE(SUM(amount) FILTER (
        WHERE to_pocket = ${pocket}
          AND (type = 'income' OR (type = 'transfer' AND from_pocket <> ${pocket}))
          AND (${acc}::text IS NULL OR to_account_id = ${acc})
      ), 0) AS masuk,
      COALESCE(SUM(amount) FILTER (
        WHERE from_pocket = ${pocket}
          AND (type = 'expense' OR (type = 'transfer' AND to_pocket <> ${pocket}))
          AND (${acc}::text IS NULL OR from_account_id = ${acc})
      ), 0) AS keluar
    FROM finance_transaction
    WHERE user_id = ${userId} AND deleted_at IS NULL
      AND date >= ${start} AND date < ${end}
  `)
  const r = [...rows][0]
  const masuk = num(r?.masuk)
  const keluar = num(r?.keluar)
  return { month, masuk, keluar, tersimpan: masuk - keluar }
}

/**
 * §9.6 — tidak ada kolom status lunas. `sisa = 0` berarti lunas, dan barisnya
 * hilang sendiri lewat HAVING. Satu sumber kebenaran, tidak ada state yang
 * bisa desinkron.
 */
export async function receivables(userId: string, receivableAccountId: string): Promise<Receivable[]> {
  const rows = await db.execute(sql`
    SELECT counterparty,
           SUM(CASE WHEN to_account_id = ${receivableAccountId} THEN amount ELSE -amount END) AS sisa
    FROM finance_transaction
    WHERE user_id = ${userId} AND deleted_at IS NULL
      AND ${receivableAccountId} IN (from_account_id, to_account_id)
    GROUP BY counterparty
    HAVING SUM(CASE WHEN to_account_id = ${receivableAccountId} THEN amount ELSE -amount END) <> 0
    ORDER BY counterparty
  `)
  return [...rows].map((r) => ({ counterparty: r.counterparty as string, sisa: num(r.sisa) }))
}
