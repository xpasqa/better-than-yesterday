import { XIcon } from '@phosphor-icons/react'
import type { AgentFile } from '../agent/mockFiles'
import AgentFileTree from './AgentFileTree'
import AgentFileViewer from './AgentFileViewer'
import './AgentFilePanel.css'

interface AgentFilePanelProps {
  files: AgentFile[]
  selectedPath: string | null
  unseenPaths: Set<string>
  onSelect: (path: string) => void
  onClose: () => void
}

export default function AgentFilePanel({
  files, selectedPath, unseenPaths, onSelect, onClose,
}: AgentFilePanelProps) {
  const selectedFile = files.find(f => f.path === selectedPath) ?? null

  return (
    <aside className="agent-file-panel">
      <div className="agent-file-panel__header">
        <span className="agent-file-panel__title">Files</span>
        <span className="agent-file-panel__count">{files.length}</span>
        <button className="agent-file-panel__close" onClick={onClose} type="button" aria-label="Close file panel">
          <XIcon size={15} />
        </button>
      </div>

      <div className="agent-file-panel__tree">
        <AgentFileTree
          files={files}
          selectedPath={selectedPath}
          unseenPaths={unseenPaths}
          onSelect={onSelect}
        />
      </div>

      <div className="agent-file-panel__viewer">
        <AgentFileViewer file={selectedFile} />
      </div>
    </aside>
  )
}
