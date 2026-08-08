# E2E Playwright Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menangkap kelas bug yang lolos dari sembilan review per-task di epic recurring — pelanggaran CHECK yang cuma muncul saat aplikasi sungguhan bicara ke Postgres sungguhan.

**Architecture:** Playwright dengan `webServer` menjalankan API + web; Postgres dari `docker compose` yang sudah ada; user tes dibuat lewat `scripts/user.ts add` yang sudah ada.

**Tech Stack:** Playwright, Chromium, TypeScript.

## Global Constraints

- **`npm run verify` tidak boleh ikut menjalankan e2e.** Verify dipakai tiap task oleh implementer subagent dan harus tetap cepat. E2E adalah perintah tersendiri.
- **Postgres sungguhan, API sungguhan.** Kedua bug recurring adalah pelanggaran CHECK di Postgres; API tiruan akan menerimanya dan tesnya hijau palsu.
- Chromium saja. Tiga browser melipattigakan waktu jalan demi kelas bug yang belum pernah kita alami.
- Selector lewat `getByRole`/`getByLabel`, bukan kelas CSS.
- Tes harus bisa dijalankan **dua kali berturut-turut** tanpa pembersihan manual.

---

### Task 1: Pasang Playwright & helper login

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/fixtures.ts`
- Modify: `package.json`
- Modify: `.gitignore`
- Create: `e2e/README.md`

**Interfaces:**
- Produces: `test` yang sudah membawa sesi login — dipakai Task 2

- [ ] **Step 1: Pasang**

```bash
npm i -D --workspace-root @playwright/test
npx playwright install --with-deps chromium
```

- [ ] **Step 2: `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // one Postgres, shared state — parallel files would race
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'npm run dev -w @better/api',
      port: 3001,
      reuseExistingServer: true,
      env: { PORT: '3001' },
    },
    {
      command: 'npm run dev -w @better/web',
      port: 5173,
      reuseExistingServer: true,
    },
  ],
})
```

> `reuseExistingServer: true` supaya menjalankan tes saat `npm run dev` sudah
> hidup tidak gagal dengan "port sudah dipakai" — kasus yang paling sering
> terjadi saat orang benar-benar memakainya.

- [ ] **Step 3: Helper login**

Tiap tes butuh sesi. `scripts/user.ts add` sudah membuat user **berikut root
Inbox-nya** — persis bootstrap yang dibutuhkan, jadi tidak perlu jalur
pembuatan user kedua.

```ts
import { test as base, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'

// One user per test FILE, not per test: full isolation would be cleaner but
// much slower, and separate files already cannot see each other's data.
export const test = base.extend<{ userEmail: string }>({
  userEmail: async ({ page }, use, testInfo) => {
    const email = `e2e-${testInfo.title.replace(/\W+/g, '-')}-${testInfo.workerIndex}@test.local`
    execFileSync('npm', ['run', 'user', '--', 'add', email, 'e2e-password'], { stdio: 'pipe' })

    await page.goto('/')
    await page.getByLabel(/email/i).fill(email)
    await page.getByLabel(/password/i).fill('e2e-password')
    await page.getByRole('button', { name: /log ?in|masuk/i }).click()
    await expect(page.getByRole('button', { name: /quick add|add/i }).first()).toBeVisible()

    await use(email)
  },
})

export { expect }
```

> **Cek dulu tanda tangan `scripts/user.ts add` yang sebenarnya** — argumen
> dan urutannya mungkin berbeda dari tebakan di atas. Jalankan
> `npm run user -- add --help` atau baca skripnya. Sama untuk label field
> login: sesuaikan dengan yang benar-benar ada di form.
>
> Email memuat `workerIndex` supaya menjalankan tes dua kali berturut-turut
> tidak bentrok dengan user dari putaran sebelumnya. Kalau `user add` menolak
> email yang sudah ada, tambahkan penanganan "sudah ada → lanjut saja".

- [ ] **Step 4: Skrip npm & gitignore**

```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui"
```

**Jangan** sentuh `verify`. Tambahkan ke `.gitignore`:

```
test-results/
playwright-report/
.playwright/
```

- [ ] **Step 5: `e2e/README.md`**

Tulis apa yang harus hidup sebelum menjalankannya: `docker compose up -d
postgres`, variabel lingkungan yang dibutuhkan, dan bahwa tes membuat user
sungguhan di database itu.

- [ ] **Step 6: Verifikasi & commit**

```bash
docker compose up -d postgres
npx playwright test --list   # harus menampilkan test dir tanpa error
git add playwright.config.ts e2e package.json package-lock.json .gitignore
git commit -m "test: install Playwright with a logged-in fixture"
```

---

### Task 2: Dua alur

**Files:**
- Create: `e2e/quick-add.spec.ts`
- Create: `e2e/offline-sync.spec.ts`

**Interfaces:**
- Consumes: `test`/`expect` dari `e2e/fixtures.ts`

- [ ] **Step 1: Alur quick-add → Today → selesai**

Alur ini melewati parser → resolusi project → Dexie → outbox → `POST
/api/sync` → CHECK Postgres → perhitungan view. Itu persis rantai tempat
kedua bug recurring bersembunyi.

```ts
import { test, expect } from './fixtures.ts'

test('quick-add lands in Today with the parsed date, then completes', async ({ page }) => {
  await page.goto('/today')

  const input = page.getByLabel('Quick add a task')
  await input.fill('beli tiket pesawat hari ini jam 9 !1')
  await input.press('Enter')

  const row = page.getByText('beli tiket pesawat')
  await expect(row).toBeVisible()
  await expect(page.getByText('09:00')).toBeVisible()

  // Reload proves it survived the round trip to Postgres, not just Dexie.
  await page.reload()
  await expect(page.getByText('beli tiket pesawat')).toBeVisible()

  await page.getByRole('button', { name: /complete beli tiket pesawat/i }).click()
  await expect(page.getByText('beli tiket pesawat')).toBeHidden()
})

test('a recurring task advances instead of closing', async ({ page }) => {
  await page.goto('/today')

  const input = page.getByLabel('Quick add a task')
  await input.fill('siram tanaman setiap hari')
  await input.press('Enter')

  await expect(page.getByText('siram tanaman')).toBeVisible()
  await page.getByRole('button', { name: /complete siram tanaman/i }).click()

  // The whole point of recurrence: it does not disappear, its date advances.
  await page.reload()
  await expect(page.getByText('siram tanaman')).toBeHidden() // moved to tomorrow
  await page.goto('/upcoming')
  await expect(page.getByText('siram tanaman')).toBeVisible()
})
```

> Tes kedua adalah **yang menutup issue #24** — verifikasi manual recurring
> yang selama ini menahan #23 di Review. Sebutkan itu di pesan commit.
>
> `aria-label` tombol complete mungkin berbeda dari tebakan di atas. Baca
> `TaskRow.tsx` dan pakai yang sebenarnya; kalau tombolnya belum punya
> `aria-label`, **tambahkan** — itu perbaikan aksesibilitas sungguhan, bukan
> akal-akalan demi tes.

- [ ] **Step 2: Alur offline → antre → sync**

```ts
import { test, expect } from './fixtures.ts'

test('a task created offline reaches the server once sync is allowed again', async ({ page, context }) => {
  await page.goto('/today')

  // Block sync at the network layer rather than stopping the container —
  // the test must run without Docker privileges.
  await context.route('**/api/sync', (route) => route.abort())

  const input = page.getByLabel('Quick add a task')
  await input.fill('task saat offline')
  await input.press('Enter')

  // Offline-first: it must be visible immediately, from Dexie.
  await expect(page.getByText('task saat offline')).toBeVisible()

  await context.unroute('**/api/sync')
  await page.waitForResponse(
    (r) => r.url().includes('/api/sync') && r.ok(),
    { timeout: 15_000 },
  )

  // Reload reads from the server: if the outbox never drained, this fails.
  await page.reload()
  await expect(page.getByText('task saat offline')).toBeVisible()
})
```

> Kalau sync hanya berjalan saat ada aksi (bukan interval), tambahkan satu
> aksi kecil setelah `unroute` untuk memicunya — baca
> `sync-client.ts:triggerSync` dulu untuk tahu mana yang berlaku.

- [ ] **Step 3: Jalankan**

```bash
docker compose up -d postgres
npm run test:e2e
npm run test:e2e   # kedua kalinya harus tetap hijau tanpa pembersihan manual
```

- [ ] **Step 4: Commit**

```bash
git add e2e
git commit -m "test(e2e): quick-add, recurring advance, and offline sync flows

Alur recurring menutup verifikasi manual yang selama ini menahan #23 di Review."
```
