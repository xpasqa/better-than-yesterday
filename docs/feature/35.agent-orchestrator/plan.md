# Plan: Agent — Dua Ruang

Rujukan: [spec.md](spec.md). Sepuluh blok, tiap blok bisa di-commit sendiri dan
meninggalkan `master` dalam keadaan jalan.

**Tonggak yang menentukan urutan:** Todo agent (Blok I) tidak bergantung pada
satu pun pekerjaan memori. Setelah A, C, D, E, F selesai ia bisa dirilis apa
adanya — dan pada titik itu agent sudah berhenti rusak *dan* mulai berguna,
sementara jalur chat masih separuh jalan. Karena itu jalur Todo didahulukan
kalau harus memilih.

**Prasyarat sekali jalan**

```bash
docker compose -f docker-compose.test.yml up -d
```

---

## Blok A — ekstraksi jalur tulis `/sync`

Spec §7.1. Murni pemindahan, **nol perubahan perilaku** — tes `/sync` yang ada
adalah jaring pengamannya.

Empat fungsi hari ini privat di
[sync/routes.ts](../../../apps/api/src/modules/sync/routes.ts):
`applyIncomingNodes` (baris ~55), `applyIncomingTags`, `applyIncomingReminders`,
`applyIncomingCompletions`. Semuanya memuat hal yang tidak boleh dilewati siapa
pun: `seq: nextval('sync_seq')`, penjaga kepemilikan, dan `setWhere` LWW.

1. **Pindahkan apa adanya** ke `apps/api/src/modules/sync/apply.ts`, beserta
   `toNodeRow`/`toTagRow`/`toReminderRow`/`toCompletionRow`. Ekspor keempatnya.
   Jangan ubah satu baris logika — kalau tergoda merapikan, tahan sampai Blok F
   selesai dan tesnya ada.
2. `routes.ts` meng-import dari `apply.ts`. Diff-nya harus terbaca sebagai
   pemindahan, bukan penulisan ulang.
3. **Helper DTO untuk pemanggil server-side**, `apps/api/src/modules/todo/dto.ts`:
   `loadNodes(userId)` → `Node[]` bentuk `packages/core`, dan `toDto(row)` /
   `fromCore(node)`. Ini yang membuat tool agent nanti bisa memanggil
   `core/views.ts`, `core/parse.ts`, `core/rank.ts` dengan tipe yang sama persis
   dengan klien.

**Selesai kalau:** `npm run verify` hijau tanpa satu pun tes disunting.

---

## Blok B — migrasi `0002_agent_two_rooms.sql`

Spec §13. Satu migrasi, tujuh perubahan. Ini blok dengan risiko kehilangan data
tertinggi di fitur ini — kerjakan dengan dump production di tangan.

1. `ai_settings`: `ADD COLUMN max_steps SMALLINT NOT NULL DEFAULT 6
   CHECK (max_steps BETWEEN 1 AND 12)` + kolom di
   [ai-settings.ts](../../../apps/api/src/db/schema/ai-settings.ts).
2. `agent_file`: `ADD COLUMN session_id TEXT REFERENCES agent_session(id)
   ON DELETE CASCADE` (nullable) dan `ADD COLUMN scope TEXT NOT NULL
   DEFAULT 'doc' CHECK (scope IN ('global','session','doc'))`.
   Unique index lama `(project_id, path)` diganti: `(user_id, path)` untuk
   `scope='doc'`, `(session_id, path)` untuk `scope='session'`, dan satu baris
   `scope='global'` per user.
3. `agent_file`: check constraint path —
   `path ~ '^[A-Za-z0-9._/-]+\.md$' AND path !~ '(^|/)\.\.(/|$)'`.
   Bersihkan baris yang melanggar **sebelum** constraint dipasang; seharusnya
   nol baris, tapi migrasi tidak boleh berasumsi.
4. `agent_session`: `ADD COLUMN title TEXT`, backfill dengan logika
   `deriveSessionTitle`.
5. **Backfill memori → berkas**: `agent_project.memory` dengan `kind='global'`
   jadi baris `scope='global'` bernama `AGENT.md`; `agent_session.memory` jadi
   `scope='session'` bernama `SESSION.md`.
6. **Arsipkan tingkat project yang dibuang**: `agent_project.memory` dengan
   `kind='project'` ditulis jadi dokumen bersama `arsip/<slug-project>.md`,
   bukan dibuang. Isinya pernah ditulis manusia atau model; menghapusnya
   diam-diam adalah kehilangan yang tidak bisa dibatalkan.
7. **Buang `agent_project`** setelah backfill, dan `agent_session.project_id`
   ikut dihapus — sesi milik user, bukan milik project.
8. **Tutup semua sesi terbuka**: `UPDATE agent_session SET closed_at = now()
   WHERE closed_at IS NULL`. Wajib. Riwayat yang menumpuk hari ini membuat
   giliran pertama setelah deploy langsung menabrak batas konteks — persis bug
   yang sedang diperbaiki.

Kolom `agent_session.memory` **tidak** dibuang di sini; dibuang di rilis
berikutnya setelah backfill terbukti.

**Selesai kalau:** migrasi jalan di database tes dari nol **dan** dari dump
production, dengan jumlah baris `agent_file` sebelum/sesudah dicocokkan tangan;
`npm run verify` hijau.

---

## Blok C — transport: satu event, satu baris JSON

Spec §4. Blok yang mematikan bug #1.

1. **`packages/core/src/sse.ts`** — fungsi murni
   `parseSse(buffer): { events, rest }`. Aturan yang harus benar dan yang
   menjatuhkan versi sekarang: beberapa baris `data:` dalam satu event
   **digabung dengan `\n`, bukan ditimpa** · `data:` tidak di-`trim()`, hanya
   satu spasi setelah titik dua yang dibuang · `\r\n` diterima · event tanpa
   `data:` dilewati, bukan menjatuhkan sisanya · potongan terbelah di tengah
   karakter kembali sebagai `rest`.
2. **`packages/core/src/sse.test.ts`** — **100% branch**. Tulis tesnya sebelum
   implementasinya; kasus pertama yang harus merah adalah "token berisi spasi
   tunggal tidak boleh hilang".
3. **Tipe event bersama** di `packages/core/src/agent-events.ts`: `token`,
   `tool`, `file`, `patch`, `notice`, `error`, `done` sesuai tabel spec §4.
   Satu tipe dipakai server, chat, dan kotak perintah Todo — kontraknya jadi hal
   yang dicek compiler, bukan hal yang disepakati lewat komentar.
4. **[chat-routes.ts](../../../apps/api/src/modules/agent/chat-routes.ts)**:
   semua `writeSSE` memakai `data: JSON.stringify(payload)`. `done` dikirim di
   `finally` — selalu, termasuk setelah `error`.
5. **[AgentView.tsx](../../../apps/web/src/components/AgentView.tsx)**: buang
   parser inline (baris 135–197), ganti dengan `parseSse`. `isStreaming` dilepas
   oleh event `done`, bukan oleh stream yang kebetulan tertutup.

**Selesai kalau:** unit test 100% branch hijau, dan di browser jawaban markdown
tampil dengan spasi, baris baru, dan blok kode utuh.

---

## Blok D — runner tahan gateway

Spec §5. Blok yang mematikan bug #3, #4, dan riwayat yang hilang. Menyentuh
[runner.ts](../../../apps/api/src/modules/agent/runner.ts) saja.

1. **Akumulator tool call jadi fungsi murni** —
   `packages/core/src/tool-calls.ts`: `accumulate(state, delta)` dan
   `finalize(state)`. Dikeluarkan dari runner justru karena inilah tempat dua
   bug bersembunyi, dan di dalam `for await` ia tidak bisa diuji. Aturan sesuai
   tabel spec §5.1: kunci = `id` bila ada, jatuh ke urutan kemunculan · nama
   **di-set, bukan di-append** · `id` yang hilang dibangkitkan `call_<n>`.
2. **Keputusan eksekusi**: ganti `if (finishReason !== 'tool_calls') break`
   dengan `if (toolCalls.length === 0) break`. Kehadiran tool call yang menang,
   bukan `finish_reason`.
3. **Normalisasi pesan assistant**: `content: ''` → `null`; pesan tanpa teks
   **dan** tanpa tool call tidak masuk `messages` maupun riwayat.
4. **Argumen tidak valid** dikembalikan ke model sebagai hasil tool
   (`Error: argumen bukan JSON valid: …`), bukan diam-diam jadi `{}`. Nama tool
   tak dikenal → hasil tool menyebut daftar nama yang sah.
5. **`max_steps` dari `ai_settings`** (Blok B), bukan konstanta 6. Beberapa tool
   call dalam satu respons = satu langkah.
6. **Penutup giliran saat langkah habis**: pesan assistant sungguhan, supaya
   riwayat tidak pernah berakhir pada pesan `role: 'tool'`.
7. **Runner jadi parametrik** — himpunan tool dan daftar lapisan konteks
   diterima sebagai argumen, bukan di-hardcode. Ini yang membuat satu runner
   melayani dua agent tanpa bercabang di dalam.
8. **Timeout & retry** spec §5.3: `AbortController` 30 detik tanpa byte, 120
   detik total; satu retry untuk `5xx` sebelum token pertama.
9. **`appendSessionHistory` pindah ke `finally`** (spec §5.4). Pesan user
   disimpan sebelum panggilan model. Penyimpanan riwayat jadi *callback
   opsional* — todo agent memberikan `undefined` dan tidak menulis apa pun.
10. **Tes integrasi runner** — satu per baris tabel spec §5.1, dengan stream
    palsu. Minimal: `finish_reason: 'stop'` + tool call · nama diulang tiap
    chunk · `index` tidak dikirim · dua tool call sekaligus · argumen JSON rusak
    · stream putus di tengah → riwayat tetap tersimpan.

**Selesai kalau:** semua tes stream palsu hijau, dan agent sungguhan
mengeksekusi tool pada model yang sebelumnya gagal.

---

## Blok E — konteks berlapis & anggaran token

Spec §6. Blok yang mematikan separuh bug #5.

1. **`packages/core/src/context.ts`** — `assemble(layers, cap): { prompt,
   dropped }`, fungsi murni. `estimateTokens(text) = Math.ceil(text.length / 3.5)`
   — sengaja konservatif; melebihi batas berarti error, di bawahnya cuma sedikit
   boros.
2. **Pembuangan berpasangan**: riwayat dibuang sebagai unit user + assistant +
   semua pesan `tool` yang menempel. Membuang assistant tanpa hasil tool-nya
   meninggalkan `tool_call_id` yatim — itu 400 dari provider, dan gampang lolos
   kalau tesnya cuma menghitung token.
3. **`packages/core/src/context.test.ts`** — **100% branch**: urutan pembuangan
   menurut prioritas · lapisan tak terbuang tetap ada walau cap terlampaui ·
   pembuangan berpasangan · isi `dropped` benar.
4. **Dua susunan lapisan**, sesuai tabel spec §6 — chat memakai tujuh lapisan,
   todo memakai lima (tanpa `SESSION.md`, tanpa manifes dokumen). Keduanya
   memanggil `assemble` yang sama.
5. **Peta workspace** (spec §7.2) dihitung dari `loadNodes` (Blok A) +
   `core/views.ts`. Dipakai kedua susunan.
6. Tiap pembuangan mengirim event `notice`.

**Selesai kalau:** percakapan 40 giliran tidak menghasilkan error konteks, dan
pemotongan muncul di UI.

---

## Blok F — tool workspace

Spec §7. Blok yang mematikan bug #2 dan #6. Bergantung pada Blok A.

1. **`nodeId` berhenti jadi syarat.** Buang semua
   `if (!ctx.nodeId) return 'Error: no project context'`. `nodeId` masuk konteks
   sebagai "project aktif", tidak pernah sebagai gerbang.
2. **Ganti seluruh isi tool task** di
   [tool-executor.ts](../../../apps/api/src/modules/agent/tool-executor.ts):
   tidak ada lagi `db.insert`/`db.update` atas `node`. Semua menyusun DTO lalu
   memanggil `applyIncoming*` dari Blok A.
3. **Tiga belas tool** sesuai tabel spec §7.3. Yang butuh perhatian khusus:
   - `list_tasks` memanggil `core/views.ts` apa adanya — definisi "Today" tidak
     boleh ditulis ulang di sisi agent.
   - `create_task` mem-parse `text` dengan `core/parse.ts`; field eksplisit
     menimpa hasil parse.
   - `complete_task` **terpisah** dari `update_task`, memakai
     `core/recurrence.ts` + `core/completion.ts` — task berulang maju ke
     kemunculan berikutnya, bukan mati.
   - `move_task` memakai `core/tree.wouldCreateCycle` + `core/rank.between`.
4. **Event `patch`** dikirim setelah tiap penulisan; klien menyegarkan lewat
   `/sync` yang sudah ada, bukan mekanisme kedua.
5. **Undo** (spec §7.4): keadaan sebelum tiap penulisan disimpan, dan
   `POST /api/agent/undo/:id` memulihkan lewat `applyIncoming*`.
6. **Tes integrasi** lawan Postgres asli: kontrak tiap tool · **`seq` bertambah
   di setiap penulisan** (bug #6) · penyelesaian task berulang maju · isolasi
   antar user · `parentId` yang membuat siklus ditolak.

**Selesai kalau:** tool workspace lolos tes kontraknya, dan perubahan lewat tool
terlihat di `/sync` berikutnya.

---

## Blok G — berkas & memori dua tingkat

Spec §8. Bergantung pada Blok B.

1. **`packages/core/src/edit.ts`** — fungsi murni
   `(content, oldString, newString)`, lima kondisi spec fase-3 §7.1. **100%
   branch coverage wajib**; ini satu-satunya tempat di fitur ini di mana bug
   menghancurkan tulisan user.
2. **`edit_file`** ditambahkan ke `tools.ts` + `tool-executor.ts`.
3. **`file-service.ts` berbasis `scope`**, bukan `project_id`:
   `scope='session'` hanya terbaca dari sesinya sendiri · `scope='doc'` terbaca
   dari semua sesi milik user · `scope='global'` **tidak bisa ditulis lewat tool
   sama sekali** — hanya lewat Settings.
4. **`compact_memory` dihapus.** `edit_file` dan `write_file` sudah cukup, dan
   satu tool lebih sedikit berarti satu aturan lebih sedikit untuk dilanggar
   model.
5. **Batas ukuran di satu tempat**, di `writeFile`: 4.000 untuk `AGENT.md`,
   8.000 untuk `SESSION.md`. Pesannya menyuruh memadatkan, bukan sekadar
   menolak.
6. **Validasi path** di service **dan** di database (Blok B). Model adalah
   pemanggil yang tidak terpercaya, jadi keduanya — bukan salah satu.
7. **Tes isolasi berkas**: `SESSION.md` sesi lain tidak pernah terbaca; dokumen
   `scope='doc'` terbaca dari sesi mana pun milik user yang sama.

**Selesai kalau:** chat baru melihat dokumen chat lama tapi **tidak** melihat
`SESSION.md`-nya.

---

## Blok H — siklus hidup sesi chat

Spec §9.1. Bergantung pada Blok G. Jauh lebih kecil dari versi v1 — pemadatan
sesi→project hilang bersama tingkat project.

1. **`POST /api/agent/sessions/:id/close`** — dipanggil tombol "New chat", yang
   hari ini cuma membersihkan state React.
2. **Sesi menganggur 24 jam** ditutup oleh giliran berikutnya, bukan cron. Cron
   untuk ini akan jadi infrastruktur baru demi satu baris logika.
3. **Sesi tertutup tetap terbaca**: membuka dari Recent Chats menampilkan
   riwayat dan `SESSION.md`-nya, komposer nonaktif.
4. **`notice` saat riwayat > 60 pesan**, menyarankan chat baru. Tidak dipaksa.
5. **Tes**: sesi baru mulai dari riwayat kosong · `SESSION.md` sesi lama tidak
   bocor ke sesi baru · sesi tertutup tidak bisa ditulisi.

**Selesai kalau:** "New chat" benar-benar menutup sesi di server dan sesi
berikutnya mulai bersih.

---

## Blok I — kotak perintah Todo

Spec §10. Bergantung pada A, C, D, E, F. **Tidak** bergantung pada B, G, H —
dan itu yang membuatnya bisa dirilis lebih dulu.

1. **`POST /api/agent/command`** — SSE, protokol §4. Memanggil runner
   parametrik (Blok D poin 7) dengan: tool workspace saja, lapisan konteks todo
   (Blok E poin 4), dan callback penyimpan riwayat `undefined`.
2. **Klien mengirim `previousTurn?: { user, assistant }`** — satu giliran
   terakhir, dipegang di state React, tidak pernah menyentuh database. Ini yang
   membuat *"geser yang jam 2 ke jam 3"* nyambung tanpa tabel sesi.
3. **Komponen `TodoCommandBar`** di dalam view Todo: satu textarea, indikator
   progres dari event `tool`, dan satu balasan ringkas. Bukan transkrip
   bergulir — balasan sebelumnya diganti, tidak ditumpuk.
4. **Event `patch` menyegarkan view** tanpa muat ulang, lewat jalur `/sync` yang
   sudah ada.
5. **Tombol Undo** pada balasan yang mengandung penulisan.
6. **Tes**: kotak perintah tidak meninggalkan satu baris pun di `agent_session`
   · giliran lanjutan nyambung · `patch` memicu refresh.

**Selesai kalau:** "Susun jadwal hari ini, saya ada meeting jam 2" mengisi
`dueTime` beberapa task, menghindari jam 2, dan Today berubah tanpa muat ulang —
lalu "geser yang jam 2 ke jam 3" langsung nyambung.

---

## Blok J — frontend chat & Settings

Spec §4, §8.1, §11. Bergantung pada C, G, H, I.

1. **Indikator tool berlabel** dari event `tool` ("Membaca temuan.md…"), dan
   hasil tool sebagai kartu ringkas — daftar task jadi baris, dokumen jadi chip
   yang bisa dibuka.
2. **Settings → Agent**: penyunting `AGENT.md` (textarea markdown dengan
   penghitung 4.000 karakter), `max_steps`, daftar model dari
   `GET /api/agent/models` (proxy, cache 1 jam), dan **sisa kuota harian** dari
   `GET /api/agent/usage` — terlihat sebelum dibentur, bukan sesudah.
3. **Usulan memori global**: bila agent mengusulkan tambahan untuk `AGENT.md`,
   transkrip menampilkannya dengan satu tombol Terima yang menulis ke Settings.
   Tidak pernah otomatis.
4. **Pesan error berkode** sesuai tabel spec §11: `401` menautkan ke Settings,
   `429` menampilkan hitung mundur dari `retryAfterSec`.
5. **Panel berkas menyunting `SESSION.md`** dan dokumen. Memori yang tidak bisa
   kamu perbaiki sendiri akan berhenti kamu percayai.
6. **Hapus** `mockFiles.ts` dan toggle `chat`/`cowork`
   ([AgentView.tsx:46](../../../apps/web/src/components/AgentView.tsx:46)) —
   tidak pernah dibaca sejak ditulis.

**Selesai kalau:** e2e spec §14 hijau dan verifikasi di browser sungguhan
dijalankan (syarat Done, `docs/policy/2-workflow.md` §2).

---

## Urutan

```
Fondasi (paralel)   A · B · C
Mesin               D ─► E                    (butuh C)
Jalur Todo          F ─► I                    (butuh A, D, E)   ◄── rilis di sini
Jalur Chat          G ─► H                    (butuh B)
Permukaan           J                         (butuh C, G, H, I)
```

**Titik rilis pertama ada setelah Blok I.** Pada saat itu: teks tidak lagi rusak
(C), tool tidak lagi hilang (D), agent melihat seluruh workspace (F), dan kamu
punya kotak perintah yang bekerja (I). Jalur chat belum selesai dan itu tidak
apa-apa — chat yang ada hari ini tetap jalan, cuma belum punya memori yang
benar.

**Kalau harus berhenti lebih awal lagi**, urutan nilai per usaha tetap
C → D → F: teks tidak lagi rusak, tool tidak lagi hilang, agent akhirnya melihat
task.
