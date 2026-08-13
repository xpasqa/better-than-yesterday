// Context assembler — builds the messages array for a chat completion call
// with a token budget. Blok E — docs/feature/35.agent-orchestrator/spec.md §6
//
// Bug #5 fix: history was inserted into the prompt without any budget, so
// long sessions crashed with context_length_exceeded.
//
// Two rules do the real work here:
//
//   Priority eviction — layers are dropped lowest-priority-first, so the file
//   manifest and today-summary go before conversation history does. Pinned
//   layers (core system prompt, the message the user just sent) never go.
//
//   Paired eviction — a user+assistant turn is always evicted together with
//   the tool messages that follow it. Dropping an assistant message while
//   keeping its tool results leaves orphaned tool_call_ids, which is a 400
//   from the provider rather than a merely smaller prompt.

export interface ContextLayer {
  /** Stable name, reported in `dropped` so the UI can say what was cut. */
  id: string
  /** Higher priority = kept longer. */
  priority: number
  /** Pinned layers are never evicted, whatever the cap. */
  pinned?: boolean
  messages: ContextMessage[]
}

export type ContextMessage =
  | { role: 'system';    content: string }
  | { role: 'user';      content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCallRef[] }
  | { role: 'tool';      tool_call_id: string; content: string }

export interface ToolCallRef {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface AssembleResult {
  prompt: ContextMessage[]
  /** Ids of layers that lost content, in the order they were evicted. */
  dropped: string[]
  /** How many conversation turns were evicted from the history layer. */
  droppedTurns: number
}

/**
 * Conservative token estimator — intentionally low to stay under provider
 * limits. 3.5 chars per token gives headroom for code and JSON.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5)
}

function messageTokens(msg: ContextMessage): number {
  let text = ''
  if ('content' in msg && msg.content) text += msg.content
  if (msg.role === 'assistant' && msg.tool_calls) {
    for (const tc of msg.tool_calls) {
      text += tc.function.name + tc.function.arguments
    }
  }
  // Per-message overhead (role + framing)
  return estimateTokens(text) + 4
}

function layerTokens(messages: ContextMessage[]): number {
  return messages.reduce((sum, m) => sum + messageTokens(m), 0)
}

/**
 * Assemble layers into a prompt that fits within `cap` tokens.
 *
 * Output order follows priority descending, so the prompt reads
 * system → memory → workspace map → manifest → today → history.
 */
export function assemble(layers: ContextLayer[], cap: number): AssembleResult {
  const byPriority = [...layers].sort((a, b) => b.priority - a.priority)
  const kept = new Map<string, ContextMessage[]>(byPriority.map(l => [l.id, l.messages]))

  const dropped: string[] = []
  let droppedTurns = 0

  const total = () => byPriority.reduce((sum, l) => sum + layerTokens(kept.get(l.id)!), 0)

  // Evict lowest priority first. Within a layer, drop whole turns oldest-first
  // so a long history degrades gradually instead of vanishing at once.
  const evictable = byPriority.filter(l => !l.pinned).reverse()

  for (const layer of evictable) {
    if (total() <= cap) break

    const pairs = buildPairs(kept.get(layer.id)!)
    let survivors = kept.get(layer.id)!

    for (const pair of pairs) {
      if (total() <= cap) break
      const evicted = new Set(pair)
      survivors = survivors.filter(m => !evicted.has(m))
      kept.set(layer.id, survivors)
      if (!dropped.includes(layer.id)) dropped.push(layer.id)
      droppedTurns++
    }
  }

  const prompt = byPriority.flatMap(l => kept.get(l.id)!)
  return { prompt, dropped, droppedTurns }
}

/**
 * Group messages into evictable units: [user, assistant, ...tool].
 * A message that does not start a turn is its own unit, so a layer that holds
 * a single system-style message is still evictable as a whole.
 */
function buildPairs(messages: ContextMessage[]): ContextMessage[][] {
  const pairs: ContextMessage[][] = []
  let i = 0

  while (i < messages.length) {
    const msg = messages[i]!
    if (msg.role === 'user') {
      const pair: ContextMessage[] = [msg]
      i++
      if (i < messages.length && messages[i]!.role === 'assistant') {
        pair.push(messages[i]!)
        i++
        while (i < messages.length && messages[i]!.role === 'tool') {
          pair.push(messages[i]!)
          i++
        }
      }
      pairs.push(pair)
    } else {
      pairs.push([msg])
      i++
    }
  }

  return pairs
}
