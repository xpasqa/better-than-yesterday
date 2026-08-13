// Tests for SSE parser — 100% branch coverage required (Blok C).
// docs/feature/35.agent-orchestrator/spec.md §3
import { describe, it, expect } from 'vitest'
import { parseSse, serializeEvent } from './sse.ts'
import type { AgentEvent } from './agent-events.ts'

/** Reproduces hono's writeSSE framing so the round-trip test exercises the real wire. */
function frame(ev: AgentEvent): string {
  const { event, data } = serializeEvent(ev)
  const dataLines = data.split(/\r\n|\r|\n/).map(l => `data: ${l}`).join('\n')
  return `event: ${event}\n${dataLines}\n\n`
}

describe('serializeEvent → parseSse round-trip', () => {
  const cases: AgentEvent[] = [
    { type: 'token', text: 'hello' },
    { type: 'token', text: ' ' },
    { type: 'token', text: 'a\nb' },
    { type: 'token', text: '  leading and trailing  ' },
    { type: 'token', text: '# Judul\n\n- satu\n- dua' },
    { type: 'tool', name: 'list_tasks', status: 'start' },
    { type: 'tool', name: 'list_tasks', status: 'done' },
    { type: 'file', path: 'riset/temuan.md' },
    { type: 'patch', nodeId: 'node-1' },
    { type: 'notice', text: 'percakapan awal diringkas' },
    { type: 'error', message: 'Rate limit reached.' },
    { type: 'done' },
  ]

  for (const ev of cases) {
    it(`survives the wire: ${ev.type} ${JSON.stringify('text' in ev ? ev.text : '')}`, () => {
      const { events, rest } = parseSse(frame(ev))
      expect(rest).toBe('')
      expect(events).toEqual([ev])
    })
  }

  it('survives being split at every byte boundary', () => {
    const wire = cases.map(frame).join('')
    for (let cut = 1; cut < wire.length; cut++) {
      const a = parseSse(wire.slice(0, cut))
      const b = parseSse(a.rest + wire.slice(cut))
      expect([...a.events, ...b.events]).toEqual(cases)
    }
  })
})

describe('parseSse', () => {
  it('parses a simple token event', () => {
    const { events, rest } = parseSse('event: token\ndata: hello\n\n')
    expect(events).toEqual([{ type: 'token', text: 'hello' }])
    expect(rest).toBe('')
  })

  it('preserves a single space token — bug #1 regression', () => {
    const { events } = parseSse('event: token\ndata:  \n\n')
    expect(events[0]).toEqual({ type: 'token', text: ' ' })
  })

  it('preserves leading spaces in token text', () => {
    const { events } = parseSse('event: token\ndata:   indented\n\n')
    expect(events[0]).toEqual({ type: 'token', text: '  indented' })
  })

  it('joins multi-line data with newline', () => {
    const { events } = parseSse('event: token\ndata: line1\ndata: line2\n\n')
    expect(events[0]).toEqual({ type: 'token', text: 'line1\nline2' })
  })

  it('handles \\r\\n line endings', () => {
    const { events } = parseSse('event: token\r\ndata: hello\r\n\r\n')
    expect(events[0]).toEqual({ type: 'token', text: 'hello' })
  })

  it('handles \\r line endings', () => {
    const { events } = parseSse('event: token\rdata: hello\r\r')
    expect(events[0]).toEqual({ type: 'token', text: 'hello' })
  })

  it('skips events with no data lines', () => {
    const { events } = parseSse('event: token\n\n')
    expect(events).toHaveLength(0)
  })

  it('returns incomplete block as rest', () => {
    const { events, rest } = parseSse('event: token\ndata: hello\n\nevent: token\ndata: wor')
    expect(events).toHaveLength(1)
    expect(rest).toBe('event: token\ndata: wor')
  })

  it('parses done event', () => {
    const { events } = parseSse('event: done\ndata: \n\n')
    expect(events).toEqual([{ type: 'done' }])
  })

  it('parses error event', () => {
    const { events } = parseSse('event: error\ndata: something went wrong\n\n')
    expect(events).toEqual([{ type: 'error', message: 'something went wrong' }])
  })

  it('parses file event', () => {
    const { events } = parseSse('event: file\ndata: {"path":"docs/foo.md"}\n\n')
    expect(events).toEqual([{ type: 'file', path: 'docs/foo.md' }])
  })

  it('parses tool event', () => {
    const { events } = parseSse('event: tool\ndata: {"name":"write_file","status":"start"}\n\n')
    expect(events).toEqual([{ type: 'tool', name: 'write_file', status: 'start' }])
  })

  it('parses patch event', () => {
    const { events } = parseSse('event: patch\ndata: {"nodeId":"abc123"}\n\n')
    expect(events).toEqual([{ type: 'patch', nodeId: 'abc123' }])
  })

  it('parses notice event', () => {
    const { events } = parseSse('event: notice\ndata: rate limited\n\n')
    expect(events).toEqual([{ type: 'notice', text: 'rate limited' }])
  })

  it('skips unknown event types', () => {
    const { events } = parseSse('event: unknown_thing\ndata: foo\n\n')
    expect(events).toHaveLength(0)
  })

  it('skips malformed JSON in file event', () => {
    const { events } = parseSse('event: file\ndata: not-json\n\n')
    expect(events).toHaveLength(0)
  })

  it('skips malformed JSON in tool event', () => {
    const { events } = parseSse('event: tool\ndata: {broken\n\n')
    expect(events).toHaveLength(0)
  })

  it('handles multiple events in one chunk', () => {
    const chunk = 'event: token\ndata: a\n\nevent: token\ndata: b\n\nevent: done\ndata: \n\n'
    const { events } = parseSse(chunk)
    expect(events).toHaveLength(3)
    expect(events[0]).toEqual({ type: 'token', text: 'a' })
    expect(events[1]).toEqual({ type: 'token', text: 'b' })
    expect(events[2]).toEqual({ type: 'done' })
  })

  it('handles empty chunk', () => {
    const { events, rest } = parseSse('')
    expect(events).toHaveLength(0)
    expect(rest).toBe('')
  })

  it('data without event: defaults to message type (skipped)', () => {
    const { events } = parseSse('data: foo\n\n')
    expect(events).toHaveLength(0)
  })
})
