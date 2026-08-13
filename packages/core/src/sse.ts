// Pure SSE parser — shared by client and server tests.
// Blok C — docs/feature/35.agent-orchestrator/spec.md §3
//
// Bug #1 fix: AgentView.tsx:153 used `line.slice(5).trim()`, which drops
// leading spaces from tokens. Hono also splits SSE data across multiple
// `data:` lines when the payload contains newlines. This parser:
//   - joins multi-line `data:` values with \n (not overwrites)
//   - strips exactly one space after the colon (per SSE spec)
//   - never calls .trim() on the value
//   - handles \r\n, \r, and \n line endings
//   - returns leftover bytes as `rest` so streaming callers can buffer
import type { AgentEvent } from './agent-events.ts'

export interface ParseResult {
  events: AgentEvent[]
  rest: string
}

/**
 * Parse a raw SSE chunk into typed AgentEvent[].
 *
 * @param chunk  Raw text from the stream (may be partial at the end).
 * @returns      Fully-parsed events and any trailing incomplete data.
 */
export function parseSse(chunk: string): ParseResult {
  const events: AgentEvent[] = []

  // Split on event boundaries (blank line terminates an event block)
  const blocks = chunk.split(/\n\n|\r\n\r\n|\r\r/)
  // Last element is either empty (complete) or an incomplete block
  const tail = blocks.pop() ?? ''

  for (const block of blocks) {
    const lines = block.split(/\r\n|\r|\n/)
    let dataLines: string[] = []
    let eventType = 'message'

    for (const line of lines) {
      if (line.startsWith('event:')) {
        // Strip exactly one optional space after colon per SSE spec
        eventType = line.slice(6).replace(/^ /, '')
      } else if (line.startsWith('data:')) {
        // Strip exactly one optional space after colon — do NOT trim the rest
        dataLines.push(line.slice(5).replace(/^ /, ''))
      }
      // id: and retry: lines are intentionally ignored
    }

    if (dataLines.length === 0) continue
    // Multi-line data joined with \n per SSE spec §9.2.6
    const data = dataLines.join('\n')

    const event = parseEvent(eventType, data)
    if (event) events.push(event)
  }

  return { events, rest: tail }
}

function parseEvent(type: string, data: string): AgentEvent | null {
  switch (type) {
    case 'token': {
      // data IS the token text (may be a single space)
      return { type: 'token', text: data }
    }
    case 'tool': {
      try {
        const p = JSON.parse(data) as { name: string; status: 'start' | 'done' }
        return { type: 'tool', name: p.name, status: p.status }
      } catch { return null }
    }
    case 'file': {
      try {
        const p = JSON.parse(data) as { path: string }
        return { type: 'file', path: p.path }
      } catch { return null }
    }
    case 'patch': {
      try {
        const p = JSON.parse(data) as { nodeId: string }
        return { type: 'patch', nodeId: p.nodeId }
      } catch { return null }
    }
    case 'notice': {
      return { type: 'notice', text: data }
    }
    case 'error': {
      return { type: 'error', message: data }
    }
    case 'done': {
      return { type: 'done' }
    }
    default:
      return null
  }
}
