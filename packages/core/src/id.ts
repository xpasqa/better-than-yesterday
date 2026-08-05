// UUIDv7 (RFC 9562): 48-bit unix ms timestamp, then random bits, sortable as
// a plain string. Used for every row a client can create offline — see
// docs/feature/2.backend/spec.md §2.2.
//
// Monotonicity within the same millisecond matters as much as the timestamp
// itself: sync and rank both assume ids roughly preserve creation order.
// `rand_a` (12 bits) is reused as a counter that increments for repeat calls
// inside one millisecond, per the "monotonic random" method in the spec's
// appendix. A tight loop can exceed the 4096 values that fit in 12 bits
// within a real millisecond — when that happens we advance the encoded
// timestamp by one virtual millisecond rather than let ids tie or wrap, so
// the guarantee is "always increases", not "usually increases". The same
// branch absorbs a backward clock step for free.

let lastMs = -1
let counter = 0

function randomBits(bits: number): number {
  // Uniform over [0, 2^bits) using rejection-free scaling of crypto entropy.
  // bits <= 26 here, comfortably inside Number's safe-integer range.
  const bytes = new Uint8Array(4)
  crypto.getRandomValues(bytes)
  const value = (bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!
  return (value >>> (32 - bits)) >>> 0
}

function toHex(value: number, digits: number): string {
  return value.toString(16).padStart(digits, '0')
}

function nextTimestampAndCounter(now: number): { ts: number; counter: number } {
  if (now > lastMs) {
    lastMs = now
    counter = randomBits(12)
    return { ts: lastMs, counter }
  }
  // now <= lastMs: same millisecond, or the clock moved backward. Either
  // way, keep issuing from lastMs so ids never go backward.
  counter += 1
  if (counter > 0xfff) {
    lastMs += 1
    counter = randomBits(12)
  }
  return { ts: lastMs, counter }
}

/** Generates a new UUIDv7. `now` defaults to the wall clock; pass it explicitly in tests. */
export function uuidv7(now: number = Date.now()): string {
  const { ts, counter: randA } = nextTimestampAndCounter(now)

  const tsHex = toHex(ts, 12) // 48 bits
  const randAHex = toHex(randA & 0xfff, 3) // 12 bits
  const variantAndRandB1 = toHex(0x8000 | randomBits(14), 4) // 2-bit variant '10' + 14 random bits
  const randB2 = toHex(randomBits(24), 6)
  const randB3 = toHex(randomBits(24), 6)

  return (
    `${tsHex.slice(0, 8)}-${tsHex.slice(8, 12)}-7${randAHex}-` +
    `${variantAndRandB1}-${randB2}${randB3}`
  )
}
