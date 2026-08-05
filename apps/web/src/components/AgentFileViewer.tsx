import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CheckIcon, CopyIcon, DownloadSimpleIcon } from '@phosphor-icons/react'
import type { AgentFile } from '../agent/mockFiles'
import './AgentFileViewer.css'

interface AgentFileViewerProps {
  file: AgentFile | null
}

type ViewMode = 'preview' | 'code'

export default function AgentFileViewer({ file }: AgentFileViewerProps) {
  const [mode, setMode] = useState<ViewMode>('preview')
  const [copied, setCopied] = useState(false)

  if (!file) {
    return (
      <div className="agent-file-viewer agent-file-viewer--empty">
        <p>Select a file to preview it</p>
      </div>
    )
  }

  const fileName = file.path.split('/').pop() ?? file.path

  const handleCopy = async () => {
    await navigator.clipboard.writeText(file.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleDownload = () => {
    const blob = new Blob([file.content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="agent-file-viewer">
      <div className="agent-file-viewer__toolbar">
        <span className="agent-file-viewer__name">{fileName}</span>
        <div className="agent-file-viewer__mode-toggle">
          <button
            className={`agent-file-viewer__mode-btn ${mode === 'preview' ? 'agent-file-viewer__mode-btn--active' : ''}`}
            onClick={() => setMode('preview')}
            type="button"
          >
            Preview
          </button>
          <button
            className={`agent-file-viewer__mode-btn ${mode === 'code' ? 'agent-file-viewer__mode-btn--active' : ''}`}
            onClick={() => setMode('code')}
            type="button"
          >
            Code
          </button>
        </div>
        <button className="agent-file-viewer__icon-btn" onClick={handleCopy} type="button" aria-label="Copy">
          {copied ? <CheckIcon size={14} weight="bold" /> : <CopyIcon size={14} />}
        </button>
        <button className="agent-file-viewer__icon-btn" onClick={handleDownload} type="button" aria-label="Download">
          <DownloadSimpleIcon size={14} />
        </button>
      </div>

      <div className="agent-file-viewer__body">
        {mode === 'preview' ? (
          <div className="agent-file-viewer__markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{file.content}</ReactMarkdown>
          </div>
        ) : (
          <pre className="agent-file-viewer__code">{file.content}</pre>
        )}
      </div>
    </div>
  )
}
