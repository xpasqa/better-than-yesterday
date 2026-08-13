// Context assembler — builds the messages array for a chat completion call
// with a token budget. Blok E — docs/feature/35.agent-orchestrator/spec.md §5
//
// Bug #5 fix: history was inserted into the prompt without any budget, so
// long sessions crashed with context_length_exceeded.
//
// Paired eviction: a user+assistant turn is always evicted together with
// all tool messages that follow the assistant message (they reference
// tool_call_ids that become orphaned otherwise — a 400 from the provider).

export interface ContextLayer {
  /** Higher priority = kept longer. System layers should use high values. */
  priority: number
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
  /** Number of history turns that were evicted to fit within cap. */
  dropped: number
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

/**
 * Assemble layers into a prompt that fits within `cap` tokens.
 *
 * Layers are sorted descending by priority. Within each layer, messages are
 * included as-is. Only the lowest-priority layer is considered evictable
 * (conventionally the history layer). Higher-priority layers are NEVER
 * evicted — they are pinned regardless of the cap.
 *
 * A "pair" is: the user message + the assistant message that follows + all
 * tool messages attached to that assistant message. Evicting them together
 * prevents orphaned tool_call_ids.
 */
export function assemble(layers: ContextLayer[], cap: number): AssembleResult {
  if (layers.length === 0) return { prompt: [], dropped: 0 }

  // Sort by priority descending so high-priority layers come first
  const sorted = [...layers].sort((a, b) => b.priority - a.priority)

  // The highest-priority layer is always pinned (never evicted).
  // If there are multiple layers, the lowest-priority one is the evictable
  // history layer. If there is only one layer, it is pinned and nothing
  // is evictable — we just return everything regardless of cap.
  if (sorted.length === 1) {
    return { prompt: sorted[0]!.messages, dropped: 0 }
  }

  // Pinned = all layers except the lowest-priority one (which is evictable)
  const evictableLayer = sorted[sorted.length - 1]!
  const pinnedLayers = sorted.slice(0, sorted.length - 1)

  const pinnedMessages: ContextMessage[] = pinnedLayers.flatMap(l => l.messages)
  const historyMessages: ContextMessage[] = evictableLayer.messages

  // Build evictable pairs from the history layer
  const pairs = buildPairs(historyMessages)

  // Count total tokens across everything
  const pinnedTokens = pinnedMessages.reduce((sum, m) => sum + messageTokens(m), 0)
  let historyTokens = historyMessages.reduce((sum, m) => sum + messageTokens(m), 0)
  let dropped = 0

  // Evict oldest pairs first until pinned + remaining history fits within cap
  const evictedSet = new Set<ContextMessage>()
  for (const pair of pairs) {
    if (pinnedTokens + historyTokens <= cap) break
    const pairTokens = pair.reduce((sum, m) => sum + messageTokens(m), 0)
    historyTokens -= pairTokens
    dropped++
    for (const msg of pair) evictedSet.add(msg)
  }

  // Flatten in priority order: pinned first, then remaining history
  const remainingHistory = historyMessages.filter(m => !evictedSet.has(m))
  const prompt = [...pinnedMessages, ...remainingHistory]

  return { prompt, dropped }
}

/** Group history messages into evictable [user, assistant, ...tool] pairs. */
function buildPairs(messages: ContextMessage[]): ContextMessage[][] {
  const pairs: ContextMessage[][] = []
  let i = 0

  while (i < messages.length) {
    const msg = messages[i]!
    if (msg.role === 'user') {
      const pair: ContextMessage[] = [msg]
      i++
      // Collect the assistant message that follows
      if (i < messages.length && messages[i]!.role === 'assistant') {
        pair.push(messages[i]!)
        i++
        // Collect all tool messages that follow this assistant message
        while (i < messages.length && messages[i]!.role === 'tool') {
          pair.push(messages[i]!)
          i++
        }
      }
      pairs.push(pair)
    } else {
      // Orphaned assistant/tool messages — evict as a singleton
      pairs.push([msg])
      i++
    }
  }

  return pairs
}

