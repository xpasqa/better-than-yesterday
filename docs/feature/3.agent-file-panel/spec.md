# Agent File Panel — Spec

## Context

The Agent view currently renders a single-column chat (`AgentView` → `AgentChat`).
Nothing the agent "produces" is visible anywhere. This feature adds a right-hand
panel to the chat showing a folder tree of files the agent created during the
conversation, plus a viewer that renders the selected markdown file.

Reference: the artifact panel in Claude — chat on the left, a file card inside
the conversation, and a rendered document on the right with Preview/Code toggle,
Copy, and Download.

Like Storage, Outline, Mail, and the existing Agent view, this is a **UI demo**:
no backend, no LLM, no filesystem. Files are mock content created on a script.

## Data model

```ts
export interface AgentFile {
  path: string     // 'docs/riset-pasar.md' — flat, slash-separated
  content: string  // raw markdown
  time: string     // creation time, same format as ChatMessage.time
}
```

Files are stored as a **flat array in creation order**. The folder tree is
derived at render time by splitting each path on `/`. There is no separate tree
state to keep in sync — creating a file is a single push.

`ChatMessage` becomes a discriminated union:

```ts
export type ChatMessage =
  | { id: string; role: 'user' | 'agent'; kind: 'text'; content: string; time: string }
  | { id: string; role: 'agent'; kind: 'file'; path: string; time: string }
```

A reply that creates a file produces **two** messages: the text turn, then the
file card.

## State

All state stays local to `AgentView.tsx`, matching the precedent set by every
other view (nothing lifted to `App.tsx`):

| State | Purpose |
|---|---|
| `messages: ChatMessage[]` | existing |
| `files: AgentFile[]` | files created so far, creation order |
| `selectedPath: string \| null` | file open in the viewer |
| `panelOpen: boolean` | panel visibility |
| `seenPaths: Set<string>` | files already clicked (drives the "new" dot) |

"New task" (`onBack`) resets all of it, same as `messages` today. Nothing
persists across reloads.

## Components

| File | Responsibility |
|---|---|
| `src/agent/mockFiles.ts` | The 5 mock files (path + markdown content) and the creation script |
| `src/components/AgentFilePanel.tsx` + `.css` | Panel shell: header, tree region, divider, viewer region |
| `src/components/AgentFileTree.tsx` | Recursive folder/file tree built from the flat path list |
| `src/components/AgentFileViewer.tsx` | Toolbar (name, Preview/Code, Copy, Download) + rendered markdown |

`AgentChat.tsx` changes from a column to a **row**: `.agent-chat__main`
(thread + composer, keeping the existing 800px `--editor-max-width` column) and
`<AgentFilePanel>` beside it. File logic lives in the new components; `AgentChat`
only passes props through.

## Panel layout

- Width **420px**, `border-left: 1px solid var(--divider-primary)`, full height.
- **Header** — "Files" plus the file count, close `X` button on the right.
- **Tree** — top region, `max-height: 40%`, scrolls independently. Folders
  collapse/expand, indent 14px per level, folder and `FileMd` icons from
  `@phosphor-icons/react`. The selected file is highlighted with the brand red
  tint already used for active states. A file created but never opened shows a
  small red dot until it is clicked.
- **Viewer** — bottom region, fills remaining height, scrolls independently.
  Toolbar: file name, a `Preview | Code` segmented toggle, Copy button, Download
  button. Below it, the rendered markdown, or the raw source in a monospace
  block when Code is selected.

Open/close animates `width` and `opacity` over 0.18s, in line with the 0.1–0.15s
transitions used elsewhere in the app.

## Responsive

Below a **1100px** viewport the 800px chat column plus a 420px panel no longer
fit. At that width the panel becomes an overlay: absolutely positioned against
the right edge, full height, with a backdrop that closes it on click. Above
1100px it is an inline third column.

## Markdown rendering

Add `react-markdown` and `remark-gfm` as dependencies. GFM is required because
the mock content includes tables. Styles for headings, tables, lists, inline
code, and code blocks are scoped under the viewer's body class in
`AgentFilePanel.css`, using the existing type and colour tokens.

## Creation script

The tree starts **empty and the panel does not render at all**. Files are created
on a fixed schedule keyed to the agent reply index, so the cadence feels uneven
rather than one-file-per-message. Replies **1, 2, 4, 5, and 7** each create one
file, in this order; every other reply is text only, and once the pool is
exhausted all later replies are text only.

| Reply # | File created |
|---|---|
| 1 | `docs/riset-pasar.md` |
| 2 | `docs/spec-fitur.md` |
| 4 | `notes/rapat-senin.md` |
| 5 | `notes/pertanyaan-terbuka.md` |
| 7 | `README.md` |

Each file's content is real markdown with headings, a table, lists, and a code
block, so the renderer is visibly doing work and the panel never looks empty.

When the **first** file is created the panel slides in automatically and opens
that file. Later files appear in the tree with a new-dot but do not steal the
viewer's current selection.

## Interactions

| Action | Result |
|---|---|
| Agent creates first file | Panel opens, that file is selected |
| Agent creates a later file | Appears in tree with new-dot; selection unchanged |
| Click a file card in the chat | Opens panel, selects that file |
| Click a file in the tree | Selects it, clears its new-dot |
| Click a folder | Toggles collapse |
| Copy | Writes raw markdown to the clipboard, button confirms briefly |
| Download | Creates a Blob and triggers a real `.md` download |
| Close `X` | Panel hides; a button in the chat header reopens it |
| New task | Everything resets, panel unmounts |

Copy and Download are genuinely functional — they need no backend.

## Out of scope

- Editing files from the panel (read-only)
- Search or filter in the tree
- Multiple open files / tabs in the viewer
- Persistence across reloads or across "New task"
- Any real agent, LLM, or filesystem integration
