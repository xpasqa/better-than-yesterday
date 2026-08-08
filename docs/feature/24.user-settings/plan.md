# Settings (timezone) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memberi user cara mengubah timezone-nya — satu-satunya preferensi yang benar-benar menyetir perilaku aplikasi hari ini.

**Architecture:** Satu route `PATCH /api/me` di modul baru `user`, satu fungsi `updateMe` di `auth-api.ts`, satu halaman `SettingsView`. Nol perubahan skema.

**Tech Stack:** Hono, Drizzle, Zod, React, TypeScript.

## Global Constraints

- Bentuk respons dicocokkan ke `AuthUser` di `apps/web/src/store/auth-api.ts`, **bukan** ke nama kolom DB (CLAUDE.md).
- Preferensi lewat `/api/me`, **tidak** lewat `/api/sync` — `app_user` bukan entitas ber-`seq`.
- **Jangan tambahkan kontrol untuk `language`, `week_start`, atau `default_remind_time`.** Ketiganya tidak dibaca di mana pun; UI-nya akan jadi kenop tanpa kabel. Lihat spec §2 dan issue [#74](https://github.com/xpasqa/better-than-yesterday/issues/74).
- Timezone tidak sah ditolak 400 — bukan disimpan diam-diam.
- `npm run verify` hijau.

---

### Task 1: `PATCH /api/me`

**Files:**
- Create: `apps/api/src/modules/user/routes.ts`
- Modify: app utama tempat route didaftarkan (ikuti pola modul `auth`/`sync`)
- Modify: `apps/api/src/modules/auth/routes.ts:82` — **tidak berubah bentuknya**, dipakai sebagai acuan

**Interfaces:**
- Produces: `PATCH /api/me` menerima `{ timezone?: string }`, mengembalikan `{ user: { id, email, name, timezone } }` — bentuk yang **persis sama** dengan `GET /api/me`, supaya klien memakai satu penangan untuk keduanya

- [ ] **Step 1: Tulis route**

```ts
import { Hono } from 'hono'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../../db/client.ts'
import { appUser } from '../../db/schema/user.ts'

const prefsSchema = z.object({
  // A bogus timezone makes localDate() return the wrong day SILENTLY — the
  // kind of bug that surfaces weeks later. Reject it at the door.
  timezone: z
    .string()
    .refine((tz) => Intl.supportedValuesOf('timeZone').includes(tz), { message: 'unknown timezone' })
    .optional(),
})

export const userRoutes = new Hono()

userRoutes.patch('/me', async (c) => {
  const session = c.get('session') // ikuti pola middleware sesi yang dipakai modul lain
  if (!session) return c.json({ error: 'unauthorized' }, 401)

  const parsed = prefsSchema.safeParse(await c.req.json().catch(() => ({})))
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'invalid' }, 400)

  // An empty body is not an error — it just writes nothing. Rejecting it
  // would only add a branch that has to be tested.
  if (Object.keys(parsed.data).length > 0) {
    await db.update(appUser).set(parsed.data).where(eq(appUser.id, session.userId))
  }

  const [user] = await db.select().from(appUser).where(eq(appUser.id, session.userId))
  if (!user) return c.json({ error: 'not found' }, 404)
  return c.json({ user: { id: user.id, email: user.email, name: user.name, timezone: user.timezone } })
})
```

> Cek dulu bagaimana modul lain mengambil sesi (`c.get('session')` vs
> middleware lain) dan **ikuti polanya**, jangan bikin cara ketiga.

- [ ] **Step 2: Daftarkan route**

Ikuti cara modul `auth` dan `sync` didaftarkan di app utama. Prefiksnya harus
menghasilkan `PATCH /api/me`, sejajar dengan `GET /api/me` yang sudah ada.

- [ ] **Step 3: Verifikasi manual**

```bash
docker compose up -d api
# ganti <cookie> dengan cookie sesi dari browser
curl -i -X PATCH http://localhost:3101/api/me -H 'Content-Type: application/json' \
  -b '<cookie>' -d '{"timezone":"Asia/Makassar"}'
curl -i -X PATCH http://localhost:3101/api/me -H 'Content-Type: application/json' \
  -b '<cookie>' -d '{"timezone":"Mars/Olympus"}'   # harus 400
curl -i -X PATCH http://localhost:3101/api/me -H 'Content-Type: application/json' \
  -d '{"timezone":"UTC"}'                          # tanpa cookie, harus 401
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src
git commit -m "feat(api): PATCH /api/me to update user timezone"
```

---

### Task 2: Halaman Settings

**Files:**
- Modify: `apps/web/src/store/auth-api.ts`
- Create: `apps/web/src/components/SettingsView.tsx`
- Modify: `apps/web/src/types/index.ts` (tambah `'settings'` ke `ViewType`)
- Modify: `apps/web/src/routes.ts` (tambah `'settings'` ke `PLAIN_VIEWS`)
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: `PATCH /api/me` dari Task 1
- Produces: `updateMe(prefs: { timezone?: string }): Promise<AuthUser>`

- [ ] **Step 1: `updateMe` di `auth-api.ts`**

Ikuti bentuk `fetchMe` yang sudah ada di file itu — `credentials: 'include'`,
`parseJson`, dan penanganan error yang sama.

```ts
export async function updateMe(prefs: { timezone?: string }): Promise<AuthUser> {
  const res = await fetch('/api/me', {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prefs),
  })
  const data = (await parseJson(res)) as { user?: AuthUser; error?: string } | null
  if (!res.ok) throw new Error(data?.error ?? 'Gagal menyimpan')
  if (!data?.user) throw new Error('Respons tanpa user')
  return data.user
}
```

- [ ] **Step 2: `SettingsView.tsx`**

```tsx
import { useState } from 'react'
import { updateMe, type AuthUser } from '../store/auth-api'
import SyncStatusBadge from './SyncStatusBadge'
import './RealView.css'

interface SettingsViewProps {
  user: AuthUser
  onUserChange: (user: AuthUser) => void
}

const TIMEZONES = Intl.supportedValuesOf('timeZone')

function SettingsView({ user, onUserChange }: SettingsViewProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleTimezone(timezone: string) {
    setSaving(true)
    setError(null)
    try {
      onUserChange(await updateMe({ timezone }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="real-view">
      <div className="real-view__inner">
        <div className="real-view__header">
          <h1>Settings</h1>
          <p className="real-view__subtitle"><SyncStatusBadge /></p>
        </div>

        <label className="settings__field">
          <span>Timezone</span>
          <select
            value={user.timezone ?? 'Asia/Jakarta'}
            disabled={saving}
            onChange={(e) => void handleTimezone(e.target.value)}
          >
            {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
          </select>
          <small>Menentukan hari mana yang dihitung sebagai "hari ini".</small>
        </label>

        {error && <p className="settings__error">{error}</p>}

        <div className="settings__readonly">
          <p>{user.name}</p>
          <p>{user.email}</p>
        </div>
      </div>
    </main>
  )
}

export default SettingsView
```

- [ ] **Step 3: Sambungkan di `App.tsx`**

Tambah `'settings'` ke `ViewType` dan `PLAIN_VIEWS`, lalu cabang render baru.

**`App` harus mengoper `onUserChange` yang benar-benar memperbarui state
`user`-nya.** Ini bagian yang paling gampang salah di seluruh fitur: kalau
`AuthUser` di state tidak ikut berubah, mengubah timezone tidak memindahkan
apa pun sampai reload — dan itu terbaca sebagai "tombolnya rusak", bukan
"perlu reload".

Tambahkan tautan "Settings" di menu profil yang sudah ada, tempat orang
mencarinya.

- [ ] **Step 4: Gaya**

```css
.settings__field { display: flex; flex-direction: column; gap: 4px; max-width: 320px; margin-bottom: 20px; }
.settings__field small { color: var(--text-tertiary); font-size: 12px; }
.settings__error { color: var(--priority-p1); font-size: 13px; }
.settings__readonly { color: var(--text-tertiary); font-size: 13px; border-top: 1px solid var(--border); padding-top: 12px; }
```

- [ ] **Step 5: Verifikasi**

```bash
npm run verify
```

Di browser: buka `/settings`, ubah timezone ke sesuatu yang jauh
(`Pacific/Auckland`), lalu buka Today **tanpa reload** — task yang tadinya
hari ini harus berpindah. Reload, pilihannya bertahan.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): settings page with timezone picker"
```
