// Tests for tool-call accumulator — 100% branch coverage required (Blok D).
// docs/feature/35.agent-orchestrator/spec.md §4
import { describe, it, expect } from 'vitest'
import { accumulate, finalize } from './tool-calls.ts'
import type { ToolCallState } from './tool-calls.ts'

describe('accumulate + finalize', () => {
  it('accumulates a complete single tool call', () => {
    const state: ToolCallState = {}
    accumulate(state, { index: 0, id: 'call_1', function: { name: 'write_file', arguments: '{"path":' } })
    accumulate(state, { index: 0, id: 'call_1', function: { name: 'write_file', arguments: '"foo.md"}' } })
    const result = finalize(state)
    expect(result).toHaveLength(1)
    expect(result[0]!.name).toBe('write_file')
    expect(result[0]!.args).toEqual({ path: 'foo.md' })
    expect(result[0]!.id).toBe('call_1')
  })

  it('name is SET not appended — bug #4 regression', () => {
    const state: ToolCallState = {}
    // Provider repeats full name on every chunk
    accumulate(state, { index: 0, id: 'c1', function: { name: 'write_file', arguments: '{' } })
    accumulate(state, { index: 0, id: 'c1', function: { name: 'write_file', arguments: '}' } })
    const result = finalize(state)
    // Should be 'write_file' not 'write_filewrite_file'
    expect(result[0]!.name).toBe('write_file')
  })

  it('falls back to call_<index> when id is absent', () => {
    const state: ToolCallState = {}
    accumulate(state, { index: 0, function: { name: 'list_tasks', arguments: '{}' } })
    const result = finalize(state)
    expect(result[0]!.id).toBe('call_0')
  })

  it('accumulates two parallel tool calls by id', () => {
    const state: ToolCallState = {}
    accumulate(state, { index: 0, id: 'c1', function: { name: 'list_tasks', arguments: '{}' } })
    accumulate(state, { index: 1, id: 'c2', function: { name: 'read_file', arguments: '{"path":"a.md"}' } })
    const result = finalize(state)
    expect(result).toHaveLength(2)
    expect(result.map(r => r.name).sort()).toEqual(['list_tasks', 'read_file'])
  })

  it('returns empty args object on JSON parse failure', () => {
    const state: ToolCallState = {}
    accumulate(state, { index: 0, id: 'c1', function: { name: 'write_file', arguments: '{bad json' } })
    const result = finalize(state)
    expect(result[0]!.args).toEqual({})
  })

  it('filters out entries with empty name', () => {
    const state: ToolCallState = {}
    accumulate(state, { index: 0, id: 'c1', function: { arguments: '{}' } })
    const result = finalize(state)
    expect(result).toHaveLength(0)
  })

  it('handles delta with no function field', () => {
    const state: ToolCallState = {}
    accumulate(state, { index: 0, id: 'c1', function: { name: 'foo', arguments: '' } })
    accumulate(state, { index: 0 }) // no function field
    const result = finalize(state)
    expect(result[0]!.name).toBe('foo')
  })

  it('id present in later chunk updates the entry id', () => {
    const state: ToolCallState = {}
    // First chunk has no id, second has id
    accumulate(state, { index: 0, function: { name: 'tool_a', arguments: '' } })
    accumulate(state, { index: 0, id: 'real_id', function: { arguments: '{}' } })
    const result = finalize(state)
    expect(result[0]!.id).toBe('real_id')
  })
})
