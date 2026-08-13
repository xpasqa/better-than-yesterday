// Pure tool-call accumulator — extracted from runner.ts so it can be unit
// tested. Blok D — docs/feature/35.agent-orchestrator/spec.md §4
//
// Bug #4 fix: runner.ts:125 used `name += tc.function.name`, so gateway
// providers that repeat the full name on every delta produced
// "write_filewrite_file" → "Error: unknown tool".
// Fix: name is SET, not appended.
//
// Key assignment: use `id` when present, fall back to insertion order
// ("call_0", "call_1", …) for providers that omit ids.

export interface ToolCallState {
  [key: string]: {
    id: string
    name: string
    args: string  // raw JSON fragments, concatenated
  }
}

export interface FinalizedToolCall {
  id: string
  name: string
  /** Parsed arguments. `{}` when the fragments were empty or unparseable. */
  args: Record<string, unknown>
  /**
   * Set when the accumulated fragments were non-empty but not valid JSON.
   * The runner returns this to the model as the tool result so it can retry
   * (spec §5.1) — previously the failure was swallowed and the tool ran with
   * empty arguments, which surfaced as a confusing "content is required".
   *
   * Absent for a tool legitimately called with no arguments: empty fragments
   * are `{}`, not an error.
   */
  argsError?: string
}

type Delta = {
  index?: number
  id?: string | null
  function?: { name?: string | null; arguments?: string | null } | null
}

/**
 * Accumulate a streaming tool_calls delta into mutable state.
 * Call once per chunk; follow with finalize() after the stream ends.
 */
export function accumulate(state: ToolCallState, delta: Delta): void {
  const index = delta.index ?? 0
  const id = delta.id ?? null
  const fallbackKey = `call_${index}`

  // Find existing entry by id (if we have one) OR by fallback key
  let entry = id ? (state[id] ?? state[fallbackKey]) : state[fallbackKey]

  if (!entry) {
    const entryId = id ?? fallbackKey
    entry = { id: entryId, name: '', args: '' }
    state[entryId] = entry
  } else if (id && !state[id]) {
    // Entry was stored under fallbackKey but now we have a real id — re-key it
    delete state[fallbackKey]
    entry.id = id
    state[id] = entry
  }

  // Always ASSIGN id and name — never append (bug #4)
  if (id) entry.id = id
  if (delta.function?.name) entry.name = delta.function.name
  if (delta.function?.arguments) entry.args += delta.function.arguments
}

/**
 * Convert accumulated state to finalized tool calls with parsed args.
 * Returns only entries that have a non-empty name.
 */
export function finalize(state: ToolCallState): FinalizedToolCall[] {
  return Object.values(state)
    .filter(entry => entry.name.length > 0)
    .map(entry => {
      const raw = entry.args.trim()
      // No fragments at all is a tool called without arguments — not an error.
      if (raw === '') return { id: entry.id, name: entry.name, args: {} }
      try {
        const parsed = JSON.parse(raw) as unknown
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return {
            id: entry.id,
            name: entry.name,
            args: {},
            argsError: `arguments must be a JSON object, got: ${truncate(raw)}`,
          }
        }
        return { id: entry.id, name: entry.name, args: parsed as Record<string, unknown> }
      } catch {
        return {
          id: entry.id,
          name: entry.name,
          args: {},
          argsError: `arguments are not valid JSON: ${truncate(raw)}`,
        }
      }
    })
}

function truncate(s: string): string {
  return s.length > 120 ? `${s.slice(0, 120)}…` : s
}
