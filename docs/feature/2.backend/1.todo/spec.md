# Spec: Backend Todo — Paritas Todoist

> Project tanpa batas, section, label, prioritas, tanggal natural saat
> mengetik, ~~list & kanban, filter tersimpan,~~ recurring, reminder &
> notifikasi. Semua di atas satu pohon `node` yang juga dipakai Outline.
>
> **Catatan 2026-08-08:** kanban dan filter tersimpan dibatalkan — lihat
> [`docs/policy/3-product-policy.md`](../../policy/3-product-policy.md).

**Status:** v1 · **Fase:** 1 · **Bergantung pada:**
[0.infrastructure](../0.infrastructure/spec.md) ·
[spec induk](../spec.md) — keputusan pokok, konvensi token, kontrak lintas-domain ·
[Engineering Policy](../../../policy/1-engineering-policy.md)

---

## 1. Objective

Menggantikan Todoist sepenuhnya untuk tiga orang, sampai tidak ada alasan
membukanya lagi. Ukurannya bukan jumlah fitur melainkan satu kalimat: **dua
minggu berturut-turut tanpa membuka Todoist**.

Yang membuat spec ini panjang bukan ambisi, melainkan bahwa Todoist yang
"hampir lengkap" akan gagal di titik yang justru dipakai tiap hari — mengetik
"besok" dan berharap tanggalnya terisi, label yang bisa di-rename tanpa
memburu semua task, dan reminder yang benar-benar berbunyi di HP.

Fase ini juga menaruh dua kolom yang dipakai fase 4: `due_time` dan
`duration_minutes` — bahan agent menyusun jadwal time-blocking.

---

## 2. Scope

**In:** project tanpa batas (nested) · section · task & subtask tanpa batas
kedalaman · prioritas P1–P4 · due date + jam + durasi · **recurring** ·
label first-class (nama, warna, rename global) · **parsing tanggal natural
saat mengetik** (ID + EN) · quick add dengan token `#` `@` `$` `!`
([konvensi lintas-domain](../spec.md)) · view Inbox,
Today, Upcoming, Project, Label, ~~Filter~~, Completed · ~~**list view &
kanban board** · filter tersimpan dengan bahasa query~~ · pencarian · drag reorder
lintas section/project · **reminder + notifikasi web push** · keyboard
shortcut · sync offline-first multi-entitas · isolasi antar user.

**Out (dengan alasan, §14):** project berbagi antar user · komentar & lampiran
(lampiran menunggu fase 3) · deadline terpisah dari due date · karma/statistik
· template project · Todoist import/export · kalender sync · asisten AI
(fase 4).

---

## 3. Data Model

Semua tabel membawa `user_id TEXT NOT NULL REFERENCES app_user(id)` + index,
dan difilter dari sesi di setiap query (infrastruktur §4.3).

### 3.1 `node` — project, section, task, subtask

```sql
CREATE TABLE node (
  id            TEXT PRIMARY KEY,                 -- UUIDv7, digenerate KLIEN
  user_id       TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  parent_id     TEXT REFERENCES node(id),         -- NULL = root
  kind          TEXT NOT NULL DEFAULT 'item'
                CHECK (kind IN ('project', 'section', 'item')),
  rank          TEXT NOT NULL,                    -- fractional index antar-sibling
  content       TEXT NOT NULL DEFAULT '' CHECK (length(content) <= 2000),
  note          TEXT,                             -- markdown; deskripsi task

  due_date      DATE,
  due_time      TIME,                             -- NULL = sepanjang hari
  duration_min  INTEGER CHECK (duration_min > 0), -- bahan time-blocking (fase 4)
  recurrence    TEXT,                             -- subset RRULE, §8

  priority      SMALLINT CHECK (priority BETWEEN 1 AND 3),  -- NULL = P4 "tanpa"
  label_ids     TEXT[] NOT NULL DEFAULT '{}',     -- id dari tabel label
  color         TEXT,                             -- bermakna di kind='project'
  is_favorite   BOOLEAN NOT NULL DEFAULT false,   -- project & filter & label
  is_inbox      BOOLEAN NOT NULL DEFAULT false,   -- bermakna di kind='project'; §3.1a
  collapsed     BOOLEAN NOT NULL DEFAULT false,

  completed_at  TIMESTAMPTZ,                      -- NULL = belum selesai
  created_at    TIMESTAMPTZ NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL,             -- di-stamp KLIEN (dasar LWW)
  deleted_at    TIMESTAMPTZ,                      -- soft delete
  seq           BIGINT NOT NULL,                  -- di-bump SERVER tiap tulis

  CONSTRAINT node_time_needs_date CHECK (due_time IS NULL OR due_date IS NOT NULL),
  CONSTRAINT node_recur_needs_date CHECK (recurrence IS NULL OR due_date IS NOT NULL)
);
CREATE INDEX node_user_parent ON node (user_id, parent_id);
CREATE INDEX node_user_seq    ON node (user_id, seq);
CREATE INDEX node_due_open    ON node (user_id, due_date)
  WHERE completed_at IS NULL AND deleted_at IS NULL;

-- Tepat satu Inbox per user. Partial unique index, bukan kolom ROOT_INBOX_ID
-- bersama — lihat §3.1a untuk kenapa id tunggal lintas-user tidak bisa dipakai.
CREATE UNIQUE INDEX node_one_inbox_per_user ON node (user_id) WHERE is_inbox;
```

Tiga hal yang dikunci di database, bukan di ingatan UI: jam tanpa tanggal
tidak bermakna; recurring tanpa tanggal tidak bermakna; `p4` disimpan `NULL`
supaya "tanpa prioritas" hanya punya satu representasi.

**`kind='project'`** melengkapi `section` dan `item`. Alasannya:
project butuh warna, favorit, dan boleh nested, sementara root non-project
(nanti: dokumen outline lepas) tidak. Membedakannya dengan kolom `kind` yang
sudah ada lebih murah daripada menebak dari `parent_id IS NULL`.

**Project tanpa batas, dan boleh nested** — ~~Todoist mengizinkan 4 level.
Di sini kedalaman tidak dibatasi karena pohonnya memang satu~~; UI menampilkan
hierarki di sidebar.

> **Direvisi 2026-08-08 oleh [`13.project-hierarchy/spec.md`](../../13.project-hierarchy/spec.md).**
> Dua koreksi:
> 1. **Fakta salah:** Todoist mengizinkan **3** level indent untuk
>    sub-project, bukan 4. Angka 4 itu untuk **sub-task**, bukan project.
> 2. **Keputusan berubah:** kedalaman sekarang **dibatasi satu tingkat sub**
>    (project → sub-project, selesai). Alasannya di spec fitur 13 §4.

**Subtask tanpa batas kedalaman.** Todoist membatasinya, dan rancangan
sebelumnya meniru batas itu agar subtask tidak bersaing dengan outline. Di
sini justru sebaliknya — subtask *adalah* outline, jadi batasan itu kehilangan
alasannya.

#### 3.1a Inbox: `is_inbox`, bukan id bersama

`node.id` adalah primary key **global** — tidak digabung dengan `user_id`.
Itu berarti sebuah konstanta id Inbox yang sama untuk semua user (ide yang
sempat tertulis dalam ringkasan percakapan sebelum spec ini) akan langsung
tabrakan begitu user kedua dibuat: dua baris berbeda tidak boleh berbagi satu
primary key. Root Inbox tetap **UUIDv7 biasa, dibuat `user add` seperti root
lainnya** — yang membedakannya hanyalah `is_inbox = true`, ditegakkan tepat
satu per user oleh index unik parsial di atas. Klien menemukan "Inbox milikku"
lewat filter atas pohon yang sudah tersinkron (`nodes.find(n => n.isInbox)`),
bukan lewat id yang ditebak.

### 3.2 `label`

```sql
CREATE TABLE label (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  name        TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 60
                                   AND name !~ '\s'),   -- tanpa spasi: token $nama
  color       TEXT NOT NULL DEFAULT 'grey',
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  rank        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL,
  deleted_at  TIMESTAMPTZ,
  seq         BIGINT NOT NULL,
  UNIQUE (user_id, name)
);
```

Label adalah **entitas, bukan string** — rancangan awal menyimpannya sebagai
`labels text[]` berisi nama. Alasan perubahannya konkret: rename label harus berlaku di semua task
sekaligus, dan warna harus bertahan. `node.label_ids` menyimpan **id**, bukan
nama, sehingga rename tidak menyentuh satu pun baris `node` — sekaligus
menjaga node tetap mandiri sehingga sync tidak butuh tabel join.

Label terhapus yang masih tersisa di `label_ids` diabaikan saat render dan
dibersihkan malas (saat node itu ditulis berikutnya). Ini disengaja: mengejar
semua node saat label dihapus akan menulis ratusan baris dan memicu konflik
sync — persis yang dihindari desain ini.

### 3.3 `saved_filter`

```sql
CREATE TABLE saved_filter (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  name        TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 60),
  query       TEXT NOT NULL,                      -- bahasa filter §7
  color       TEXT NOT NULL DEFAULT 'grey',
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  rank        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL,
  deleted_at  TIMESTAMPTZ,
  seq         BIGINT NOT NULL
);
```

### 3.4 `reminder`

```sql
CREATE TABLE reminder (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  node_id      TEXT NOT NULL REFERENCES node(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('absolute', 'relative')),
  remind_at    TIMESTAMPTZ,                       -- kind='absolute'
  offset_min   INTEGER,                           -- kind='relative', sebelum due_time
  fire_at      TIMESTAMPTZ NOT NULL,              -- hasil hitung; yang dipakai scheduler
  delivered_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL,
  deleted_at   TIMESTAMPTZ,
  seq          BIGINT NOT NULL,
  CONSTRAINT reminder_shape CHECK (
    (kind = 'absolute' AND remind_at IS NOT NULL) OR
    (kind = 'relative' AND offset_min IS NOT NULL))
);
CREATE INDEX reminder_due ON reminder (fire_at)
  WHERE delivered_at IS NULL AND deleted_at IS NULL;
```

`fire_at` dihitung klien (dari `due_date`+`due_time`+offset dalam timezone
user) dan disimpan sebagai satu instan absolut, sehingga **scheduler server
tidak perlu tahu apa pun tentang timezone** — ia hanya membandingkan dengan
`now()`. Mengubah jam task berarti menulis ulang `fire_at`, yang memang sudah
terjadi lewat sync.

### 3.5 `notification` (dibuat server, hanya turun)

```sql
CREATE TABLE notification (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('reminder', 'digest', 'overdue')),
  node_id    TEXT REFERENCES node(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at    TIMESTAMPTZ,
  seq        BIGINT NOT NULL
);
```

### 3.6 `push_subscription` (server-only, tidak ikut sync)

```sql
CREATE TABLE push_subscription (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  user_agent TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  failed_at  TIMESTAMPTZ
);
```

Ini milik device, bukan milik data — karena itu tidak disinkronkan. Endpoint
yang ditolak push service (410 Gone) dihapus saat itu juga.

### 3.7 Preferensi user (ALTER pada `app_user`)

```sql
ALTER TABLE app_user
  ADD COLUMN timezone      TEXT    NOT NULL DEFAULT 'Asia/Jakarta',   -- IANA
  ADD COLUMN week_start    SMALLINT NOT NULL DEFAULT 1,               -- 1=Senin
  ADD COLUMN default_remind_time TIME NOT NULL DEFAULT '09:00',       -- task tanpa jam
  ADD COLUMN digest_time   TIME,                                      -- NULL = mati
  ADD COLUMN language      TEXT    NOT NULL DEFAULT 'id';             -- kosakata parser
```

**Timezone bukan kosmetik.** Ia menentukan apa arti "hari ini" di view Today,
kapan reminder task tanpa jam berbunyi, dan bagaimana "besok" diterjemahkan
parser. Ia hidup di user, bukan device, supaya HP dan laptop sepakat.

---

## 4. Sync Multi-Entitas

Kontrak `/sync` di spec induk diperluas — satu cursor, banyak entitas.
**Ini menggantikan bentuk `changes: NodeDTO[]`.**

```
POST /api/sync
{ cursor: "0",
  changes: { nodes: [], labels: [], filters: [], reminders: [] } }
→
{ cursor: "8421",
  changes: { nodes: [], labels: [], filters: [], reminders: [], notifications: [] } }
```

- **Satu sequence Postgres per instalasi**; setiap tabel syncable menarik
  `seq` darinya. Satu cursor global karena itu cukup: klien meminta "semua
  yang berubah setelah 8421", lintas entitas, dalam satu round trip.
- Turun selalu difilter `WHERE user_id = <sesi>` — pondasi isolasi.
- `notifications` hanya turun (dibuat server). Menandai sudah dibaca lewat
  `POST /api/notifications/:id/read`, bukan lewat sync, karena tidak ada yang
  perlu di-merge.
- LWW level baris pada `updated_at` klien; batch maks 500 per entitas; klien
  memecah sendiri; bootstrap device = cursor `"0"`.
- Validasi Zod tiap entitas. Server **tidak** memvalidasi siklus parent —
  klien satu-satunya penulis dan `core/tree.ts` menolak siklus sebelum tulis.

Alur tetap: ketik → pohon in-memory (< 16 ms) → Dexie → outbox → worker POST
kapan pun → merge. Offline/5xx → outbox tahan + backoff + banner; 401 →
redirect login, **outbox utuh**, flush setelah login ulang.

---

## 5. Tanggal Natural Saat Mengetik

Inilah fitur yang menentukan aplikasi ini dipakai atau ditinggalkan, dan
inilah yang **membatalkan** rancangan awal yang mewajibkan kurung siku
`[besok]` ([spec induk §3.6](../spec.md)).

```
beli tiket pesawat besok jam 9 pagi #Travel $penting !1
└──────── judul ────────┘└─ tanggal ─┘ └proj┘ └label┘└┘
```

Sigilnya sama persis di Outline dan Agent — lihat
[konvensi token](../spec.md). Ringkasnya: `#` project (tempat), `@` sebutan
task, `$` label, `!` prioritas.

Saat mengetik, potongan yang dikenali **digarisbawahi di dalam input** dan
hasilnya tampil sebagai chip di bawahnya ("Besok, 09:00"). Menekan `Esc`
sekali, atau mengklik chip, membatalkan interpretasi dan mengembalikan teks
itu menjadi judul biasa.

### Aturan yang membuatnya bisa dipercaya

1. **Hanya satu tanggal dan satu jam per input** — kecocokan paling kanan
   menang. Kalimat yang menyebut dua tanggal hampir selalu berarti yang
   terakhir adalah jadwalnya.
2. **Cocok hanya di batas kata**, tidak pernah di tengah kata.
3. **Teks yang tidak dikenali tidak pernah dibuang** — sisanya utuh menjadi
   judul, termasuk kata yang kebetulan mirip token.
4. **Bisa dibatalkan, dan pembatalannya diingat**: `Esc` mengembalikan teks
   literal. Ini pengganti kepastian kurung siku — dulu kurung dipilih justru
   karena takut parser mencuri kata; sekarang risiko itu ditebus oleh
   pembatalan satu tombol plus penyorotan yang membuat tebakan parser terlihat
   **sebelum** Enter ditekan.
5. **Ambiguitas jam:** jam telanjang 1–12 berarti **pagi** kecuali ada sufiks
   (`pagi`, `siang`, `sore`, `malam`, `am`, `pm`). Selalu bisa salah,
   selalu bisa ditebak — menebak PM dari jam dinding membuat input yang sama
   berarti beda tergantung kapan diketik.

### Kosakata (ID + EN, `language` menentukan yang mana diprioritaskan)

| Kelas | Contoh yang dikenali |
|---|---|
| Hari relatif | `hari ini` `today` `besok` `bsk` `tomorrow` `lusa` `kemarin` `yesterday` |
| Hari bernama | `senin`…`minggu`, `monday`…`sunday` — kemunculan berikutnya; **hari ini jika hari ini harinya**; `senin depan` = minggu berikutnya |
| Relatif majemuk | `minggu depan` `next week` `bulan depan` `next month` `3 hari lagi` `in 3 days` `2 minggu lagi` |
| Tanggal eksplisit | `25/12` `25-12` `3 sep` `3 september` `sep 3` `2026-12-25` — tahun ini, atau tahun depan bila sudah lewat |
| Akhir periode | `akhir bulan` `end of month` `akhir minggu` |
| Jam | `jam 9` `9:00` `9.00` `09:00` `jam 9 pagi` `9pm` `jam 14` |
| Durasi | `selama 45 menit` `for 45m` `45 min` → `duration_min` |
| Recurring | §8 |

### Kontrak parser (`core/parse.ts`, murni, `now` dioper)

```ts
parse(input: string, ctx: { now: Date; timezone: string; language: 'id'|'en' }): {
  content: string
  spans: Array<{ start: number; end: number; kind: 'date'|'time'|'duration'
                 |'recurrence'|'project'|'label'|'priority'|'mention' }>
  dueDate: string | null          // 'YYYY-MM-DD'
  dueTime: string | null          // 'HH:MM'
  durationMin: number | null
  recurrence: string | null       // RRULE subset
  projectQuery: string | null     // dari '#'; dicocokkan ke pohon DI LUAR parser
  labelNames: string[]            // dari '$'
  mentionQueries: string[]        // dari '@'; jadi chip di catatan task
  priority: 1 | 2 | 3 | null      // dari '!1'–'!4'
}
```

`spans` yang membuat penyorotan mungkin — komponen input tidak perlu
menebak-nebak posisi. Pencocokan `#project`, `$label`, dan `@task` ke entitas
nyata terjadi di luar parser (parser murni, tanpa akses data).

**`#project` tidak ketemu** → tawarkan buat project baru; tidak pernah
diam-diam dibuang. **`$label` tidak ketemu** → tawarkan buat label baru.
Tanpa `#`, task masuk Inbox.

**`p1`–`p4` bukan token** dan tetap menjadi teks judul. Ini disengaja meski
melawan memori otot Todoist: dua sintaks untuk satu makna melipatgandakan
pertanyaan "ini token atau kata biasa" yang harus dijawab parser di setiap
ketukan. Penyorotan membuat kesalahan ini terlihat seketika — dan bila
setelah dipakai ternyata tetap mengganggu, menambahkannya sebagai alias
adalah satu baris.

`Enter` menyimpan · `Shift+Enter` menyimpan dan input tetap terbuka ·
`Esc` membatalkan token terakhir, `Esc` kedua menutup.

---

## 6. View

Semua view adalah fungsi murni di `core/views.ts` atas pohon dari Dexie —
dihitung di klien, sehingga membuka app tidak menunggu jaringan.
"Hari ini" memakai **timezone user**, bukan UTC dan bukan jam device.

| View | Isi | Urutan default |
|---|---|---|
| **Inbox** | Subtree Inbox milik user, belum selesai | `rank` |
| **Today** | `due_date <= today`, belum selesai, **kedalaman berapa pun**; blok **Overdue** terpisah di atas | overdue dulu, lalu `due_time` (kosong terakhir), `priority`, `rank` |
| **Upcoming** | `due_date > today`, dikelompokkan per tanggal, dengan navigasi minggu/bulan | per tanggal, lalu seperti Today |
| **Project** | Subtree project (dengan section) | `rank` |
| **Label** | Semua task ber-label itu | `due_date`, `priority` |
| **Filter** | Hasil query tersimpan §7 | ikut query |
| **Completed** | Task selesai + occurrence recurring §8 | `completed_at DESC`, 50/halaman |
| **Search** | Judul & catatan, case-insensitive | relevansi lalu tanggal |

**Overdue selalu tampil di Today**, di blok tersendiri. Task yang lenyap
karena tanggalnya lewat adalah kegagalan yang membuat orang berhenti percaya
pada task manager.

**Upcoming tidak memuat task tanpa tanggal** — mengoreksi perilaku frontend
sekarang. Task tanpa tanggal hidup di project-nya; itulah gunanya pohon.

Setiap view punya penghitung (badge sidebar) dan **empty state** — ikon,
satu kalimat, dan aksi yang menyelesaikannya.

### ~~Pengelompokan & tampilan~~ — DIBATALKAN

> **Dibatalkan 2026-08-08** oleh
> [`docs/policy/3-product-policy.md`](../../policy/3-product-policy.md):
> Things 3 adalah acuan utama, dan di mana Things bertentangan dengan
> Todoist, Things menang.
>
> **Board (kanban) dihapus.** Things tidak punya tampilan papan sama sekali —
> ia hanya daftar. Board juga bergantung pada perenderan `kind='section'`
> yang berbentuk Todoist. Kodenya sendiri sudah dihapus di issue #20 karena
> satu-satunya jalan ke sana selalu kosong; ini menutup rencananya juga.
>
> **Grouping & sorting yang bisa dikonfigurasi dihapus.** Ini justru poros
> perbedaan keduanya: Todoist menambah kontrol, Things menggantinya dengan
> struktur yang sudah memutuskan lebih dulu apa yang pantas dilihat. Lima
> list bawaan (Inbox, Today, Upcoming, Anytime, Someday) plus Area → Project
> mengerjakan tugas yang sama tanpa satu pun menu.
>
> Rancangan aslinya dibiarkan tercoret di bawah supaya tidak diusulkan lagi
> dari nol.

~~Tiap view bisa: **grouping** (tanggal · prioritas · project · label ·
section), **sorting** (manual/`rank` · tanggal · prioritas · nama · waktu
dibuat), dan **tampilan list ↔ board**.~~

~~**Board (kanban):** kolom = `kind='section'`; task tanpa section masuk
kolom implisit tanpa judul di kiri. Kolom bisa di-rename, di-reorder,
ditambah, dihapus. Grouping alternatif di board (tanggal, prioritas)
menghasilkan kolom baca-tulis untuk field itu — menyeret kartu antar kolom
mengubah field yang dikelompokkan.~~

**Drag = ubah `parent_id` + `rank`** — implementasi yang sama persis dengan
indent di Outline. Satu perpindahan menulis satu baris.

**Menyelesaikan parent tidak menyelesaikan anak**; anak ikut tersembunyi dari
view aktif dan kembali utuh saat parent dibuka lagi.

---

## 7. Filter Tersimpan

Bahasa query kecil, di-parse `core/filter.ts` menjadi predikat murni:

```
expr   := or
or     := and ('|' and)*
and    := unary ('&' unary)*
unary  := '-' unary | '(' expr ')' | term
term   := 'today' | 'tomorrow' | 'overdue' | 'no date' | 'no priority'
        | 'no label' | 'recurring' | 'next N days'
        | '#'nama | '#'nama'*'      -- '*' = termasuk subtree
        | '$'nama | '!'[1-4]
        | 'due before: '<tanggal> | 'due after: '<tanggal>
        | 'search: '<teks>
```

```
today & !1                       →  yang mendesak hari ini
#Kerja* & -$nunggu               →  seluruh subtree Kerja, kecuali yang menunggu
(overdue | today) & $fokus
next 7 days & no priority
```

**Negasi memakai `-`, bukan `!`** — mengikuti konvensi token: `!` sudah
berarti prioritas di seluruh aplikasi, dan `-` adalah tanda negasi yang sudah
dikenal dari kotak pencarian mana pun.

Query salah tidak pernah menghasilkan halaman kosong yang membingungkan: ia
menampilkan pesan yang menunjuk posisi karakter yang gagal di-parse. Filter
tersimpan bisa difavoritkan ke sidebar.

---

## 8. Recurring

Todoist tanpa recurring bukan pengganti Todoist. Yang dibangun adalah subset
RRULE yang benar-benar diketik orang, disimpan sebagai teks kanonik:

| Diketik | Disimpan |
|---|---|
| `setiap hari` / `every day` | `FREQ=DAILY` |
| `setiap senin` / `every monday` | `FREQ=WEEKLY;BYDAY=MO` |
| `setiap hari kerja` / `every weekday` | `FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR` |
| `setiap 3 hari` / `every 3 days` | `FREQ=DAILY;INTERVAL=3` |
| `setiap minggu` / `every week` | `FREQ=WEEKLY` |
| `setiap bulan` / `every month` | `FREQ=MONTHLY` |
| `setiap tanggal 25` / `every 25th` | `FREQ=MONTHLY;BYMONTHDAY=25` |
| `setiap tahun` / `every year` | `FREQ=YEARLY` |

**Menyelesaikan task recurring tidak menutupnya** — ia memajukan `due_date`
ke kemunculan berikutnya (dan menulis `fire_at` reminder yang baru). Ini
perilaku Todoist, dan ia menghindari materialisasi ratusan baris ke depan.

Jejaknya tetap ada karena satu tabel tambahan:

```sql
CREATE TABLE completion (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  node_id      TEXT NOT NULL REFERENCES node(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL,
  occurred_on  DATE,                  -- due_date occurrence yang diselesaikan
  seq          BIGINT NOT NULL
);
```

Tanpa tabel ini, menyelesaikan task harian tidak meninggalkan apa pun di view
Completed — dan riwayat "sudah berapa hari beruntun" hilang. Ini satu-satunya
tabel tambahan yang tidak diminta langsung oleh UI, dan ia dipakai Completed,
statistik sederhana, serta konteks agent di fase 4.

Melewatkan satu kemunculan (`skip`) memajukan tanggal tanpa menulis
`completion`.

---

## 9. Reminder & Notifikasi

### Alur

```
klien membuat reminder (hitung fire_at)  →  sync naik
cron server tiap menit:
   SELECT … WHERE fire_at <= now() AND delivered_at IS NULL
            AND node belum selesai/terhapus
   → INSERT notification  → kirim Web Push ke semua subscription user
   → set delivered_at
klien: service worker menampilkan notifikasi; feed lonceng dari sync turun
```

- **Web Push (VAPID)** — satu-satunya cara notifikasi sampai ke HP saat tab
  tertutup. Di iOS berfungsi setelah app dipasang ke home screen (PWA), dan
  itu memang cara app ini dipakai.
- Endpoint: `POST /api/push/subscribe`, `POST /api/push/unsubscribe`,
  `GET /api/push/vapid-key`. Push service membalas **410 Gone** → subscription
  dihapus saat itu juga.
- **Reminder default**: task ber-jam mendapat reminder relatif (mis. 30 menit
  sebelum) bila user mengaktifkannya; task tanpa jam memakai
  `default_remind_time`.
- **Digest harian** opsional (`digest_time`): satu notifikasi berisi jumlah
  task hari ini dan yang overdue.
- Scheduler adalah `node-cron` **di dalam proses api** — tiga user tidak
  membutuhkan job runner, dan policy §2 melarang broker tanpa bukti.
  Idempoten: `delivered_at` di-set dalam transaksi yang sama, sehingga restart
  di tengah jalan tidak mengirim dua kali.
- Notifikasi juga muncul **di dalam app** (ikon lonceng yang sekarang inert),
  dari tabel `notification` yang turun lewat sync.

### Yang sengaja tidak dibangun

Notifikasi email (menunggu SMTP fase 5, dan push sudah cukup), suara/nada
kustom, dan reminder berbasis lokasi.

---

## 10. Keyboard

Mengikuti Todoist di mana konvensinya sudah ada — memori otot adalah
alasannya.

| Tombol | Aksi |
|---|---|
| `q` | Quick add dari mana saja |
| `a` | Tambah task di view aktif |
| `↑` `↓` | Pindah seleksi |
| `Enter` | Buka detail task |
| `Space` | Toggle selesai |
| `e` | Edit inline |
| `t` | Jadwalkan hari ini · `Shift+T` besok |
| `1`–`4` | Set prioritas |
| `#` `@` `$` `!` | Pemilih project · sebutan task · label · prioritas (di dalam input) |
| `⌘K` | Command palette — cari task, project, label, filter |
| `⌘Z` | Undo mutasi terakhir |
| `?` | Daftar shortcut |

**Undo menutupi mutasi terakhir dalam sesi** — selesai, hapus, reorder,
reschedule. Ia mungkin karena semua penghapusan adalah `deleted_at`, bukan
`DELETE`.

---

## 11. Migrasi Frontend

1. `data/mockData.ts` (projects, sections, labels, tasks) → store Dexie.
   `projects` dan `labels` yang di-import sebagai konstanta di lima komponen
   dialirkan lewat store.
2. Tiga skema id klien (`Date.now()`, `Math.random()`, slug) → UUIDv7 dari
   `core/id.ts`.
3. `handleMoveTask(beforeTaskId)` dan `handleReorderSections(orderedIds)`
   diterjemahkan store menjadi `rank.between(prev, next)` — komponen tidak
   perlu tahu soal rank.
4. **`MainContent.tsx` (572 baris) dipecah**: filter → `core/views.ts`, state
   → store, komponen tinggal merender. **Satu-satunya refactor frontend yang
   diizinkan** — file itu memegang tiga tanggung jawab sekaligus dan disebut
   engineering policy §4 sebagai contoh yang harus dihindari, bukan ditiru.
5. Hard delete → `deleted_at`; hapus section → **re-parent** anaknya, bukan
   `sectionId: undefined` yang mengorbankan mereka.
6. `Task.subTasks[]` di-flatten menjadi node anak; UI subtask beroperasi pada
   children.
7. Tanggal UTC (`toISOString().split('T')[0]` di sembilan file) → helper
   timezone user tunggal di `core/date.ts`.
8. `TaskDetailModal` yang memanggil `onUpdateTask` tiap ketukan tetap aman:
   outbox mengoalesk per node sebelum flush.
9. Baru di UI: manajemen label, manajemen filter, pengaturan reminder di
   detail task, izin notifikasi + registrasi service worker, penyorotan
   tanggal di quick add, grouping/sorting per view, halaman Settings
   (timezone, awal minggu, jam default, digest).

---

## 12. Testing

| Level | Alat | Cakupan |
|---|---|---|
| Unit — **wajib** | Vitest | `rank.between` (duplikat, pertumbuhan panjang, rebalance) · `tree` (indent/outdent/move lintas parent, siklus ditolak) · **`parse` sebagai tabel input→output**, termasuk `spans`, keempat sigil, harga (`$5`) dan seruan (`bagus!`) yang bukan token, kalimat yang hampir mirip token, dan dua tanggal · `recurrence` (parse + `next()` melintasi akhir bulan, tahun kabisat, DST) · `filter` (parser + predikat, query salah) · `views` (semua filter & grouping) |
| Integrasi | Vitest + Postgres asli | Sync multi-entitas (LWW, tombstone, cursor tertinggal, batch > 500) · **isolasi antar user** (kasus baru di `test/isolation.test.ts`) · scheduler reminder (idempoten, tidak dobel setelah restart, tidak menembak task terhapus) |
| E2E | Playwright | Quick add "beli tiket besok jam 9 #Travel p1" → muncul di Today dengan tanggal & jam benar → dicentang → hilang · ~~drag kartu antar kolom board~~ · buat label, pakai, rename, terlihat di semua task |

`parse` dan `recurrence` adalah dua modul yang bugnya **diam** — keduanya
wajib 100% branch coverage, seperti `rank`.

---

## 13. Success Criteria

**Parser & capture**
- [ ] "beli tiket pesawat besok jam 9 pagi #Travel $penting !1" → judul
      "beli tiket pesawat", tanggal besok, 09:00, project Travel, label
      penting, P1 — dan potongan yang dikenali tersorot sebelum Enter
- [ ] Urutan token bebas: hasilnya identik
- [ ] `Esc` mengembalikan tanggal menjadi teks judul biasa
- [ ] Kalimat yang menyebut dua tanggal memakai yang paling kanan
- [ ] Teks tak dikenali tetap utuh di judul, termasuk `p1` yang bukan token
- [ ] `#belum ada` menawarkan membuat project; `$belum ada` menawarkan label
- [ ] `@task lain` menyisipkan chip sebutan, bukan mengubah induk

**Struktur & view**
- [ ] Project nested tanpa batas; section bisa dibuat, di-rename, di-reorder,
      dihapus (anaknya di-re-parent, bukan hilang)
- [ ] Task ber-`due_date` di kedalaman 5 muncul di Today
- [ ] Overdue tampil di blok atas Today
- [ ] Upcoming tidak lagi memuat task tanpa tanggal
- [ ] ~~Grouping & sorting bekerja di list dan board; menyeret kartu antar kolom~~ **(dibatalkan — policy 3)**
      prioritas mengubah prioritasnya
- [ ] Reorder di project 500 task menulis **satu** baris
- [ ] "Hari ini" berganti di tengah malam **timezone user**, bukan UTC

**Label & filter**
- [ ] Rename label berlaku di semua task tanpa menulis ulang satu pun node
- [ ] Hapus label tidak merusak task yang memakainya
- [ ] `#Kerja* & -$nunggu` mengembalikan hasil yang benar; query salah
      menunjuk posisi karakternya

**Recurring & reminder**
- [ ] "setiap senin" → menyelesaikannya memajukan ke Senin berikutnya, task
      tetap ada, dan occurrence-nya tercatat di Completed
- [ ] `setiap tanggal 31` melewati bulan tanpa tanggal 31 dengan benar
- [ ] Reminder berbunyi di HP saat tab tertutup (PWA terpasang)
- [ ] Restart container di antara jadwal tidak mengirim notifikasi dobel
- [ ] Menghapus task membatalkan remindernya
- [ ] Subscription yang ditolak 410 terhapus otomatis

**Sync & isolasi**
- [ ] Matikan API → semua operasi tetap jalan + banner; nyalakan → konvergen
- [ ] Dua device mengedit node yang sama → `updated_at` terbaru menang di
      keduanya
- [ ] Delete saat offline tersinkron sebagai tombstone
- [ ] Refresh → pohon tampil < 300 ms dari Dexie
- [ ] **User B tidak pernah melihat node, label, filter, reminder, atau
      notifikasi milik user A — dan mendapat 404, bukan 403**

**Dogfood**
- [ ] Tiga user memakainya dari HP dan laptop
- [ ] **Dua minggu berturut-turut tanpa membuka Todoist**

---

## 14. Out of Scope (dengan alasan)

| Ditunda | Alasan & jalur naiknya |
|---|---|
| **Project berbagi antar user** | Permintaan paling mungkin berikutnya (daftar belanja bersama). Jalurnya sudah terbuka: tabel `node_share(node_id, user_id, can_edit)` + pelonggaran `WHERE` menjadi "milikku ATAU dibagikan padaku". Tidak dibangun sekarang karena ia menyeret notifikasi kolaborasi, konflik antar orang (bukan antar device sendiri), dan izin — tiga hal yang mengubah bentuk sync |
| Komentar per task | `note` markdown menutupi catatan-untuk-diri-sendiri; komentar baru bermakna setelah ada berbagi |
| Lampiran file | Menunggu fase 3 (Storage) — nanti `attachment(owner_type='node')` |
| Deadline terpisah dari due date | Todoist menambahkannya belakangan; tunggu terbukti dirindukan agar tidak ada dua tanggal yang bersaing |
| Karma, statistik, streak | Datanya sudah tersimpan di `completion`; tampilannya menyusul kalau dirindukan |
| Template project, import Todoist | Sekali pakai; CLI/skrip lebih murah daripada UI |
| Kalender sync (CalDAV/Google) | Sinkronisasi dua arah adalah proyek tersendiri |
| Notifikasi email | Menunggu SMTP fase 5; web push sudah menutupi kebutuhannya |
| Asisten AI atas task | Fase 4 — `due_time` dan `duration_min` sudah disiapkan di sini untuk time-blocking |
