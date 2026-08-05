// Fractional-index ordering. `rank` is a plain TEXT column, sorted with
// `ORDER BY rank ASC` — lexicographic, which is what the key format is built
// for. Moving one row between two neighbors writes exactly one row; integer
// positions would rewrite every following sibling on every move. See
// docs/feature/2.backend/spec.md §2.3.
//
// This wraps the single-purpose `fractional-indexing` package (policy §6: a
// library used in exactly one place gets its own adapter file) rather than
// hand-rolling the algorithm — getting the variable-length key comparison
// right from scratch is exactly the kind of "looks simple, is not" logic
// that belongs in a well-tested dependency, not a rewrite under deadline.
import { BASE_62_DIGITS, generateKeyBetween, generateNKeysBetween } from 'fractional-indexing'

/**
 * A key that sorts between `a` and `b`. `null` on either side means "no
 * bound in that direction" — `between(null, null)` is the very first key,
 * `between(a, null)` appends after `a`, `between(null, b)` prepends before `b`.
 *
 * Two rows that already carry the *same* rank (a bug elsewhere, or two
 * offline devices independently assigning one) cannot be told apart — there
 * is no correct "between" for equal bounds. Rather than throw on data that
 * already exists, the new row is placed right after the tie, so the insert
 * always succeeds and sort order stays merely ambiguous between those two,
 * not broken.
 */
export function between(a: string | null, b: string | null): string {
  if (a !== null && b !== null) {
    if (a === b) return generateKeyBetween(a, null, BASE_62_DIGITS)
    if (a > b) {
      throw new RangeError(`rank.between: bounds out of order (${JSON.stringify(a)} > ${JSON.stringify(b)})`)
    }
  }
  return generateKeyBetween(a, b, BASE_62_DIGITS)
}

/**
 * `n` fresh, evenly-spaced keys, in sorted order — used to rebalance a
 * project's siblings once repeated same-spot insertions have made
 * individual ranks grow long. Writes `n` rows once, in exchange for cheap
 * single-row moves for a long time afterward.
 */
export function rebalance(n: number): string[] {
  if (n < 0) throw new RangeError(`rank.rebalance: n must be >= 0, got ${n}`)
  if (n === 0) return []
  return generateNKeysBetween(null, null, n, BASE_62_DIGITS)
}
