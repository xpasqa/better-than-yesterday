import { useEffect, useRef } from 'react'
import { PaperPlaneTiltIcon, PlusIcon } from '@phosphor-icons/react'
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
        <div className="agent-chat__inner">
          <div className="agent-chat__header">
            <h1 className="agent-chat__title">Agent</h1>
            <button className="agent-chat__new" onClick={onBack} type="button">
              <PlusIcon size={14} weight="bold" />
              New task
            </button>
          </div>

          {messages.map(m => (
            <div key={m.id} className="agent-chat__turn">
              <div className="agent-chat__turn-head">
                <span className="agent-chat__who">{m.role === 'user' ? 'You' : 'Agent'}</span>
                <span className="agent-chat__time">{m.time}</span>
              </div>
              <p className="agent-chat__text">{m.content}</p>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </div>

      <div className="agent-chat__composer">
        <div className="agent-chat__inner">
          <div className="agent-chat__input-bar">
            <textarea
              className="agent-chat__input"
              placeholder="Reply"
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
