// Tool definitions for both agents.
// docs/feature/35.agent-orchestrator/spec.md §7.3 (workspace) and §8.4 (files)
//
// The workspace set is deliberately as wide as the UI: an orchestrator that
// can only list and add cannot say "project X is two weeks behind, pull two of
// its tasks into today". Every name here matches a case in tool-executor.ts —
// a mismatch used to be invisible, which is how `create_task` ended up watched
// for while the tool was actually called `add_task`.
import type { ChatCompletionTool } from 'openai/resources/chat/completions'

function fn(
  name: string,
  description: string,
  properties: Record<string, unknown> = {},
  required: string[] = [],
): ChatCompletionTool {
  return { type: 'function', function: { name, description, parameters: { type: 'object', properties, required } } }
}

const str = (description: string) => ({ type: 'string', description })
const num = (description: string) => ({ type: 'number', description })
const bool = (description: string) => ({ type: 'boolean', description })

/** Fields shared by create_task and update_task. */
const taskFields = {
  dueDate: str("Due date 'YYYY-MM-DD', or null to clear"),
  dueTime: str("Time of day 'HH:MM' — requires a due date. Used for time-blocking"),
  durationMin: num('Minutes the task should take — the other half of time-blocking'),
  priority: { type: 'number', enum: [1, 2, 3], description: '1 = highest. null clears it' },
  note: str('Longer description'),
  tags: { type: 'array', items: { type: 'string' }, description: 'Tag names (not ids)' },
  recurrence: str("Natural-language repeat, e.g. 'every monday'. Requires a due date"),
}

export const FILE_TOOLS: ChatCompletionTool[] = [
  fn('list_files', 'List markdown documents. The manifest is already in your prompt; use this to refresh it.'),
  fn('read_file', 'Read a document in full.', { path: str('Slash-separated path ending in .md') }, ['path']),
  fn('write_file', 'Create or overwrite a markdown document.', {
    path: str('Slash-separated path ending in .md'),
    content: str('Full file content'),
  }, ['path', 'content']),
  fn('append_file', 'Append to a document, creating it when absent. Prefer write_file for memory files.', {
    path: str('Slash-separated path ending in .md'),
    content: str('Text to append'),
  }, ['path', 'content']),
  fn('delete_file', 'Soft-delete a document. Returns its contents so the delete can be undone.', {
    path: str('Slash-separated path'),
  }, ['path']),
]

export const TASK_TOOLS: ChatCompletionTool[] = [
  fn('list_workspace', 'Areas, projects and sections with open/overdue counts. Already in your prompt; use this to refresh after changes.'),

  fn('list_tasks', 'List tasks in one of the standard views. Same definitions the UI uses.', {
    view: {
      type: 'string',
      enum: ['today', 'upcoming', 'anytime', 'someday', 'inbox', 'logbook', 'project'],
      description: "Which view. 'project' requires projectId",
    },
    projectId: str("Required when view='project'"),
    tag: str('Only tasks carrying this tag name'),
    includeCompleted: bool('Include completed tasks. Default false'),
    limit: num('Max rows, default 50, cap 100'),
  }, ['view']),

  fn('search_tasks', 'Full-text search across task titles and notes.', {
    query: str('Search terms'),
    limit: num('Max rows, default 25, cap 50'),
  }, ['query']),

  fn('get_task', 'Full detail for one task: subtasks, tags, reminders, recurrence.', {
    taskId: str('Task id'),
  }, ['taskId']),

  fn('create_task',
    "Create a task. `text` accepts the same quick-add syntax as the UI: #project, @tag, 'tomorrow 9am', p1. Explicit fields win over anything parsed from the text.",
    {
      text: str('Task title, may contain quick-add syntax'),
      projectId: str('Project or section to file it under'),
      parentId: str('Parent task id — makes this a subtask'),
      ...taskFields,
    }, ['text']),

  fn('update_task', 'Change fields on a task. Only pass what should change. This is also the time-blocking tool: set dueTime and durationMin.', {
    taskId: str('Task id'),
    content: str('New title'),
    projectId: str('Move to this project or section'),
    ...taskFields,
  }, ['taskId']),

  fn('complete_task',
    'Mark a task done, or reopen it. Use this rather than update_task: a repeating task advances to its next occurrence instead of closing.',
    { taskId: str('Task id'), undo: bool('true reopens the task') }, ['taskId']),

  fn('delete_task', 'Delete a task. Returns the full row so the delete can be undone.', {
    taskId: str('Task id'),
  }, ['taskId']),

  fn('move_task', 'Reparent or reorder a task — the same operation as dragging in the UI.', {
    taskId: str('Task id'),
    parentId: str('New parent (project, section, or task). Omit to keep the current one'),
    beforeTaskId: str('Place directly above this sibling. Omit to place last'),
  }, ['taskId']),

  fn('manage_project', 'Create, rename, move between areas, archive, or delete a project.', {
    action: { type: 'string', enum: ['create', 'rename', 'move', 'archive', 'delete'], description: 'What to do' },
    projectId: str('Required for everything except create'),
    name: str('Name, for create and rename'),
    areaId: str('Target area, for create and move'),
    color: str('Project colour'),
  }, ['action']),

  fn('manage_section', 'Create, rename, or delete a section inside a project. Deleting re-parents its tasks rather than orphaning them.', {
    action: { type: 'string', enum: ['create', 'rename', 'delete'], description: 'What to do' },
    projectId: str('Project the section belongs to'),
    sectionId: str('Required for rename and delete'),
    name: str('Name, for create and rename'),
  }, ['action', 'projectId']),

  fn('manage_tag', 'Create, rename, or delete a tag. Renaming applies everywhere without rewriting tasks.', {
    action: { type: 'string', enum: ['create', 'rename', 'delete'], description: 'What to do' },
    tagId: str('Required for rename and delete'),
    name: str('Name, for create and rename'),
    color: str('Tag colour'),
  }, ['action']),

  fn('set_reminder', 'Attach or remove a reminder on a task.', {
    taskId: str('Task id'),
    kind: { type: 'string', enum: ['absolute', 'relative'], description: 'Fixed time, or an offset before the due time' },
    remindAt: str("ISO datetime, for kind='absolute'"),
    offsetMin: num("Minutes before the due time, for kind='relative'"),
    remove: bool('true removes existing reminders instead'),
  }, ['taskId']),
]

export const MEMORY_TOOLS: ChatCompletionTool[] = [
  fn('compact_memory', 'Replace SESSION.md with a condensed version. Keep it under 8000 characters.', {
    content: str('New SESSION.md content'),
  }, ['content']),
]

export const ALL_TOOLS: ChatCompletionTool[] = [...FILE_TOOLS, ...TASK_TOOLS, ...MEMORY_TOOLS]

/** Names the executor must handle — asserted by a test so the two cannot drift. */
export const ALL_TOOL_NAMES: string[] = ALL_TOOLS.map(t => t.function.name)
