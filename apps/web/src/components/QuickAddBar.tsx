import { useState, type FormEvent } from 'react'
import { createTaskFromQuickAdd } from '../store/node-actions'

interface QuickAddBarProps {
  timezone: string
  defaultParentId?: string | null
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

  return (
    <form className="real-view__quick-add" onSubmit={(e) => void handleSubmit(e)}>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="beli tiket pesawat besok jam 9 #Travel $penting !1"
        aria-label="Quick add a task"
      />
      <button type="submit">Add</button>
    </form>
  )
}

export default QuickAddBar
