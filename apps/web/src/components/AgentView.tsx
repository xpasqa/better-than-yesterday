import { useState } from 'react'
import { PaperPlaneTiltIcon } from '@phosphor-icons/react'
import AgentChat from './AgentChat'
import { FILE_CREATION_SCHEDULE, MOCK_FILES } from '../agent/mockFiles'
import type { AgentFile } from '../agent/mockFiles'
import './AgentView.css'

const USER_NAME = 'Pasqa'

export type ChatMessage =
  | { id: string; role: 'user' | 'agent'; kind: 'text'; content: string; time: string }
      | { id: string; role: 'agent'; kind: 'file'; path: string; time: string }

const AGENT_REPLY = 'This is a demo response — nothing here is wired to a real agent. '
  + 'In a working version, this is where an actual answer would go.'

const AGENT_REPLY_WITH_FILE = 'Here\'s what I put together — you can review it in the file panel.'

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
  const [replyCount, setReplyCount] = useState(0)

  const selectFile = (path: string) => {
    setSelectedPath(path)
    setUnseenPaths(prev => {
      if (!prev.has(path)) return prev
      const next = new Set(prev)
      next.delete(path)
      return next
    })
  }

  const sendText = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return

    const nextReplyIndex = replyCount + 1
    const fileToCreate = FILE_CREATION_SCHEDULE[nextReplyIndex]
    const newFile = fileToCreate !== undefined ? MOCK_FILES[fileToCreate] : null

    setMessages(prev => {
      const next: ChatMessage[] = [
        ...prev,
        { id: generateId(), role: 'user', kind: 'text', content: trimmed, time: timeNow() },
        {
          id: generateId(),
          role: 'agent',
          kind: 'text',
          content: newFile ? AGENT_REPLY_WITH_FILE : AGENT_REPLY,
          time: timeNow(),
        },
      ]
      if (newFile) {
        next.push({ id: generateId(), role: 'agent', kind: 'file', path: newFile.path, time: timeNow() })
      }
      return next
    })

    if (newFile) {
      const isFirstFile = files.length === 0
      setFiles(prev => [...prev, newFile])
      setUnseenPaths(prev => new Set(prev).add(newFile.path))
      if (isFirstFile) {
        setPanelOpen(true)
        selectFile(newFile.path)
      }
    }

    setReplyCount(nextReplyIndex)
    setPrompt('')
  }

  if (messages.length > 0) {
    return (
      <AgentChat
        messages={messages}
        prompt={prompt}
        onPromptChange={setPrompt}
        onSend={() => sendText(prompt)}
        onBack={() => {
          setMessages([])
          setPrompt('')
          setFiles([])
          setSelectedPath(null)
          setPanelOpen(false)
          setUnseenPaths(new Set())
          setReplyCount(0)
        }}
        files={files}
        panelOpen={panelOpen}
        selectedPath={selectedPath}
        unseenPaths={unseenPaths}
        onSelectFile={selectFile}
        onOpenPanel={() => setPanelOpen(true)}
        onClosePanel={() => setPanelOpen(false)}
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
