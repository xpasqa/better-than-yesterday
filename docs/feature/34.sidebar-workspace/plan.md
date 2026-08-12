# Plan: Sidebar bersih — Workspace & Recent Chats asli

Rujukan: [spec.md](spec.md). Tiga blok, tiap blok bisa di-commit sendiri.

---

## Blok A — restrukturisasi sidebar

Murni penataan ulang [Sidebar.tsx](../../../apps/web/src/components/Sidebar.tsx)
+ CSS. Belum ada API.

1. **Urutan baru** di dalam `<nav className="sidebar__nav">`:
   view Todo (Search + Inbox…Logbook, apa adanya) → Favorites → My Projects →
   seksi baru **Workspace** → Recent Chats.
2. **Seksi Workspace**: header berlabel `Workspace` + chevron, pola persis
   seksi Favorites yang ada (state `useState` + `localStorage`, ikuti kunci
   penyimpanan yang dipakai `sidebarCollapsed` dkk). Isinya enam item yang
   dipindahkan dari daftar flat: Outline, Mail, Storage, Finance, Agent,
   Tags — markup `sidebar__nav-item` yang sama, hanya berpindah induk.
3. **Hapus** `const recentChats = [...]` mock (baris 47) dan seluruh render
   seksi lamanya — blok C membangunnya kembali dengan data asli. Di akhir
   blok A seksi itu hilang total; itu keadaan yang jujur.
4. CSS: kemungkinan nol-perubahan — kelas seksi sudah ada. Cek indentasi
   item di dalam seksi konsisten dengan Favorites.

**Selesai kalau:** typecheck+lint hijau, dan di browser urutan seksi sesuai
spec §3 dengan lipatan Workspace bertahan setelah reload.

---

## Blok B — API daftar & detail sesi agent

File baru `apps/api/src/modules/agent/session-routes.ts`, mengikuti bentuk
`chat-routes.ts` (Hono sub-router, `userId` dari context), didaftarkan di
`app.ts` sebelah `chatRoutes`.

1. **`deriveSessionTitle(history: string): string`** — fungsi murni,
   diekspor supaya bisa di-unit-test: parse JSON, cari elemen pertama
   `role === 'user'` dengan `content` string, potong 48 karakter; fallback
   `'Percakapan baru'` (history kosong/rusak).
2. **`GET /sessions`** — `limit` dari query (default 4, max 20),
   `where eq(agentSession.userId, userId)`, `orderBy desc(updatedAt)`.
   Map tiap baris → `{ id, title: deriveSessionTitle(row.history), updatedAt }`.
3. **`GET /sessions/:id`** — baris milik `userId` atau `404`. Kembalikan
   `{ id, title, closedAt, messages }` — `messages` hasil filter `history`:
   hanya `role user/assistant` dengan `content` bertipe string (baris
   tool-call dibuang, spec §4.1).
4. **Tes** di `apps/api/test/agent-sessions.test.ts` mengikuti pola
   `sync.test.ts` (login → cookie → request): urutan desc · derivasi judul ·
   isolasi antar user · 404 lintas user · fallback judul.

**Selesai kalau:** tes integrasi hijau di database tes.

---

## Blok C — Recent Chats asli + AgentView memuat sesi

1. **Klien API** `apps/web/src/api/agent-sessions.ts` (pola `api/mail.ts`):
   `fetchRecentSessions()`, `fetchSession(id)`.
2. **Sidebar**: state `recentSessions`, fetch saat mount. Render seksi
   Recent Chats hanya bila `length > 0` (spec §3). Klik →
   `navigate('/agent/' + id)`.
3. **Route**: `routes.ts` — `/agent/:sessionId` diturunkan seperti
   `/project/:id` (`deriveViewFromPathname` sudah mengembalikan `sub` untuk
   view berpola `/{view}/{sub}`; pastikan `agent` memakainya).
4. **AgentView menerima `sessionId?`**: bila ada, fetch riwayat lalu isi
   state `messages` (map `role assistant` → `role: 'agent'`). Bila
   `closedAt` terisi: komposer `disabled` + keterangan "Sesi ini sudah
   ditutup" (spec §4.3 — jebakan menulis-ke-sesi-lain).
5. **Penyegaran ringan**: setelah `sendText` selesai streaming, panggil
   ulang `fetchRecentSessions` di Sidebar? Tidak — lintas komponen. Cukup:
   daftar di-fetch saat mount; kebaruan sempurna bukan tujuan sidebar
   (spec §5 menolak kompleksitas ekstra). Catat sebagai keterbatasan sadar.

**Selesai kalau:** e2e spec §6 hijau: kirim chat → judul muncul di sidebar
(setelah reload) → klik → riwayat tampil.

---

## Urutan

```
A ──► C ◄── B      (A dan B paralel; C butuh keduanya)
```

## Prasyarat

```bash
docker compose -f docker-compose.test.yml up -d
```
