// Tests for context assembler — 100% branch coverage required (Blok E).
// docs/feature/35.agent-orchestrator/spec.md §5
import { describe, it, expect } from 'vitest'
import { assemble, estimateTokens } from './context.ts'
import type { ContextLayer, ContextMessage } from './context.ts'

describe('estimateTokens', () => {
  it('returns ceil(length / 3.5)', () => {
    expect(estimateTokens('hello')).toBe(Math.ceil(5 / 3.5))
    expect(estimateTokens('')).toBe(0)
  })
})

describe('assemble', () => {
  const sys: ContextMessage = { role: 'system', content: 'You are helpful.' }

  function userMsg(content: string): ContextMessage {
    return { role: 'user', content }
  }

  function assistantMsg(content: string): ContextMessage {
    return { role: 'assistant', content }
  }

  function toolMsg(id: string): ContextMessage {
    return { role: 'tool', tool_call_id: id, content: 'ok' }
  }

  it('returns all messages when under cap', () => {
    const layers: ContextLayer[] = [
      { priority: 10, messages: [sys] },
      { priority: 1, messages: [userMsg('hi'), assistantMsg('hello')] },
    ]
    const { prompt, dropped } = assemble(layers, 100000)
    expect(dropped).toBe(0)
    expect(prompt).toHaveLength(3)
  })

  it('drops oldest history pair when over cap', () => {
    // Make a very tight cap
    const longContent = 'x'.repeat(1000)
    const layers: ContextLayer[] = [
      { priority: 10, messages: [sys] },
      {
        priority: 1,
        messages: [
          userMsg('first question'),
          assistantMsg('first answer'),
          userMsg(longContent),
          assistantMsg('second answer'),
        ],
      },
    ]
    // Cap that allows only ~2 messages worth
    const { prompt, dropped } = assemble(layers, 50)
    expect(dropped).toBeGreaterThan(0)
    // System message must survive (highest priority)
    expect(prompt.some(m => m.role === 'system')).toBe(true)
  })

  it('evicts paired user+assistant+tool messages together', () => {
    const assistantWithTool: ContextMessage = {
      role: 'assistant',
      content: null,
      tool_calls: [{ id: 'tc1', type: 'function', function: { name: 'f', arguments: '{}' } }],
    }
    const tool = toolMsg('tc1')
    const layers: ContextLayer[] = [
      { priority: 10, messages: [sys] },
      {
        priority: 1,
        messages: [
          userMsg('do something'),
          assistantWithTool,
          tool,
          userMsg('x'.repeat(3000)),
          assistantMsg('b'),
        ],
      },
    ]
    const { prompt, dropped } = assemble(layers, 100)
    // The first pair (user + assistant + tool) should be evicted together
    expect(dropped).toBeGreaterThan(0)
    // tool message should not appear without its assistant
    const hasOrphanTool = prompt.some(
      m => m.role === 'tool' && !prompt.some(
        a => a.role === 'assistant' &&
          'tool_calls' in a &&
          a.tool_calls?.some(tc => tc.id === (m as Extract<ContextMessage, { role: 'tool' }>).tool_call_id)
      )
    )
    expect(hasOrphanTool).toBe(false)
  })

  it('non-evictable layers remain even when cap is exceeded', () => {
    const layers: ContextLayer[] = [
      { priority: 10, messages: [sys] },
    ]
    // Cap too small even for system message
    const { prompt } = assemble(layers, 1)
    // High-priority layer must always be present
    expect(prompt).toContain(sys)
  })

  it('handles empty history layer', () => {
    const layers: ContextLayer[] = [
      { priority: 10, messages: [sys] },
      { priority: 1, messages: [] },
    ]
    const { prompt, dropped } = assemble(layers, 1000)
    expect(dropped).toBe(0)
    expect(prompt).toHaveLength(1)
  })

  it('higher priority layers sorted first', () => {
    const m1: ContextMessage = { role: 'system', content: 'high' }
    const m2: ContextMessage = { role: 'user', content: 'low' }
    const layers: ContextLayer[] = [
      { priority: 1, messages: [m2] },
      { priority: 10, messages: [m1] },
    ]
    const { prompt } = assemble(layers, 100000)
    expect(prompt[0]).toBe(m1)
    expect(prompt[1]).toBe(m2)
  })
})
