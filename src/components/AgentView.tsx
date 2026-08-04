import { useRef, useState } from 'react'
import {
  ArrowRightIcon, ArrowsClockwiseIcon, BookOpenIcon, BracketsCurlyIcon,
  BugIcon, CaretRightIcon, PaperPlaneTiltIcon, SparkleIcon,
} from '@phosphor-icons/react'
import AgentResult from './AgentResult'
import './AgentView.css'

interface Category {
  id: string
  icon: typeof BugIcon
  title: string
  description: string
  example: string
}

const categories: Category[] = [
  {
    id: 'build-apis',
    icon: BracketsCurlyIcon,
    title: 'Build APIs',
    description: 'Design typed REST endpoints with validation and auth.',
    example: 'Add a paginated GET /projects endpoint with validation',
  },
  {
    id: 'fix-bugs',
    icon: BugIcon,
    title: 'Fix Bugs',
    description: 'Trace errors, find root causes, apply safe fixes.',
    example: 'The sidebar collapse button stops working after a resize',
  },
  {
    id: 'refactor-code',
    icon: ArrowsClockwiseIcon,
    title: 'Refactor Code',
    description: 'Improve structure without changing behavior.',
    example: 'Split TaskItem into smaller, testable pieces',
  },
  {
    id: 'explain-concepts',
    icon: BookOpenIcon,
    title: 'Explain Concepts',
    description: 'Understand code, patterns, and frameworks.',
    example: 'Explain how this app manages task state',
  },
]

const capabilities = ['Plans the work', 'Writes the code', 'Shows every diff']

export default function AgentView() {
  const [prompt, setPrompt] = useState('')
  const [submitted, setSubmitted] = useState<{ prompt: string; time: string } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const applyExample = (example: string) => {
    setPrompt(example)
    textareaRef.current?.focus()
  }

  const submit = () => {
    const trimmed = prompt.trim()
    if (!trimmed) return
    setSubmitted({
      prompt: trimmed,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    })
  }

  if (submitted) {
    return (
      <AgentResult
        prompt={submitted.prompt}
        time={submitted.time}
        onBack={() => { setSubmitted(null); setPrompt('') }}
      />
    )
  }

  return (
    <main className="agent-view">
      <div className="agent-view__inner">
        <span className="agent-view__badge">
          <SparkleIcon size={12} weight="fill" />
          Agent
        </span>

        <h1 className="agent-view__headline">
          What should we <span className="agent-view__headline-accent">build today?</span>
        </h1>

        <div className="agent-view__capabilities">
          {capabilities.map((label, i) => (
            <span key={label} className="agent-view__capability-group">
              <span className="agent-view__chip">{label}</span>
              {i < capabilities.length - 1 && (
                <CaretRightIcon size={12} className="agent-view__capability-sep" />
              )}
            </span>
          ))}
        </div>

        <div className="agent-view__prompt-card">
          <textarea
            ref={textareaRef}
            className="agent-view__prompt-input"
            placeholder="e.g. Add a dark mode toggle to the sidebar…"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
            }}
            rows={1}
          />
          <button
            className="agent-view__submit-btn"
            onClick={submit}
            disabled={!prompt.trim()}
            aria-label="Run"
            type="button"
          >
            <PaperPlaneTiltIcon size={16} weight="fill" />
          </button>
        </div>

        <div className="agent-view__grid">
          {categories.map(cat => {
            const Icon = cat.icon
            return (
              <button
                key={cat.id}
                className="agent-view__card"
                onClick={() => applyExample(cat.example)}
                type="button"
              >
                <span className="agent-view__card-icon">
                  <Icon size={18} />
                </span>
                <span className="agent-view__card-body">
                  <span className="agent-view__card-title">{cat.title}</span>
                  <span className="agent-view__card-description">{cat.description}</span>
                </span>
                <ArrowRightIcon size={16} className="agent-view__card-arrow" />
              </button>
            )
          })}
        </div>
      </div>
    </main>
  )
}
