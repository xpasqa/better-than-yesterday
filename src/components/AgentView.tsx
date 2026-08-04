import { useState } from 'react'
import {
  CaretDownIcon, MicrophoneIcon, PaperPlaneTiltIcon, PlusIcon, SparkleIcon, WaveformIcon,
} from '@phosphor-icons/react'
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

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour >= 0 && hour < 5) return `Up late, ${USER_NAME}?`
  if (hour < 12) return `Good morning, ${USER_NAME}`
  if (hour < 18) return `Good afternoon, ${USER_NAME}`
  if (hour < 22) return `Good evening, ${USER_NAME}`
  return `Up late, ${USER_NAME}?`
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

  const send = () => {
    const trimmed = prompt.trim()
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
        onSend={send}
        onBack={() => { setMessages([]); setPrompt('') }}
      />
    )
  }

  return (
    <main className="agent-view">
      <div className="agent-view__center">
        <h1 className="agent-view__greeting">
          <SparkleIcon size={28} weight="fill" className="agent-view__greeting-icon" />
          {getGreeting()}
        </h1>

        <div className="agent-view__prompt-card">
          <textarea
            className="agent-view__prompt-input"
            placeholder="How can I help you today?"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
            }}
            rows={1}
            autoFocus
          />

          <div className="agent-view__toolbar">
            <button
              className="agent-view__tool-btn"
              disabled
              title="Demo only — not wired to a real agent"
              aria-label="Add attachment"
              type="button"
            >
              <PlusIcon size={16} />
            </button>

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

            <span className="agent-view__toolbar-spacer" />

            <button
              className="agent-view__model-select"
              disabled
              title="Demo only — not wired to a real agent"
              type="button"
            >
              Agent <span className="agent-view__model-tier">High</span>
              <CaretDownIcon size={11} weight="bold" />
            </button>

            <button
              className="agent-view__tool-btn"
              disabled
              title="Demo only — not wired to a real agent"
              aria-label="Voice input"
              type="button"
            >
              <MicrophoneIcon size={16} />
            </button>

            <button
              className="agent-view__submit-btn"
              onClick={send}
              disabled={!prompt.trim()}
              aria-label="Run"
              type="button"
            >
              {prompt.trim() ? <PaperPlaneTiltIcon size={15} weight="fill" /> : <WaveformIcon size={16} />}
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
