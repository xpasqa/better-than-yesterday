// Ambient type shim for 'openai' — replaced when npm install runs in deployment.
// docs/feature/2.backend/3.agent/spec.md §3
declare module 'openai' {
  export default class OpenAI {
    constructor(opts: { baseURL: string; apiKey: string })
    chat: {
      completions: {
        stream(params: unknown): AsyncIterable<unknown> & {
          finalMessage(): Promise<{
            choices: Array<{
              message: {
                role: string
                content: string | null
                tool_calls?: Array<{
                  id: string
                  function: { name: string; arguments: string }
                }>
              }
              finish_reason: string
            }>
          }>
        }
      }
    }
  }
}

declare module 'openai/resources/chat/completions' {
  export interface ChatCompletionTool {
    type: 'function'
    function: {
      name: string
      description?: string
      parameters?: Record<string, unknown>
    }
  }

  export interface ChatCompletionMessageParam {
    role: 'system' | 'user' | 'assistant' | 'tool'
    content: string | null
    tool_calls?: Array<{
      id: string
      type: 'function'
      function: { name: string; arguments: string }
    }>
    tool_call_id?: string
    name?: string
  }
}
