import { useEffect, useRef } from 'react'
import { ArrowLeftIcon, PaperPlaneTiltIcon, SparkleIcon } from '@phosphor-icons/react'
import type { ChatMessage } from './AgentView'
import './AgentChat.css'

interface AgentChatProps {
  messages: ChatMessage[]
  prompt: string
  onPromptChange: (value: string) => void
  onSend: () => void
  onBack: () => void
}

export default function AgentChat({ messages, prompt, onPromptChange, onSend, onBack }: AgentChatProps) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  return (
    <main className="agent-chat">
      <div className="agent-chat__thread">
        <div className="agent-chat__thread-inner">
          <button className="agent-chat__back" onClick={onBack} type="button">
            <ArrowLeftIcon size={14} />
            New task
          </button>

          {messages.map(m => (
            m.role === 'user' ? (
              <div key={m.id} className="agent-chat__message agent-chat__message--user">
                <p>{m.content}</p>
                <span className="agent-chat__meta">You · {m.time}</span>
              </div>
            ) : (
              <div key={m.id} className="agent-chat__message agent-chat__message--agent">
                <div className="agent-chat__agent-header">
                  <span className="agent-chat__avatar">
                    <SparkleIcon size={13} weight="fill" />
                  </span>
                  <span className="agent-chat__agent-name">Agent</span>
                  <span className="agent-chat__meta">{m.time}</span>
                </div>
                <p>{m.content}</p>
              </div>
            )
          ))}
          <div ref={endRef} />
        </div>
      </div>

      <div className="agent-chat__composer">
        <div className="agent-chat__composer-inner">
          <div className="agent-chat__input-bar">
            <textarea
              className="agent-chat__input"
              placeholder="Reply…"
              value={prompt}
              onChange={e => onPromptChange(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend() }
              }}
              rows={1}
            />
            <button
              className="agent-chat__send-btn"
              onClick={onSend}
              disabled={!prompt.trim()}
              aria-label="Send"
              type="button"
            >
              <PaperPlaneTiltIcon size={15} weight="fill" />
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
