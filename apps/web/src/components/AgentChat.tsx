import { useEffect, useRef } from 'react'
import { FileMdIcon, FolderOpenIcon, PaperPlaneTiltIcon, PlusIcon } from '@phosphor-icons/react'
import type { ChatMessage } from './AgentView'
import type { AgentFile } from '../agent/mockFiles'
import AgentFilePanel from './AgentFilePanel'
import './AgentChat.css'

interface AgentChatProps {
  messages: ChatMessage[]
  prompt: string
  onPromptChange: (value: string) => void
  onSend: () => void
  onBack: () => void
  files: AgentFile[]
  panelOpen: boolean
  selectedPath: string | null
  unseenPaths: Set<string>
  onSelectFile: (path: string) => void
  onOpenPanel: () => void
  onClosePanel: () => void
}

export default function AgentChat({
  messages, prompt, onPromptChange, onSend, onBack,
  files, panelOpen, selectedPath, unseenPaths, onSelectFile, onOpenPanel, onClosePanel,
}: AgentChatProps) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  return (
    <div className="agent-chat-row">
      <main className="agent-chat">
        <div className="agent-chat__thread">
          <div className="agent-chat__inner">
            <div className="agent-chat__header">
              <h1 className="agent-chat__title">Agent</h1>
              <div className="agent-chat__header-actions">
                {files.length > 0 && !panelOpen && (
                  <button className="agent-chat__files-btn" onClick={onOpenPanel} type="button">
                    <FolderOpenIcon size={14} />
                    {files.length} {files.length === 1 ? 'file' : 'files'}
                  </button>
                )}
                <button className="agent-chat__new" onClick={onBack} type="button">
                  <PlusIcon size={14} weight="bold" />
                  New task
                </button>
              </div>
            </div>

            {messages.map(m => {
              if (m.kind === 'file') {
                const file = files.find(f => f.id === m.fileId)
                if (!file) return null
                const fileName = file.path.split('/').pop() ?? file.path
                return (
                  <div key={m.id} className="agent-chat__turn">
                    <div className="agent-chat__turn-head">
                      <span className="agent-chat__who">Agent</span>
                      <span className="agent-chat__time">{m.time}</span>
                    </div>
                    <button
                      className="agent-chat__file-card"
                      onClick={() => { onSelectFile(file.path); onOpenPanel() }}
                      type="button"
                    >
                      <FileMdIcon size={20} className="agent-chat__file-card-icon" />
                      <div className="agent-chat__file-card-text">
                        <span className="agent-chat__file-card-name">{fileName}</span>
                        <span className="agent-chat__file-card-meta">Document · MD</span>
                      </div>
                    </button>
                  </div>
                )
              }
              return (
                <div key={m.id} className="agent-chat__turn">
                  <div className="agent-chat__turn-head">
                    <span className="agent-chat__who">{m.role === 'user' ? 'You' : 'Agent'}</span>
                    <span className="agent-chat__time">{m.time}</span>
                  </div>
                  <p className="agent-chat__text">{m.content}</p>
                </div>
              )
            })}
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

      {panelOpen && (
        <>
          <div className="agent-chat__panel-backdrop" onClick={onClosePanel} />
          <AgentFilePanel
            files={files}
            selectedPath={selectedPath}
            unseenPaths={unseenPaths}
            onSelect={onSelectFile}
            onClose={onClosePanel}
          />
        </>
      )}
    </div>
  )
}
