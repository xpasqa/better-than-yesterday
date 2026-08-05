# Desain: Pohon Terpadu — Todo + Outline jadi satu

**Tanggal:** 2026-08-05
**Status:** disetujui, siap dibuatkan rencana implementasi
**Policy:** tunduk pada [`docs/policy/1-engineering-policy.md`](../../policy/1-engineering-policy.md)

---

## 1. Konteks

`better` sekarang adalah rekonstruksi UI Todoist: React 19 + Vite + TypeScript,
~2.800 baris, **seluruh datanya mock**. `AgentView.tsx` bahkan menyimpan konstanta
`AGENT_REPLY` yang isinya "nothing here is wired to a real agent".

Interview Todoist sudah lolos. Tantangannya sekarang: membuktikan.

**Bentuk buktinya: dogfood.** Satu pengguna — penulis — memakainya tiap hari
menggantikan Todoist. Bukan demo, bukan produk publik, bukan repo untuk dibaca.
Ini menentukan hampir semua keputusan di bawah: tidak ada multi-tenant, tidak ada
signup, tidak ada verifikasi OAuth, tidak ada billing. Tapi bar-nya naik di tempat
lain — kalau setengah jadi, penulis tidak akan memakainya, dan seluruh proyek gagal
tanpa perlu ada yang menilai.

## 2. Kenapa pindah dari Todoist

Empat alasan disebut. Tiga di antaranya bukan fitur melainkan properti arsitektur —
gratis kalau diputuskan sekarang, mahal kalau ditambal belakangan:

| Alasan | Statusnya |
|---|---|
| **Task nyambung ke Outline** | Fitur. Ini jantung v1. |
| Self-hosted / data sendiri | Properti. Konsekuensi otomatis dari single-user + Postgres sendiri. |
| Cepat & offline-first | Properti. Murah justru karena single-user: konflik cuma antar-device. |
| Agent yang bisa menulis task | Fitur, **ditunda**. Jadi murah begitu operasi pohon sudah bersih dan stabil. |

## 3. Ruang lingkup

### Masuk v1

- Model data pohon terpadu (satu tabel `node`)
- View Today · Upcoming · Inbox · Project — semuanya filter atas pohon yang sama
- View Outline (editor pohon) dan Board (kolom = section)
- Quick capture dengan token inline
- Offline-first: seluruh pohon di IndexedDB, sync latar belakang
- Auth single-user
- Deploy ke satu VPS, kebuka dari browser HP

### Tidak masuk v1

| | Alasan |
|---|---|
| **Email** | Subsistem tersendiri. Tetap di luar v1, tapi alasannya berubah — lihat pembaruan di bawah. |
| **Storage / Files** | Tidak muncul di daftar alasan pindah sama sekali. |
| **Agent** | Irisan berikutnya. Agent tanpa data tidak berguna; agent di atas API stabil beberapa hari kerja. |
| **App desktop / mobile native** | Nanti. Gratis lewat Tauri/Electron kalau sekarang tetap SPA + HTTP API. |

**Pembaruan 2026-08-05 — alasan Email ditunda sudah gugur.** Dokumen ini semula menunda
Email karena "email penulis di Proton — tidak ada IMAP tanpa Proton Bridge". Premis itu
tidak berlaku lagi: sekarang ada mailbox `pasqa@publion.org` di Hostinger/Niagahoster
dengan IMAP dan SMTP biasa, tanpa OAuth dan tanpa bridge.

Yang gugur hanya **hambatan teknisnya**. Email tetap di luar v1 karena alasan yang
berbeda dan masih berdiri: v1 adalah membuktikan dogfood todo+outline, dan Mail nyata
mustahil sebelum backend ada sama sekali. Rinciannya —
protokol, bentuk API, dan konfliknya dengan policy — di
[`../1.mail-client/notes.md`](../1.mail-client/notes.md).

**`StorageView.tsx` dan `AgentView.tsx` dibiarkan apa adanya** — tetap mock, tetap
bisa diklik, tidak dihapus dan tidak disambung. Nol kerjaan, nilai demonya tetap.

**Catatan lanjutan:** React Native **tidak** akan memakai ulang UI web — itu tulis
ulang. Tauri/Electron yang gratis. Selama frontend tetap SPA murni yang bicara ke
HTTP API, dua-duanya tetap terbuka.

## 4. Keputusan inti: satu pohon, dua lensa

**Tidak ada entitas `Task` yang terpisah dari `OutlineNode`.** Yang ada hanya node.
Node yang punya `due_date`/`priority` **adalah** task. Todo view adalah filter atas
pohon yang sama.

```
node "Rilis v2"
 ├─ node "Riset kompetitor"   due:Sen  p1   ← muncul di Today
 ├─ node "Draft spec"                        ← cuma outline
 └─ node "Kirim ke tim"       due:Rab       ← muncul di Upcoming
```

Konsekuensinya: satu tabel, satu mesin urutan, satu jalur sync, satu undo stack.
Menulis rencana di outline lalu memberi tanggal ke satu baris membuatnya langsung
muncul di Today. Todoist tidak bisa; Workflowy tidak bisa. Dan kodenya **lebih
sedikit**, bukan lebih banyak.

`types/index.ts` yang sekarang punya empat entitas (`Task`, `Project`, `Section`,
`OutlineNode`). Keempatnya runtuh jadi satu `Node`.

### Section tetap first-class

Section **tidak** hilang dan **tidak** jadi node tanpa identitas. Section pindah ke
tabel yang sama sambil membawa namanya, dibedakan lewat kolom `kind`.

Alasan tidak dipertahankan sebagai tabel terpisah: itu menciptakan **dua sistem
urutan dan dua jalur sync**. Akibat konkretnya — drag kartu antar kolom akan jadi
implementasi berbeda dari drag baris di outline meski gerakannya sama; sync harus
merekonsiliasi dua tabel yang saling menunjuk dan bisa jadi tidak konsisten (section
terhapus, task masih menunjuk ke sana); dan "pindahkan task dari kolom Board ke
sub-bagian di Outline" jadi kasus khusus alih-alih operasi biasa.

Dengan `kind`, section tetap bisa di-query persis (`kind='section' AND parent_id=X`),
tetap dibuat manual dan tidak pernah muncul sendiri, tetap punya nama sendiri — tapi
berbagi satu `rank`, satu mesin drag, satu sync.

## 5. Model data

```sql
node
  id            text        primary key      -- UUIDv7, dibuat di CLIENT
  parent_id     text        references node(id)   -- null = akar
  kind          text        not null default 'item'   -- 'item' | 'section'
  rank          text        not null         -- fractional index
  content       text        not null default ''
  note          text
  due_date      date
  priority      smallint                     -- 1..4, null = tanpa prioritas
  labels        text[]      not null default '{}'
  completed_at  timestamptz                  -- null = belum selesai
  collapsed     boolean     not null default false
  created_at    timestamptz not null
  updated_at    timestamptz not null         -- distempel CLIENT saat edit
  deleted_at    timestamptz                  -- soft delete
  seq           bigint      not null         -- dari sequence, dinaikkan SERVER tiap tulis
```

Index: `parent_id`, `seq`, dan partial index pada `due_date`
(`WHERE completed_at IS NULL AND deleted_at IS NULL`).

### Lima keputusan yang tidak sepele

**`id` dibuat di client (UUIDv7).** Kalau server yang membuat ID, node tidak bisa
dibuat saat offline — harus menunggu balasan. Dengan UUIDv7 penulis bisa mengetik di
pesawat, dan tidak ada rekonsiliasi ID saat online lagi. Terurut secara waktu, jadi
B-tree index tetap sehat.

**`rank` fractional index, bukan integer `order`.** Dengan integer, memindahkan satu
item berarti menulis ulang seluruh saudaranya — konflik terus-menerus antar-device.
Fractional index (`"a0"`, `"a0V"`, `"a1"`) hanya menulis satu baris per pemindahan.
Ini yang membuat offline-first tidak menyakitkan.

**`deleted_at`, bukan `DELETE`.** Baris yang lenyap tidak bisa disinkronkan — device
lain tidak akan pernah tahu penghapusannya.

**`seq` terpisah dari `updated_at`.** Timestamp bisa bentrok dan bisa mundur, jadi
tidak layak jadi kursor sync. `seq` dari sequence Postgres naik monoton dan tidak
pernah bohong.

**`updated_at` distempel client, bukan server.** Ini dasar LWW. Kalau distempel saat
tiba di server, edit offline yang dibuat lebih dulu bisa menang atas edit online yang
dibuat belakangan. Ketergantungannya: jam device tidak ngawur — lihat Risiko.

### View = filter

| View | Definisi |
|---|---|
| Inbox | anak dari node akar `Inbox` (ID tetap) |
| Today | `due_date <= hari ini`, belum selesai — **di kedalaman mana pun** |
| Upcoming | `due_date > hari ini`, dikelompokkan per tanggal |
| Project X | subtree dari node `X` |
| Board atas X | anak ber-`kind='section'` = kolom; anak dari tiap kolom = kartu |
| Outline | pohonnya sendiri |

Anak `X` yang ber-`kind='item'` (tidak berada di dalam section mana pun) tampil di
kolom implisit paling kiri tanpa judul. Project tanpa section sama sekali tetap
menampilkan Board berisi satu kolom itu — tidak ada state kosong khusus, dan tidak ada
section yang dibuat otomatis.

Board memakai ulang mesin yang sama: drag kartu antar kolom = ubah `parent_id` +
`rank`, operasi **identik** dengan drag di outline. `BoardView.tsx` dan
`OutlineView.tsx` berbagi satu implementasi.

Node dengan `parent_id IS NULL` adalah akar — inilah yang disebut "project" di UI.

## 6. Arsitektur

### Struktur repo

Monorepo npm workspaces. Tanpa Turborepo, tanpa Nx.

```
packages/core/          ← MURNI, tanpa I/O, dipakai client DAN server
  node.ts       tipe Node + kind
  rank.ts       fractional index: between(a, b)
  tree.ts       insert, move, reorder, complete, indent, outdent
  parse.ts      parser quick capture
  views.ts      today() upcoming() project() board()

apps/web/               ← src/ yang sekarang pindah ke sini
  store/        Dexie + sync client + outbox
  components/   yang sudah ada

apps/api/
  routes/sync.ts, routes/auth.ts
  db/schema.ts  Drizzle
```

**`packages/core` adalah inti desain ini.** Semua logika menarik ada di sana dan
tidak menyentuh jaringan maupun database sama sekali. Web dan API tipis: mengambil
input, memanggil `core`, menyimpan/menampilkan hasil. Mereka tidak memutuskan apa pun.

Uji strukturalnya: kalau sebuah aturan tidak bisa diuji tanpa menyalakan browser atau
database, aturan itu ada di tempat yang salah.

### Stack

| Lapisan | Pilihan | Alasan |
|---|---|---|
| Frontend | React 19 + TS + Vite (**tetap**) | Sudah jalan, build bersih |
| Styling | Plain CSS + token dari `variables.css` (**tetap**) | Hasil ekstraksi runtime Todoist; pindah ke Tailwind = membuang kerja |
| Local store | Dexie (IndexedDB) | Seluruh pohon muat di memori pada skala personal |
| Backend | Node + TS + **Hono** | Berbagi tipe dengan frontend, ringan |
| DB | **Postgres** + **Drizzle** | SQL tetap kelihatan |
| Auth | password argon2 + cookie httpOnly bertanda tangan | ~40 baris. Better Auth baru masuk kalau ada user kedua |
| Deploy | 1 VPS, `docker compose` (app + Postgres + Caddy) | TLS otomatis; backup `pg_dump` via cron |

### Alur satu ketukan tombol

```
ketik
  → operasi jalan di pohon dalam memori      ← UI update di sini, 0 ms
  → tulis ke Dexie                            ← selamat dari refresh
  → operasi masuk antrean outbox
       ⋮ (kapan pun, boleh nanti)
  → worker kirim POST /sync
  → server simpan, naikkan seq
  → server balas perubahan sejak cursor
  → merge, cursor maju
```

**Jaringan tidak pernah ada di jalur render.** Tidak ada spinner karena tidak ada
permintaan yang ditunggu. Server mati = aplikasi tetap jalan penuh dengan banner
"offline".

## 7. Sync

Satu endpoint, dua arah:

```
POST /sync  { cursor: bigint, changes: Node[] }
        →   { cursor: bigint, changes: Node[] }
```

Tanpa WebSocket, tanpa endpoint per-resource, tanpa REST CRUD. Untuk satu user dengan
beberapa device, ini yang paling sedikit bisa rusak.

**Resolusi konflik: LWW per baris** berdasarkan `updated_at` yang distempel client.
Server menyimpan yang paling baru. Tabrakan hanya terjadi kalau node yang sama diedit
di dua device sambil salah satunya offline — jarang, dan hasilnya masuk akal: niat
terakhir yang menang. Kalau ternyata menggigit, upgrade-nya LWW per-field, tapi
**jangan dibangun sekarang**.

## 8. Quick capture

```
bikin spec terkait product design [today] #ProductDesign p1
└──────────── judul ────────────┘ └─tgl─┘ └── induk ──┘ └┘prioritas
```

| Token | Arti |
|---|---|
| `#<query>` | pilih induk — fuzzy ke **seluruh pohon**, tampilkan breadcrumb `Rilis v2 › Riset` |
| `[<tanggal>]` | `[today]` `[besok]` `[senin]` `[3 sep]` `[25/12]` |
| `p1`–`p4` | prioritas |
| `@<label>` | label |

**Tanggal wajib dalam kurung siku, bukan bahasa alami telanjang.** Kalau tanggal boleh
telanjang, `"beli buku besok pagi"` jadi ambigu — "besok" itu tanggal atau bagian
judul? Todoist menebak, dan tebakannya salah cukup sering untuk menjengkelkan. Kurung
siku menghapus ambiguitas seluruhnya, membuat parser sepele, dan tidak pernah mencuri
kata dari judul.

**Autocomplete `#` menjangkau semua node, dengan section ditandai berbeda** (ikon/warna).
Bebas mendarat di mana pun, tapi selalu jelas mendarat di apa. Inilah gunanya `kind`.

**Umpan balik langsung:** token yang dikenali berubah jadi chip berwarna sambil
mengetik. Hasilnya terlihat sebelum Enter.

**Letak:** input di atas view Today, plus satu shortcut keyboard yang memfokuskannya
dari view mana pun. Enter simpan, Esc batal (sudah ada di `AddTaskForm.tsx`).

**Implementasi** — `packages/core/parse.ts`, satu fungsi murni:

```ts
parse(input: string, now: Date): {
  content: string
  dueDate: Date | null
  parentQuery: string | null   // dicocokkan ke pohon di lapisan atas
  priority: 1|2|3|4 | null
  labels: string[]
}
```

Tanpa I/O, tanpa akses pohon — pencocokan `#query` ke node terjadi di luar. Bisa diuji
habis dengan tabel input→output tanpa database dan tanpa browser.

## 9. Penanganan kesalahan

| Kejadian | Perilaku |
|---|---|
| Offline | Tulisan masuk outbox, retry dengan backoff eksponensial. UI tidak pernah memblokir. Banner "offline". |
| Server error 5xx | Sama seperti offline. Data tidak pernah hilang dari outbox sebelum server mengonfirmasi. |
| Sesi kedaluwarsa | Arahkan ke login. **Outbox dipertahankan**, dikirim setelah login ulang. |
| Konflik sync | LWW diam-diam. Tidak ada dialog ke pengguna. |
| Token tidak dikenali di quick capture | Tetap jadi teks biasa di judul. **Tidak pernah dibuang diam-diam.** |
| `#query` tidak cocok node mana pun | Node masuk ke Inbox, chip menunjukkan "Inbox". Tidak menolak input. |

## 10. Test

Sesuai `docs/policy/1-engineering-policy.md` §7.

- **`packages/core`: wajib unit test.** Fungsi murni, tidak ada alasan tidak diuji.
  Prioritas: `rank.between()` (termasuk kasus rank kembar dan rank yang memanjang),
  `indent`/`outdent`, `move` lintas induk, `parse()` dengan tabel input→output,
  filter view.
- **Sync: integration test dengan Postgres asli.** Skenario wajib: offline→online;
  dua device mengedit node yang sama; delete sambil offline; cursor tertinggal jauh.
- **Komponen React tidak diuji satu per satu.** Ganti dengan satu-dua alur E2E
  (Playwright) untuk jalur harian: quick capture → muncul di Today → dicentang →
  hilang dari Today.

## 11. Perbaikan terarah yang masuk lingkup

`MainContent.tsx` sekarang 490 baris dan memegang pemilihan view + filter + state
sekaligus. Begitu data datang dari store, ia harus dipecah: filter pindah ke
`core/views.ts`, state pindah ke store, komponennya tinggal merender. Ini bukan
refactor iseng — tanpa itu penyambungan datanya akan berantakan.

Tidak ada refactor lain di luar yang menyentuh jalur ini.

## 12. Alternatif yang ditolak

| Alternatif | Kenapa ditolak |
|---|---|
| `Task` dan `OutlineNode` sebagai dua tabel yang saling menunjuk | Dua sumber kebenaran yang harus dijaga sinkron selamanya; dua sync engine, dua undo. Utang yang membesar tiap minggu. |
| Dokumen Markdown sebagai sumber, task di-parse (model Obsidian Tasks) | Metadata task (prioritas, urutan, section) canggung disimpan di teks. Editing jadi soal parser, bukan soal data. |
| `Section` sebagai tabel terpisah | Dua sistem urutan dan dua jalur sync — lihat §4. |
| Integer `order` untuk urutan | Memindahkan satu item menulis ulang seluruh saudaranya; konflik terus-menerus. |
| ID dibuat server | Membuat node saat offline jadi mustahil tanpa rekonsiliasi ID. |
| Tanggal bahasa alami telanjang (gaya Todoist) | Ambigu; mencuri kata dari judul. |
| CRDT / Yjs | Konflik hanya antar-device milik sendiri. LWW cukup, CRDT jauh lebih mahal. |
| REST CRUD per resource | Sync jadi banyak endpoint yang harus konsisten satu sama lain. |
| Redux / Zustand | State-nya satu pohon; store sendiri di atas Dexie lebih kecil. |
| Better Auth di v1 | Menambah konsep tanpa menambah keamanan untuk satu pengguna. |
| Serverless untuk backend | Tidak diperlukan sekarang, dan menutup jalan sync email nanti (koneksi panjang + worker latar). |

## 13. Risiko

| Risiko | Mitigasi |
|---|---|
| **LWW bergantung pada jam device.** Jam yang ngawur bisa membuat edit lama menang. | Diterima untuk v1. Kalau menggigit: LWW per-field, atau stempel hybrid logical clock. |
| **`rank` memanjang** setelah banyak pemindahan di posisi yang sama. | Rebalance berkala per induk saat panjang rank melewati ambang. Ditulis sejak awal di `rank.ts`. |
| **`#` bisa menanam task di kedalaman 5** dan hilang dari pandangan. | Today mengabaikan kedalaman — ia hanya melihat `due_date`. Kedalaman jadi urusan Outline saja. |
| **Dogfood gagal**: aplikasi tidak cukup baik, penulis kembali ke Todoist. | Ini risiko utama proyek. Mitigasi satu-satunya: kirim satu alur harian yang benar-benar selesai (capture → Today → centang) sebelum menyentuh apa pun yang lain. |
| **Section dan item tertukar** karena berada di satu tabel. | `kind` eksplisit di tipe TypeScript; salah tempat ketahuan saat compile, bukan saat dipakai. |

## 14. Definisi selesai untuk v1

Penulis memakai aplikasi ini menggantikan Todoist selama **dua minggu berturut-turut**
tanpa membuka Todoist, dengan alur harian ini berjalan mulus:

1. Capture dari keyboard di view mana pun, dengan `#` dan `[tanggal]`
2. Today menampilkan yang jatuh tempo, apa pun kedalamannya di pohon
3. Centang menghilangkannya dari Today
4. Outline bisa diedit dan hasilnya langsung tercermin di Today/Board
5. Tutup laptop, buka di browser HP, datanya sama
