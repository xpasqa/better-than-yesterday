# Spec: Sidebar bersih — Workspace & Recent Chats asli

**Tanggal:** 2026-08-12
**Status:** disetujui, siap ditulis plan.md
**Asal:** brainstorm 2026-08-12

---

## 1. Masalah

Sidebar hari ini adalah satu daftar 13 item yang datar: enam view Todo, tujuh
modul, semuanya sejajar tanpa pengelompokan. Di bawahnya, seksi **Recent
Chats** berisi empat string hardcoded ([Sidebar.tsx:47](../../../apps/web/src/components/Sidebar.tsx))
yang tidak pernah nyata — sisa mock lama.

Dua akibat:
1. **Kebisingan.** Ritme kerja harian (Inbox → Today → project) tenggelam di
   antara modul yang dibuka sesekali.
2. **Kebohongan.** Recent Chats menampilkan percakapan yang tidak pernah
   terjadi — padahal server *sudah* menyimpan riwayat sesi agent asli di
   `agent_session`, klien saja yang tidak pernah membacanya kembali.

## 2. Keputusan

Dari brainstorm, tiga keputusan pengguna:

1. **Kerangka Things dipertahankan** — satu kolom, tanpa icon rail, tanpa
   panel kontekstual. Yang berubah hanya pengelompokan.
2. **Projects di atas Workspace** — urutan: view Todo → Favorites →
   My Projects → Workspace → Recent Chats. Ini justru lebih dekat ke Things
   (view lalu project) daripada susunan sekarang.
3. **Recent Chats diganti data asli**, bukan dihapus — empat sesi agent
   terakhir, dari tabel `agent_session` yang sudah ada.

`Tags` ikut pindah ke Workspace: Things tidak menaruh Tags di sidebar sama
sekali — ia alat penyaring, bukan tempat kerja harian. Enam view inti jadi
tampil murni.

## 3. Struktur final

```
[profil · tema · lonceng · collapse]
+ Add task
Search

Inbox / Today / Upcoming / Anytime / Someday / Logbook   ← tanpa label

FAVORITES ▾            ← tidak berubah
MY PROJECTS  +  ▾      ← tidak berubah (Area → Project)

WORKSPACE ▾            ← seksi baru, collapsible
  Outline · Mail · Storage · Finance · Agent · Tags

RECENT CHATS ▾         ← data asli; disembunyikan bila kosong
  <judul sesi 1>
  <judul sesi 2> …
```

- Lipatan **Workspace** diingat di `localStorage`, mengikuti pola persist
  yang sudah dipakai Favorites/Projects.
- **Recent Chats kosong = seksi tidak dirender.** Header tanpa isi lebih
  berisik daripada tidak ada.

## 4. Recent Chats asli

### 4.1 API

Dua endpoint baru di modul agent (pola `chat-routes.ts`):

| Endpoint | Isi |
|---|---|
| `GET /api/agent/sessions?limit=4` | `[{ id, title, updatedAt }]`, urut `updatedAt` desc |
| `GET /api/agent/sessions/:id` | `{ id, title, closedAt, messages }` — riwayat penuh untuk dirender |

`agent_session` tidak punya kolom judul, dan tidak perlu: **judul diturunkan
dari pesan user pertama** di `history` (dipotong ±48 karakter). Tanpa
migrasi. Parsing JSON per baris murah pada `limit=4`.

`history` menyimpan `ChatCompletionMessageParam[]` — endpoint `:id`
memfilternya jadi hanya `role: 'user' | 'assistant'` dengan konten string,
karena baris tool-call bukan untuk dilihat manusia.

### 4.2 Sidebar

- Ambil daftar saat mount; klik item → navigasi ke Agent dengan sesi itu.
- Judul di-truncate CSS satu baris.

### 4.3 AgentView memuat sesi

Hari ini `AgentView` memulai state `messages` kosong — riwayat yang
tersimpan di server tidak pernah tampil. Sekarang:

- Dibuka dari Recent Chats → fetch `GET /api/agent/sessions/:id`, render
  riwayatnya sebagai gelembung chat biasa.
- **Sesi aktif** (`closedAt == null`): komposer hidup — mengirim pesan
  melanjutkan sesi lewat `/chat` yang memang menargetkan sesi aktif.
- **Sesi tertutup** (`closedAt` terisi): komposer dinonaktifkan dengan
  keterangan "Sesi ini sudah ditutup". Tanpa ini, mengetik di sesi lama
  akan diam-diam menulis ke sesi aktif yang berbeda — jebakan senyap.

## 5. Di luar cakupan

- **Resume/reopen sesi tertutup** — hanya baca.
- **Judul sesi yang bisa diedit / kolom title** — derivasi cukup.
- **BottomNav mobile** — tidak disentuh.
- **Panel kontekstual per modul** (icon rail) — ditolak di brainstorm,
  kerangka Things menang.
- **Pagination daftar sesi** — empat terakhir saja; riwayat lengkap adalah
  urusan halaman Agent kelak, bukan sidebar.

## 6. Verifikasi

| Lapis | Yang dibuktikan |
|---|---|
| Unit — API | Daftar terurut `updatedAt` desc · judul terderivasi dari pesan user pertama · sesi user lain tidak pernah bocor · `:id` milik user lain → 404 |
| Unit — derivasi | History kosong → judul fallback ("Percakapan baru") · pesan pertama panjang → terpotong |
| E2E | Sidebar menampilkan urutan seksi baru · kirim satu chat → judulnya muncul di Recent Chats → klik → riwayat tampil |
| Browser sungguhan | Syarat Done — lipatan Workspace bertahan setelah reload, seksi kosong tidak tampil |
