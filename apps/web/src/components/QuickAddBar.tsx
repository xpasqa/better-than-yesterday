import { useState, type FormEvent } from 'react'
import { parse } from '@better/core/parse'
import { describeRecurrence } from '@better/core/recurrence'
import { createTaskFromQuickAdd } from '../store/node-actions'

interface QuickAddBarProps {
  timezone: string
  defaultParentId?: string | null
}

/** Formats a YYYY-MM-DD string as "10 Agu", "Today", or "Tomorrow". */
function formatPreviewDate(date: string): string {
  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  if (date === today) return 'Today'
  if (date === tomorrow) return 'Tomorrow'
  const d = new Date(date + 'T00:00:00')
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

/** The quick-add input shared by every real (store-backed) view. */
function QuickAddBar({ timezone, defaultParentId }: QuickAddBarProps) {
  const [value, setValue] = useState('')

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const text = value.trim()
    if (!text) return
    setValue('')
    await createTaskFromQuickAdd(text, { timezone, language: 'id', defaultParentId })
  }

  // Build parse preview — only shown when at least one field is recognised.
  // parse() is pure and fast; calling it on every render is intentional.
  const preview = (() => {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = parse(trimmed, { now: new Date(), timezone, language: 'id' })
    const parts: string[] = []
    if (parsed.dueDate) parts.push(formatPreviewDate(parsed.dueDate))
    if (parsed.priority) parts.push(`P${parsed.priority}`)
    const recLabel = describeRecurrence(parsed.recurrence)
    if (recLabel) parts.push(recLabel)
    return parts.length > 0 ? parts.join(' · ') : null
  })()

  return (
    <form className="real-view__quick-add" onSubmit={(e) => void handleSubmit(e)}>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="beli tiket pesawat besok jam 9 #Travel $penting !1"
        aria-label="Quick add a task"
      />
      <button type="submit">Add</button>
      {preview && (
        <p className="real-view__quick-add-preview" aria-hidden="true">
          {preview}
        </p>
      )}
    </form>
  )
}

export default QuickAddBar
