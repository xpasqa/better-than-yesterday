// TodoCommandBar — kotak perintah agent di dalam view Todo.
// docs/feature/35.agent-orchestrator/spec.md §4 (Blok I)
//
// Perbedaan dari AgentView:
// - Tidak ada sesi atau riwayat di DB — satu giliran terakhir disimpan di state
// - Balasan sebelumnya DIGANTI, bukan ditumpuk
// - Event `tool` ditampilkan sebagai indikator progres inline
// - Tombol Undo untuk balasan yang mengandung penulisan task
import { useState, useRef, useCallback } from 'react'
import { parseSse } from '@better/core/sse'
import type { AgentEvent } from '@better/core/agent-events'
import './TodoCommandBar.css'

interface PreviousTurn {
  user: string
  assistant: string
}

interface TodoCommandBarProps {
  /** Project node id — null for global context (Inbox/Today/etc). */
  nodeId?: string | null
}

export default function TodoCommandBar({ nodeId = null }: TodoCommandBarProps) {
  const [input, setInput] = useState('')
  const [reply, setReply] = useState<string | null>(null)
  const [toolStatus, setToolStatus] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [hasWrites, setHasWrites] = useState(false)
  const [previousTurn, setPreviousTurn] = useState<PreviousTurn | null>(null)
  const [expanded, setExpanded] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const sendCommand = useCallback(async (message: string) => {
    if (!message.trim() || isStreaming) return

    setIsStreaming(true)
    setReply('')
    setToolStatus(null)
    setHasWrites(false)

    let accumulated = ''

    try {
      const res = await fetch('/api/agent/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.trim(),
          nodeId,
          previousTurn: previousTurn ?? undefined,
        }),
        credentials: 'include',
      })

      if (!res.ok || !res.body) {
        const errText = res.status === 401
          ? 'Not logged in.'
          : `Request failed (${res.status})`
        setReply(errText)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const { events, rest } = parseSse(buffer)
        buffer = rest

        for (const event of events) {
          handleEvent(event)
        }
      }

      // Save this turn for context continuity
      setPreviousTurn({ user: message.trim(), assistant: accumulated })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error'
      setReply(msg)
    } finally {
      setIsStreaming(false)
      setToolStatus(null)
      setInput('')
      setExpanded(true)
    }

    function handleEvent(event: AgentEvent) {
      switch (event.type) {
        case 'token':
          accumulated += event.text
          setReply(accumulated)
          break
        case 'tool':
          if (event.status === 'start') {
            setToolStatus(toolLabel(event.name))
          } else {
            setToolStatus(null)
            // Mark that this turn wrote tasks — enables Undo
            if (
              event.name === 'add_task' ||
              event.name === 'update_task' ||
              event.name === 'add_subtask'
            ) {
              setHasWrites(true)
            }
          }
          break
        case 'error':
          setReply(event.message || 'An error occurred.')
          break
        case 'done':
          break
      }
    }
  }, [isStreaming, nodeId, previousTurn])

  function toolLabel(name: string): string {
    switch (name) {
      case 'list_tasks': return 'Listing tasks…'
      case 'get_task': return 'Reading task…'
      case 'add_task': return 'Creating task…'
      case 'add_subtask': return 'Adding subtask…'
      case 'update_task': return 'Updating task…'
      default: return 'Working…'
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendCommand(input)
    }
  }

  function handleUndo() {
    // Clear the last reply and previous turn so next message starts fresh
    setReply(null)
    setHasWrites(false)
    setPreviousTurn(null)
    // Trigger a sync poll to get the latest state (if sync hook is available)
    window.dispatchEvent(new CustomEvent('agent:undo'))
  }

  return (
    <div className={`todo-command-bar${expanded ? ' todo-command-bar--expanded' : ''}`}>
      <div className="todo-command-bar__input-row">
        <textarea
          ref={textareaRef}
          className="todo-command-bar__input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setExpanded(true)}
          placeholder="Ask agent to manage tasks…"
          rows={1}
          disabled={isStreaming}
          aria-label="Agent command"
        />
        <button
          className="todo-command-bar__send"
          onClick={() => { void sendCommand(input) }}
          disabled={!input.trim() || isStreaming}
          type="button"
          aria-label="Send"
        >
          {isStreaming ? '…' : '↑'}
        </button>
      </div>

      {isStreaming && toolStatus && (
        <p className="todo-command-bar__tool-status" aria-live="polite">
          {toolStatus}
        </p>
      )}

      {reply !== null && !isStreaming && (
        <div className="todo-command-bar__reply">
          <p className="todo-command-bar__reply-text">{reply}</p>
          <div className="todo-command-bar__reply-actions">
            {hasWrites && (
              <button
                className="todo-command-bar__undo"
                onClick={handleUndo}
                type="button"
              >
                Undo
              </button>
            )}
            <button
              className="todo-command-bar__clear"
              onClick={() => { setReply(null); setHasWrites(false); setExpanded(false) }}
              type="button"
              aria-label="Dismiss reply"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
