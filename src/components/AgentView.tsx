import { useState } from 'react'
import { PaperPlaneTiltIcon } from '@phosphor-icons/react'
import AgentChat from './AgentChat'
import './AgentView.css'

const USER_NAME = 'Pasqa'

export interface ChatMessage {
  id: string
  role: 'user' | 'agent'
  content: string
  time: string
}

const AGENT_REPLY = 'This is a demo response — nothing here is wired to a real agent. '
  + 'In a working version, this is where an actual answer would go.'

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

  const sendText = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    setMessages(prev => [
      ...prev,
      { id: generateId(), role: 'user', content: trimmed, time: timeNow() },
      { id: generateId(), role: 'agent', content: AGENT_REPLY, time: timeNow() },
    ])
    setPrompt('')
  }

  if (messages.length > 0) {
    return (
      <AgentChat
        messages={messages}
        prompt={prompt}
        onPromptChange={setPrompt}
        onSend={() => sendText(prompt)}
        onBack={() => { setMessages([]); setPrompt('') }}
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

        <div className="agent-view__composer">
          <textarea
            className="agent-view__input"
            placeholder="Ask anything, or describe what you want done"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(prompt) }
            }}
            rows={2}
            autoFocus
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
              onClick={() => sendText(prompt)}
              disabled={!prompt.trim()}
              aria-label="Send"
              type="button"
            >
              <PaperPlaneTiltIcon size={15} weight="fill" />
            </button>
          </div>
        </div>

        <div className="agent-view__examples">
          <p className="agent-view__examples-label">Try asking</p>
          {EXAMPLES.map(example => (
            <button
              key={example}
              className="agent-view__example"
              onClick={() => sendText(example)}
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
