// In-memory login rate limit — 5 attempts / 15 minutes per email+IP (infra
// spec §5). In-memory is correct at a single instance; a second instance is
// the signal to move this to Postgres, not before.
const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 5

const attempts = new Map<string, number[]>()

function key(email: string, ip: string): string {
  return `${email.toLowerCase()}:${ip}`
}

/** True if this email+IP has room for another attempt right now. */
export function isRateLimited(email: string, ip: string, now: number = Date.now()): boolean {
  const k = key(email, ip)
  const recent = (attempts.get(k) ?? []).filter((t) => now - t < WINDOW_MS)
  attempts.set(k, recent)
  return recent.length >= MAX_ATTEMPTS
}

/** Records one attempt (call after every login try, success or failure — spec counts attempts, not failures). */
export function recordAttempt(email: string, ip: string, now: number = Date.now()): void {
  const k = key(email, ip)
  const recent = (attempts.get(k) ?? []).filter((t) => now - t < WINDOW_MS)
  recent.push(now)
  attempts.set(k, recent)
}

/** Test-only: drops all recorded attempts. */
export function resetRateLimit(): void {
  attempts.clear()
}
