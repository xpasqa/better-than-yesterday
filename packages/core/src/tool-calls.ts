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
  /** Parsed arguments. On JSON parse failure, value is {} */
  args: Record<string, unknown>
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
      let args: Record<string, unknown> = {}
      try {
        args = JSON.parse(entry.args) as Record<string, unknown>
      } catch {
        // Invalid JSON returned to model as error (runner handles this)
      }
      return { id: entry.id, name: entry.name, args }
    })
}
