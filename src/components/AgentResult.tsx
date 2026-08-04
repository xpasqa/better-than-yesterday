import {
  ArrowLeftIcon, CheckCircleIcon, CheckIcon, FileCssIcon, SparkleIcon,
} from '@phosphor-icons/react'
import './AgentResult.css'

interface AgentResultProps {
  prompt: string
  time: string
  onBack: () => void
}

const steps = [
  'Read the affected component and its stylesheet',
  'Reworked the layout so it holds up at wide viewports',
  'Verified there are no regressions at common breakpoints',
]

const diffLines = [
  { type: 'ctx', text: '.dashboard {' },
  { type: 'ctx', text: '  display: grid;' },
  { type: 'del', text: '  grid-template-columns: 1fr 320px;' },
  { type: 'add', text: '  grid-template-columns: minmax(0, 1fr) 320px;' },
  { type: 'add', text: '  gap: 24px;' },
  { type: 'ctx', text: '}' },
] as const

export default function AgentResult({ prompt, time, onBack }: AgentResultProps) {
  return (
    <main className="agent-result">
      <div className="agent-result__inner">
        <button className="agent-result__back" onClick={onBack} type="button">
          <ArrowLeftIcon size={14} />
          New task
        </button>

        <div className="agent-result__message agent-result__message--user">
          <p>{prompt}</p>
          <span className="agent-result__meta">You · {time}</span>
        </div>

        <div className="agent-result__response">
          <div className="agent-result__response-header">
            <span className="agent-result__avatar">
              <SparkleIcon size={14} weight="fill" />
            </span>
            <span className="agent-result__response-name">Agent</span>
            <span className="agent-result__complete-pill">
              <CheckCircleIcon size={12} weight="fill" />
              Task complete
            </span>
            <span className="agent-result__meta">{time}</span>
          </div>

          <p className="agent-result__summary">
            This is a demo response — nothing here is wired to a real agent.
            In a working version, this is where a summary of the actual
            change would go.
          </p>

          <ul className="agent-result__checklist">
            {steps.map(step => (
              <li key={step}>
                <CheckIcon size={13} weight="bold" />
                {step}
              </li>
            ))}
          </ul>

          <div className="agent-result__diff-card">
            <div className="agent-result__diff-header">
              <FileCssIcon size={16} />
              <span className="agent-result__diff-filename">styles.css</span>
              <span className="agent-result__diff-lang">CSS</span>
              <span className="agent-result__diff-stat agent-result__diff-stat--add">+2</span>
              <span className="agent-result__diff-stat agent-result__diff-stat--del">-1</span>
            </div>
            <pre className="agent-result__diff-body">
              {diffLines.map((line, i) => (
                <div key={i} className={`agent-result__diff-line agent-result__diff-line--${line.type}`}>
                  <span className="agent-result__diff-marker">
                    {line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}
                  </span>
                  {line.text}
                </div>
              ))}
            </pre>
          </div>

          <div className="agent-result__actions">
            <button
              className="agent-result__reject-btn"
              disabled
              title="Demo only — not wired to a real agent"
              type="button"
            >
              Reject
            </button>
            <button
              className="agent-result__apply-btn"
              disabled
              title="Demo only — not wired to a real agent"
              type="button"
            >
              Apply changes
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
