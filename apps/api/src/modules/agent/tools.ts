// Tool definitions for the agent runner.
// docs/feature/2.backend/3.agent/spec.md §6 — 5 file tools + 5 task tools + compact_memory
import type { ChatCompletionTool } from 'openai/resources/chat/completions'

export const FILE_TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'List all markdown files in the current project. Returns a manifest of paths.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the content of a file by its path.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Slash-separated relative path, e.g. docs/riset-pasar.md' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write (create or overwrite) a markdown file at the given path.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Slash-separated relative path, must end in .md' },
          content: { type: 'string', description: 'Full file content in markdown' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'append_file',
      description: 'Append text to an existing file, or create it if it does not exist.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Slash-separated relative path, must end in .md' },
          content: { type: 'string', description: 'Text to append' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_file',
      description: 'Soft-delete a file by path.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Slash-separated relative path' },
        },
        required: ['path'],
      },
    },
  },
]

export const TASK_TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'list_tasks',
      description: 'List open (non-completed, non-deleted) tasks for the current project, ordered by rank.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_task',
      description: 'Get full details of a single task including subtasks.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'UUIDv7 task id' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_task',
      description: 'Add a new task to the current project.',
      parameters: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'Task title, max 2000 chars' },
          note: { type: 'string', description: 'Optional longer description' },
          dueDate: { type: 'string', description: 'ISO date string YYYY-MM-DD, optional' },
          priority: { type: 'number', enum: [1, 2, 3], description: '1=p1, 2=p2, 3=p3. Optional.' },
        },
        required: ['content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_subtask',
      description: 'Add a subtask under an existing task.',
      parameters: {
        type: 'object',
        properties: {
          parentId: { type: 'string', description: 'UUIDv7 id of the parent task' },
          content: { type: 'string', description: 'Subtask title, max 2000 chars' },
        },
        required: ['parentId', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_task',
      description: 'Update fields on an existing task. Only include fields you want to change.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'UUIDv7 task id' },
          content: { type: 'string', description: 'New title' },
          note: { type: 'string', description: 'New note (null to clear)' },
          dueDate: { type: 'string', description: 'New due date (null to clear)' },
          priority: { type: 'number', enum: [1, 2, 3], description: 'New priority (null to clear)' },
          completedAt: { type: 'string', description: 'ISO datetime to mark complete (null to reopen)' },
        },
        required: ['id'],
      },
    },
  },
]

export const MEMORY_TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'compact_memory',
      description:
        'Overwrite SESSION.md with a condensed version. Call this at the end of a long session to keep memory within the 8 000-char limit.',
      parameters: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'New condensed SESSION.md content, max 8 000 chars' },
        },
        required: ['content'],
      },
    },
  },
]

export const ALL_TOOLS: ChatCompletionTool[] = [...FILE_TOOLS, ...TASK_TOOLS, ...MEMORY_TOOLS]
