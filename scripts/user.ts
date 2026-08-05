// Account management CLI — there is no sign-up page on purpose (infra spec
// §4.2). `add` is transactional: the user row plus their seeded Inbox root
// land together, or neither does.
import '@better/api/load-env' // must be the first import — see its own comment
import { eq } from 'drizzle-orm'
import { uuidv7 } from '@better/core/id'
import { between } from '@better/core/rank'
import { db } from '@better/api/db/client'
import { appUser } from '@better/api/db/schema/user'
import { node } from '@better/api/db/schema/node'
import { hashPassword } from '@better/api/modules/auth/password'

const ENTER = new Set(['\n', '\r'])
const CTRL_C = ''
const BACKSPACE = new Set(['', '\b'])

function usage(): never {
  console.error('Usage:')
  console.error('  npm run user -- add <email> [name]')
  console.error('  npm run user -- set-password <email>')
  console.error('  npm run user -- list')
  process.exit(1)
}

/**
 * A password prompt with no framework dependency: raw mode plus manual
 * muting on a real terminal. Scans character-by-character *within* each
 * chunk rather than assuming one keystroke per `data` event — a real TTY
 * in raw mode happens to deliver one byte at a time, but piped input (used
 * by every test here, and by anyone automating this CLI) arrives as a
 * single multi-character chunk, and treating that chunk as "one character"
 * would swallow the trailing newline into the password and then hang
 * forever waiting for a newline that already went by.
 */
async function promptPassword(question: string): Promise<string> {
  process.stdout.write(question)
  return new Promise((resolve) => {
    const stdin = process.stdin
    stdin.resume()
    stdin.setRawMode?.(true)
    let value = ''
    const onData = (buf: Buffer) => {
      for (const char of buf.toString('utf8')) {
        if (ENTER.has(char)) {
          stdin.setRawMode?.(false)
          stdin.pause()
          stdin.removeListener('data', onData)
          process.stdout.write('\n')
          resolve(value)
          return
        }
        if (char === CTRL_C) {
          process.stdout.write('\n')
          process.exit(130)
        }
        if (BACKSPACE.has(char)) {
          value = value.slice(0, -1)
          continue
        }
        value += char
      }
    }
    stdin.on('data', onData)
  })
}

async function cmdAdd(email: string, name: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase()
  const password = await promptPassword(`Password for ${normalizedEmail}: `)
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.')
    process.exit(1)
  }
  const passwordHash = await hashPassword(password)

  await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(appUser)
      .values({ id: uuidv7(), email: normalizedEmail, name, passwordHash })
      .returning()
    if (!user) throw new Error('insert returned no row')

    const now = new Date()
    await tx.insert(node).values({
      id: uuidv7(),
      userId: user.id,
      parentId: null,
      kind: 'project',
      rank: between(null, null),
      content: 'Inbox',
      isInbox: true,
      createdAt: now,
      updatedAt: now,
    })
  })

  console.log(`Created ${normalizedEmail} with a seeded Inbox.`)
}

async function cmdSetPassword(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase()
  const [user] = await db.select().from(appUser).where(eq(appUser.email, normalizedEmail)).limit(1)
  if (!user) {
    console.error(`No user with email ${normalizedEmail}`)
    process.exit(1)
  }
  const password = await promptPassword(`New password for ${normalizedEmail}: `)
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.')
    process.exit(1)
  }
  const passwordHash = await hashPassword(password)
  await db.update(appUser).set({ passwordHash }).where(eq(appUser.id, user.id))
  console.log(`Password updated for ${normalizedEmail}.`)
}

async function cmdList(): Promise<void> {
  const users = await db
    .select({ email: appUser.email, name: appUser.name, createdAt: appUser.createdAt })
    .from(appUser)
  if (users.length === 0) {
    console.log('(no users yet)')
    return
  }
  for (const u of users) {
    console.log(`${u.email}\t${u.name}\t${u.createdAt.toISOString()}`)
  }
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2)
  if (command === 'add') {
    const [email, name = ''] = args
    if (!email) usage()
    await cmdAdd(email, name)
  } else if (command === 'set-password') {
    const [email] = args
    if (!email) usage()
    await cmdSetPassword(email)
  } else if (command === 'list') {
    await cmdList()
  } else {
    usage()
  }
  process.exit(0)
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
