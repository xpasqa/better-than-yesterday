# Agent View — Design

## Context

New sidebar nav item "Agent", positioned directly below "Outline", showing
a landing page for an AI coding agent — inspired by two reference
screenshots of a product called "Codelytic" the user shared. This is a
UI/UX demo only (matches the precedent set by Storage and Outline): no
real LLM call, no backend, mock/decorative interactivity. Scope is the
landing/hero screen only, not the chat/task-detail view also shown in the
reference — that's a separate, larger piece of work if ever pursued.

Visual language stays identical to the rest of the app (same 800px column,
same tokens, same chip/card conventions already established) — the
reference is inspiration for *what this screen contains*, not for its
look.

## Component

- `src/components/AgentView.tsx` + `.css` — self-contained, matching the
  precedent `OutlineView`/`StorageView` already set: state lives locally
  (just the prompt textarea's value), nothing lifted to `App.tsx`.

## Layout (top to bottom, in the standard 800px column)

1. **Badge**: small pill, `SparkleIcon` + "AGENT" text, uppercase, red
   accent border/text on a tinted background — a scaled-down version of
   the reference's version badge, no "V3"/product-name chrome.
2. **Headline**: "What should we build today?" at a larger size than the
   app's usual 26px view titles (this is a hero, not a list header) — the
   words "build today?" in `--brand-red-idle`, everything else
   `--text-primary`.
3. **Capability row**: "Plans the work → Writes the code → Shows every
   diff" as three chips (same border/radius/padding language as
   `AddTaskForm`'s toolbar chips) joined by small `CaretRightIcon`
   separators.
4. **Prompt box**: a bordered card containing a placeholder textarea
   ("e.g. Add a dark mode toggle to the sidebar…") and a circular red send
   button (`PaperPlaneTiltIcon`, same visual as `AddTaskForm`'s submit).
   The reference's Tools/Context/model-selector row is dropped — those
   imply real backend capability this app doesn't have, and would just be
   inert clutter.
5. **Category grid**: 2×2 cards — Build APIs, Fix Bugs, Refactor Code,
   Explain Concepts. Each: icon (`BracketsCurlyIcon`, `BugIcon`,
   `ArrowsClockwiseIcon`, `BookOpenIcon`) in a tinted rounded square,
   title, one-line description, trailing `ArrowRightIcon`. Clicking a card
   fills the prompt textarea with a canned example string for that
   category and focuses it — the one bit of genuine interactivity on the
   page.

## Send button

Disabled with `title="Demo only — not wired to a real agent"`, matching
the exact precedent already in `AddTaskForm`'s disabled "Attachment"
chip. Typing in the textarea still works normally; only the terminal
submit action is inert, since there's no chat/task view in scope for it
to lead to.

## Routing

- `ViewType` gains `'agent'`.
- `Sidebar.tsx`: new nav item below Outline, `SparkleIcon`, same
  active-state wiring as every other item (monochrome idle, red when
  active).
- `App.tsx`: extends the existing `activeView === 'outline' ? ... :
  activeView === 'storage' ? ... :` ladder with an `'agent'` branch
  rendering `<AgentView />`.

## Out of scope

The chat/task-detail view (plan checklist, code viewer, diff, apply/
reject), any real AI/LLM integration, conversation history, and the
Tools/Context/model-selector controls from the reference.
