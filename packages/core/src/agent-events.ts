// Shared SSE event types — used by server (chat-routes.ts) and client
// (AgentView.tsx). Having them in core means the compiler checks the contract
// on both sides. Blok C — docs/feature/35.agent-orchestrator/spec.md §3
export type AgentEventType = 'token' | 'tool' | 'file' | 'patch' | 'notice' | 'error' | 'done'

export interface TokenEvent  { type: 'token';  text: string }
export interface ToolEvent   { type: 'tool';   name: string; status: 'start' | 'done' }
export interface FileEvent   { type: 'file';   path: string }
export interface PatchEvent  { type: 'patch';  nodeId: string }
export interface NoticeEvent { type: 'notice'; text: string }
export interface ErrorEvent  { type: 'error';  message: string }
export interface DoneEvent   { type: 'done' }

export type AgentEvent =
  | TokenEvent
  | ToolEvent
  | FileEvent
  | PatchEvent
  | NoticeEvent
  | ErrorEvent
  | DoneEvent
