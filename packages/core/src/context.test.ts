// Tests for the context assembler — 100% branch coverage required (Blok E).
// docs/feature/35.agent-orchestrator/spec.md §6
import { describe, it, expect } from 'vitest'
import { assemble, estimateTokens } from './context.ts'
import type { ContextLayer, ContextMessage } from './context.ts'

const sys: ContextMessage = { role: 'system', content: 'You are helpful.' }

function userMsg(content: string): ContextMessage {
  return { role: 'user', content }
}
function assistantMsg(content: string): ContextMessage {
  return { role: 'assistant', content }
}
function assistantWithCall(id: string): ContextMessage {
  return {
    role: 'assistant',
    content: null,
    tool_calls: [{ id, type: 'function', function: { name: 'list_tasks', arguments: '{}' } }],
  }
}
function toolMsg(id: string): ContextMessage {
  return { role: 'tool', tool_call_id: id, content: 'ok' }
}

/** A turn big enough that a handful of them blow any small cap. */
function fatTurn(n: number): ContextMessage[] {
  return [userMsg(`pertanyaan ${n} `.repeat(20)), assistantMsg(`jawaban ${n} `.repeat(20))]
}

describe('estimateTokens', () => {
  it('is conservative — never under-counts short strings', () => {
    expect(estimateTokens('')).toBe(0)
    expect(estimateTokens('abcd')).toBe(2)
  })
})

describe('assemble', () => {
  it('returns everything when under cap', () => {
    const layers: ContextLayer[] = [
      { id: 'system', priority: 100, pinned: true, messages: [sys] },
      { id: 'history', priority: 50, messages: [userMsg('hai'), assistantMsg('halo')] },
    ]
    const { prompt, dropped, droppedTurns } = assemble(layers, 10_000)
    expect(prompt).toHaveLength(3)
    expect(dropped).toEqual([])
    expect(droppedTurns).toBe(0)
  })

  it('orders the prompt by priority descending, not by input order', () => {
    const layers: ContextLayer[] = [
      { id: 'history', priority: 50, messages: [userMsg('terakhir')] },
      { id: 'system', priority: 100, pinned: true, messages: [sys] },
      { id: 'memory', priority: 95, messages: [{ role: 'system', content: 'AGENT.md' }] },
    ]
    const { prompt } = assemble(layers, 10_000)
    expect(prompt.map(m => ('content' in m ? m.content : ''))).toEqual([
      'You are helpful.', 'AGENT.md', 'terakhir',
    ])
  })

  it('evicts the lowest-priority layer before touching a higher one', () => {
    const layers: ContextLayer[] = [
      { id: 'system', priority: 100, pinned: true, messages: [sys] },
      { id: 'manifest', priority: 70, messages: [{ role: 'system', content: 'berkas: '.repeat(40) }] },
      { id: 'history', priority: 50, messages: fatTurn(1) },
    ]
    const { dropped } = assemble(layers, 60)
    // history (50) is lower than manifest (70), so it goes first
    expect(dropped[0]).toBe('history')
  })

  it('spills into the next layer up when one is not enough', () => {
    const layers: ContextLayer[] = [
      { id: 'system', priority: 100, pinned: true, messages: [sys] },
      { id: 'manifest', priority: 70, messages: [{ role: 'system', content: 'berkas: '.repeat(40) }] },
      { id: 'history', priority: 50, messages: [...fatTurn(1), ...fatTurn(2)] },
    ]
    const { dropped } = assemble(layers, 15)
    expect(dropped).toContain('history')
    expect(dropped).toContain('manifest')
    // lowest priority is reported first
    expect(dropped.indexOf('history')).toBeLessThan(dropped.indexOf('manifest'))
  })

  it('never evicts a pinned layer, even when the cap is impossible', () => {
    const layers: ContextLayer[] = [
      { id: 'system', priority: 100, pinned: true, messages: [sys] },
      { id: 'now', priority: 99, pinned: true, messages: [userMsg('pesan sekarang')] },
      { id: 'history', priority: 50, messages: fatTurn(1) },
    ]
    const { prompt, dropped } = assemble(layers, 1)
    expect(prompt).toContain(sys)
    expect(prompt.some(m => 'content' in m && m.content === 'pesan sekarang')).toBe(true)
    expect(dropped).toEqual(['history'])
  })

  it('evicts the oldest turn first', () => {
    const layers: ContextLayer[] = [
      { id: 'system', priority: 100, pinned: true, messages: [sys] },
      { id: 'history', priority: 50, messages: [...fatTurn(1), ...fatTurn(2)] },
    ]
    // One turn is ~157 tokens; a cap of 200 fits exactly one plus the system
    // message, so the older turn must be the one that goes.
    const { prompt, droppedTurns } = assemble(layers, 200)
    const text = prompt.map(m => ('content' in m ? m.content ?? '' : '')).join(' ')
    expect(droppedTurns).toBe(1)
    expect(text).not.toContain('pertanyaan 1')
    expect(text).toContain('pertanyaan 2')
  })

  it('evicts an assistant together with its tool results — no orphaned tool_call_id', () => {
    const layers: ContextLayer[] = [
      { id: 'system', priority: 100, pinned: true, messages: [sys] },
      {
        id: 'history',
        priority: 50,
        messages: [
          userMsg('kerjakan '.repeat(30)), assistantWithCall('tc1'), toolMsg('tc1'),
          userMsg('lanjut'), assistantMsg('siap'),
        ],
      },
    ]
    const { prompt } = assemble(layers, 30)

    const toolIds = prompt.filter(m => m.role === 'tool').map(m => (m as { tool_call_id: string }).tool_call_id)
    const callIds = prompt.flatMap(m =>
      m.role === 'assistant' && m.tool_calls ? m.tool_calls.map(tc => tc.id) : [],
    )
    for (const id of toolIds) expect(callIds).toContain(id)
  })

  it('handles an empty layer list', () => {
    const { prompt, dropped, droppedTurns } = assemble([], 100)
    expect(prompt).toEqual([])
    expect(dropped).toEqual([])
    expect(droppedTurns).toBe(0)
  })

  it('handles a layer whose messages are already empty', () => {
    const layers: ContextLayer[] = [
      { id: 'system', priority: 100, pinned: true, messages: [sys] },
      { id: 'history', priority: 50, messages: [] },
    ]
    const { prompt, dropped } = assemble(layers, 1)
    expect(prompt).toEqual([sys])
    expect(dropped).toEqual([])
  })

  it('evicts a leading assistant or tool message as its own unit', () => {
    // History that begins mid-turn (session resumed after a failed turn).
    const layers: ContextLayer[] = [
      { id: 'system', priority: 100, pinned: true, messages: [sys] },
      { id: 'history', priority: 50, messages: [assistantMsg('sisa '.repeat(40)), userMsg('halo')] },
    ]
    const { prompt, droppedTurns } = assemble(layers, 20)
    expect(droppedTurns).toBeGreaterThan(0)
    expect(prompt.some(m => 'content' in m && m.content === 'halo')).toBe(true)
  })

  it('reports a layer once even when several of its turns are evicted', () => {
    const layers: ContextLayer[] = [
      { id: 'system', priority: 100, pinned: true, messages: [sys] },
      { id: 'history', priority: 50, messages: [...fatTurn(1), ...fatTurn(2), ...fatTurn(3)] },
    ]
    const { dropped, droppedTurns } = assemble(layers, 10)
    expect(dropped).toEqual(['history'])
    expect(droppedTurns).toBe(3)
  })
})
