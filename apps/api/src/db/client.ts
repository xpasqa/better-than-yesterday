import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { config } from '../config.ts'
import * as appUser from './schema/user.ts'
import * as node from './schema/node.ts'
import * as tag from './schema/tag.ts'
import * as reminder from './schema/reminder.ts'
import * as notification from './schema/notification.ts'
import * as pushSubscription from './schema/push-subscription.ts'
import * as completion from './schema/completion.ts'
import * as syncSeq from './schema/sync-seq.ts'
import * as aiSettings from './schema/ai-settings.ts'
import * as agentProject from './schema/agent-project.ts'
import * as agentFile from './schema/agent-file.ts'
import * as agentSession from './schema/agent-session.ts'
import * as storage from './schema/storage.ts'

export const schema = {
  ...appUser,
  ...node,
  ...tag,
  ...reminder,
  ...notification,
  ...pushSubscription,
  ...completion,
  ...syncSeq,
  ...aiSettings,
  ...agentProject,
  ...agentFile,
  ...agentSession,
  ...storage,
}

const queryClient = postgres(config.DATABASE_URL)
export const db = drizzle(queryClient, { schema })
export type Db = typeof db
