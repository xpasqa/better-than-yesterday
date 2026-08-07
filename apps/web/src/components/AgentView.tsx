import { useState, useRef } from 'react'
import { PaperPlaneTiltIcon } from '@phosphor-icons/react'
import AgentChat from './AgentChat'
import type { AgentFile } from '../agent/mockFiles'
import './AgentView.css'

const USER_NAME = 'Pasqa'
const API_BASE = '/api/agent'

export type ChatMessage =
  | { id: string; role: 'user' | 'agent'; kind: 'text'; content: string; time: string }
  | { id: string; role: 'agent'; kind: 'file'; path: string; time: string }

const EXAMPLES = [
  'Summarise what I finished this week',
  'What should I work on first today?',
  'Draft a reply to the latest client email',
  'Break the Q4 roadmap into tasks',
]

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 5) return `Up late, ${USER_NAME}`
  if (hour < 12) return `Good morning, ${USER_NAME}`
  if (hour < 18) return `Good afternoon, ${USER_NAME}`
  if (hour < 22) return `Good evening, ${USER_NAME}`
  return `Up late, ${USER_NAME}`
}

function generateId() {
  return Math.random().toString(36).slice(2, 9)
}

function timeNow() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function AgentView() {
  const [prompt, setPrompt] = useState('')
  const [mode, setMode] = useState<'chat' | 'cowork'>('chat')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [files, setFiles] = useState<AgentFile[]>([])
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [unseenPaths, setUnseenPaths] = useState<Set<string>>(new Set())
  const [isStreaming, setIsStreaming] = useState(false)
  // nodeId: null = global context, set to project node id when in a project
  const nodeId = useRef<string | null>(null)

  const selectFile = (path: string) => {
    setSelectedPath(path)
    setUnseenPaths(prev => {
      if (!prev.has(path)) return prev
      const next = new Set(prev)
      next.delete(path)
      return next
    })
  }

  const sendText = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isStreaming) return

    const userMsgId = generateId()
    const agentMsgId = generateId()
    const t = timeNow()

    // Add user message + empty agent placeholder immediately
    setMessages(prev => [
      ...prev,
      { id: userMsgId, role: 'user', kind: 'text', content: trimmed, time: t },
      { id: agentMsgId, role: 'agent', kind: 'text', content: '', time: t },
    ])
    setPrompt('')
    setIsStreaming(true)

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, nodeId: nodeId.current }),
        credentials: 'include',
      })

      if (!res.ok || !res.body) {
        const errText = res.status === 401
          ? 'Not logged in. Please refresh and log in again.'
          : `Request failed (${res.status})`
        setMessages(prev =>
          prev.map(m => m.id === agentMsgId && m.kind === 'text' ? { ...m, content: errText } : m),
        )
        setIsStreaming(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // SSE messages are separated by double newlines. Split on that boundary
        // so each chunk is one complete "event:\ndata:\n" block.
        const parts = buffer.split('\n\n')
        // Keep the last (possibly incomplete) part in the buffer
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          // Extract event name and data from each SSE message block
          let eventName = 'token'
          let raw = ''
          for (const line of part.split('\n')) {
            if (line.startsWith('event:')) {
              eventName = line.slice(6).trim()
            } else if (line.startsWith('data:')) {
              raw = line.slice(5).trim()
            }
          }
          if (!raw && eventName !== 'done') continue

          if (eventName === 'token') {
            setMessages(prev =>
              prev.map(m =>
                m.id === agentMsgId && m.kind === 'text'
                  ? { ...m, content: m.content + raw }
                  : m,
              ),
            )
          } else if (eventName === 'file') {
            try {
              const { path } = JSON.parse(raw) as { path: string }
              setFiles(prev => {
                const exists = prev.some(f => f.path === path)
                if (exists) return prev
                const newFile: AgentFile = { path, content: '' }
                const isFirst = prev.length === 0
                if (isFirst) {
                  setPanelOpen(true)
                  selectFile(path)
                }
                setUnseenPaths(p => new Set(p).add(path))
                setMessages(mp => [
                  ...mp,
                  { id: generateId(), role: 'agent', kind: 'file', path, time: timeNow() },
                ])
                return [...prev, newFile]
              })
            } catch { /* malformed */ }
          } else if (eventName === 'error') {
            setMessages(prev =>
              prev.map(m =>
                m.id === agentMsgId && m.kind === 'text'
                  ? { ...m, content: raw || 'An error occurred.' }
                  : m,
              ),
            )
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error'
      setMessages(prev =>
        prev.map(m =>
          m.id === agentMsgId && m.kind === 'text' ? { ...m, content: msg } : m,
        ),
      )
    } finally {
      setIsStreaming(false)
    }
  }

  if (messages.length > 0) {
    return (
      <AgentChat
        messages={messages}
        prompt={prompt}
        onPromptChange={setPrompt}
        onSend={() => { void sendText(prompt) }}
        onBack={() => {
          setMessages([])
          setPrompt('')
          setFiles([])
          setSelectedPath(null)
          setPanelOpen(false)
          setUnseenPaths(new Set())
          setIsStreaming(false)
        }}
        files={files}
        panelOpen={panelOpen}
        selectedPath={selectedPath}
        unseenPaths={unseenPaths}
        onSelectFile={selectFile}
        onOpenPanel={() => setPanelOpen(true)}
        onClosePanel={() => setPanelOpen(false)}
        isStreaming={isStreaming}
      />
    )
  }

  return (
    <main className="agent-view">
      <div className="agent-view__inner">
        <div className="agent-view__header">
          <h1 className="agent-view__title">Agent</h1>
          <p className="agent-view__subtitle">{getGreeting()}</p>
        </div>

        <div className="agent-view__composer-wrap">
          <div className="agent-view__composer">
            <textarea
              className="agent-view__input"
              placeholder="Ask anything, or describe what you want done"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendText(prompt) }
              }}
              rows={2}
            />
            <div className="agent-view__composer-actions">
              <div className="agent-view__mode-toggle">
                <button
                  className={`agent-view__mode-btn ${mode === 'chat' ? 'agent-view__mode-btn--active' : ''}`}
                  onClick={() => setMode('chat')}
                  type="button"
                >
                  Chat
                </button>
                <button
                  className={`agent-view__mode-btn ${mode === 'cowork' ? 'agent-view__mode-btn--active' : ''}`}
                  onClick={() => setMode('cowork')}
                  type="button"
                >
                  Cowork
                </button>
              </div>
              <button
                className="agent-view__send-btn"
                onClick={() => { void sendText(prompt) }}
                disabled={!prompt.trim() || isStreaming}
                aria-label="Send"
                type="button"
              >
                <PaperPlaneTiltIcon size={15} weight="fill" />
              </button>
            </div>
          </div>
        </div>

        <div className="agent-view__examples">
          <p className="agent-view__examples-label">Try asking</p>
          {EXAMPLES.map(example => (
            <button
              key={example}
              className="agent-view__example"
              onClick={() => { void sendText(example) }}
              type="button"
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}
