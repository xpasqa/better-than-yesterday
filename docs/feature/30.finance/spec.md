# Spec: Finance (Personal + Bisnis)

**Tanggal:** 2026-08-11
**Status:** disetujui, siap ditulis plan.md
**Asal:** brainstorm 2026-08-11, dari draft "Spec Teknis — Fitur Finance v0.1"

Dokumen ini menggantikan draft v0.1 sepenuhnya. Nomor pasal draft (§2.4, §3.5,
dst) tetap dipertahankan supaya rujukan lama tidak putus, tapi isinya di sini
yang berlaku.

---

## 1. Konteks & kenapa ia boleh ada

App ini mencatat *pekerjaan*. Finance mencatat *uang*. Keduanya tidak
bersinggungan di model data sama sekali — tidak ada task yang jadi transaksi,
tidak ada transaksi yang jadi task.

`3-product-policy.md` §5 pertanyaan 1 bertanya: *"Apakah ini menambah tempat
baru untuk menyimpan atau menata sesuatu?"* Jawabannya **ya, jelas**. Aturannya
lalu bilang ia harus tunduk pada model Things — padahal Things tidak punya
konsep keuangan apa pun untuk ditunduki.

Ini masuk §4 policy: **menyimpang dari keduanya boleh, asal alasannya ditulis
di spec.** Alasannya, dan presedennya:

- Storage, Mail, Outline, dan Agent juga bukan konsep Things. Semuanya modul
  berdampingan yang memakai shell yang sama (sidebar, auth, layout) tanpa
  menyentuh model Area → Project → Task.
- Finance mengikuti bentuk yang sama persis: satu item sidebar, satu route,
  tabel sendiri, nol perubahan pada tabel `node`.

Yang **tidak** boleh dan tidak dilakukan spec ini: menyerempet model task demi
kenyamanan (transaksi sebagai node, tagihan sebagai task berulang, tag dipakai
lintas dua dunia). Begitu itu terjadi, "modul berdampingan" berubah jadi cara
kedua menata data yang sama — dan §2 policy menolaknya.

---

## 2. Empat prinsip

Kalau ragu saat implementasi, kembali ke sini. Empat aturan ini yang menentukan
seluruh isi spec.

1. **Satu tabel transaksi untuk semuanya.** Tabungan, piutang, dan uang bisnis
   bukan tabel terpisah — cuma kombinasi field yang berbeda.
2. **Saldo tidak pernah disimpan.** Semua saldo dihitung dari agregasi
   transaksi. Ini menghapus seluruh kelas bug rekonsiliasi sekaligus: edit,
   hapus, dan transaksi backdate tidak butuh langkah rekalkulasi apa pun.
3. **Dua dimensi terpisah: Akun dan Kantong.** Akun = di mana uangnya secara
   fisik. Kantong = uang itu milik siapa.
4. **Istilah teknis tidak pernah muncul di UI.** User memilih *situasi*
   ("Ngutangin", "Nabung"); sistem yang menerjemahkannya ke `type` + `pocket` +
   `account`.

---

## 3. Scope

**In:**

- Tiga tabel: `finance_account`, `finance_category`, `finance_transaction`
- Kantong `personal` dan `business`, termasuk prive (§7 aksi "Ambil dari bisnis")
- Piutang sebagai akun `receivable`, dengan daftar sisa dan penanganan §11.2/§11.3
- Target nabung (`amount` | `percent`) dan progress-nya di beranda
- Setup awal tiga pertanyaan
- Delapan aksi §7, dengan aksi yang tidak berlaku disembunyikan
- Empat tab: Beranda, Riwayat, Akun, Piutang (+ kekayaan bersih dari tab Akun)

**Out (dengan alasan):**

- **Split transaction** (satu belanja ke banyak kategori). Ini titik migrasi ke
  double-entry, bukan penambahan field — lihat §5.4. Ditunda sampai
  kebutuhannya nyata, karena migrasinya jauh lebih murah daripada membangun
  ledger untuk kebutuhan yang belum terbukti.
- **Budget/limit per kategori.** Butuh V1 dipakai sebulan penuh dulu untuk tahu
  kategori mana yang layak dibatasi. Membangunnya sekarang berarti menebak.
- **Transaksi berulang otomatis.** Sama alasannya; dan bedanya tipis dengan
  pengingat, yang sudah punya rumahnya sendiri di fitur 28.
- **Multi-currency, sync rekening bank, lampiran struk.** Tidak satu pun
  dibutuhkan untuk menjawab "berapa uang yang aman saya pakai hari ini".
- **Utang kamu ke orang lain** (kebalikan piutang, akun `payable`). Modelnya
  mirror dari piutang, jadi menambahkannya nanti murah. Tidak dipakai di V1.
- **Target tabungan bernama** ("Liburan", "Motor"). Ini fitur *goal* terpisah,
  **bukan** kantong baru dan bukan akun baru — lihat §4.3.
- **Grafik & laporan tahunan.** Beranda menjawab pertanyaan harian; grafik
  menjawab pertanyaan yang belum ada yang menanyakannya.
- **Integrasi apa pun dengan task/node.** Lihat §1.

**Rambu permanen:** jangan pernah menambah kantong baru. Kantong berhenti di
`personal` dan `business`. Semua kebutuhan "memisahkan uang" yang lain
diselesaikan lewat **akun** (§4.3) atau fitur goal.

---

## 4. Keputusan yang diambil di brainstorm

Empat pertanyaan yang draft v0.1 belum jawab, dan satu cacat yang ditemukan.

### 4.1 Server-backed, bukan local-first

App ini local-first untuk task, tag, dan completion: tulis ke Dexie dulu, lalu
antre di outbox untuk sync worker (`apps/web/src/store/db.ts` — *"the network
is never on the render path"*). Finance **tidak** ikut pola itu; ia mengikuti
Storage dan Mail, yang fetch langsung ke API.

**Kenapa:** seluruh nilai §9 (semua saldo derived) datang dari agregasi SQL atas
satu sumber kebenaran. Membuatnya local-first berarti menduplikasi setiap
agregasi di client, menambah `entityType` baru ke protokol sync, dan menangani
konflik untuk data yang justru paling tidak boleh salah. Biayanya besar,
imbalannya kecil: mencatat pengeluaran adalah aksi sengaja yang hampir selalu
terjadi saat online, tidak seperti mencentang task.

**Konsekuensi yang diterima:** tanpa koneksi, Finance tidak bisa mencatat. Ini
disebut apa adanya di UI (state error yang jelas, bukan spinner menggantung),
bukan disembunyikan.

### 4.2 Aturan §2.4 dan mapping §7 hidup di `@better/core`

Bukan di service API, bukan diduplikasi di client. Dua file baru, fungsi murni,
tanpa DB — persis pola `packages/core/src/storage-validate.ts` yang sudah ada
dan dipakai bersama `apps/web` dan `apps/api`:

```ts
// packages/core/src/finance-action.ts
buildTransaction(action, input, ctx) → TransactionDraft     // §7
// packages/core/src/finance-validate.ts
validateTransaction(draft) → Violation[]                    // §6
```

`ctx = { lastUsedAccountId, receivableAccountId, today }`.

Client memanggil `buildTransaction` untuk membentuk body dan `validateTransaction`
untuk mematikan tombol Simpan sebelum request; API memanggil
`validateTransaction` lagi sebagai penjaga sebenarnya.

**Kenapa:** §6 adalah tabel yang paling mahal kalau salah — ia yang menjaga
seluruh saldo derived tetap benar. Satu implementasi, satu set tes, dan client
tidak bisa menyimpang diam-diam dari server. Alternatif "endpoint per aksi"
ditolak karena menghasilkan delapan endpoint yang isinya varian tipis dari satu
insert, dan menambah aksi berarti menambah endpoint.

### 4.3 Akun hanya mewakili tempat yang benar-benar terpisah

Draft v0.1 mengandung kontradiksi: §3.1-nya bilang saldo akun **harus sama
persis dengan mBanking** (itu gunanya sebagai alat rekonsiliasi), tapi §4-nya
mengasumsikan ada akun "Tabungan" tujuan aksi Nabung. Kalau uang tabungan
sebenarnya duduk di rekening yang sama, Nabung memindahkan uang ke akun yang
tidak ada padanan fisiknya — dan saldo rekening itu di app langsung berhenti
cocok dengan mBanking. Alat rekonsiliasinya rusak di pemakaian pertama.

**Keputusan:** satu akun = satu tempat yang benar-benar terpisah secara fisik
(rekening lain, dompet lain, amplop lain). Karena itu:

- **"Tabungan" tidak di-seed.** Yang di-seed cuma Dompet dan Piutang (§5.1).
- `is_spendable` adalah checkbox saat user menambah akun: *"Ini tabungan —
  jangan hitung sebagai uang yang bisa dipakai."*
- **Aksi 🏦 Nabung disembunyikan selama belum ada akun non-spendable** —
  mekanisme yang sama persis dengan `business_enabled` menyembunyikan tiga aksi
  bisnis (§7).

Memisahkan tabungan *di dalam* satu rekening bukan akun dan bukan kantong — itu
fitur goal, yang §3 tunda dengan sadar.

### 4.4 Dua bisnis dibedakan lewat akun, bukan kantong

User punya rekening terpisah untuk personal, Bisnis A, dan Bisnis B. Kantong
hanya punya dua nilai dan §3 memasang rambu permanen terhadap penambahannya.

**Keputusan:** rekening Bisnis A dan Bisnis B adalah dua `finance_account`
berbeda yang sama-sama ber-`pocket = business`. Prinsip 3 sudah menangani ini
tanpa dimensi baru: saldo per bisnis = saldo per akun (§9.1), dan prive jelas
asalnya karena transfer memilih akun sumber.

Supaya ringkasan bulanan tidak mencampur keduanya, `GET /finance/summary`
menerima filter `account_id` (§8) — satu parameter query, bukan dimensi baru.

**Batas yang diterima, ditulis eksplisit:** ringkasan per bisnis lewat
`account_id` **meleset kalau biaya Bisnis B dibayar dari rekening personal** —
transaksi itu tercatat di akun personal dan tidak masuk hitungan Bisnis B.
Selama tiap bisnis memakai rekeningnya sendiri, ini tidak pernah terjadi. Kalau
nanti sering terjadi, **itu titik migrasi ke `business_id` sebagai dimensi
ketiga** (kolom nullable + tabel `finance_business`), bukan bug yang ditambal.

---

## 5. Model data

Semua tabel diawali `finance_` dan semuanya milik satu user.

### 5.1 `finance_account`

| Field | Tipe | Keterangan |
|---|---|---|
| `id` | text (UUIDv7) | PK, server-generated |
| `user_id` | text | FK `app_user.id`, `onDelete: cascade` |
| `name` | text | "BCA", "Dompet", "Bisnis A", "Piutang" |
| `kind` | text | `cash` \| `bank` \| `receivable` |
| `pocket` | text | `personal` \| `business` — kantong bawaan akun ini |
| `is_spendable` | boolean | `false` untuk tabungan & piutang (§4.3) |
| `is_system` | boolean | `true` hanya untuk akun Piutang |
| `is_archived` | boolean | default `false` |
| `sort_order` | integer | urutan tampil |
| `created_at` | timestamptz | |

`pocket` di akun adalah **default untuk form input**, bukan kebenaran tentang
uang di dalamnya. Kebenarannya tetap di kolom `from_pocket`/`to_pocket` tiap
transaksi (§9.3) — satu rekening bisa berisi uang personal *dan* bisnis, dan
§9.3 yang memecahnya. Tanpa kolom ini, user harus memilih kantong manual tiap
kali padahal 99% transaksi memakai kantong bawaan rekeningnya.

**Seed (lazy, §8):** Dompet (`cash`, `personal`, spendable) dan Piutang
(`receivable`, `personal`, `is_spendable=false`, `is_system=true`). Akun
`is_system` tidak bisa dihapus maupun di-rename. Akun bank diisi user.

### 5.2 `finance_category`

| Field | Tipe | Keterangan |
|---|---|---|
| `id` | text (UUIDv7) | PK |
| `user_id` | text | FK, cascade |
| `name` | text | |
| `type` | text | `income` \| `expense` |
| `icon` | text | nullable |
| `is_archived` | boolean | |
| `sort_order` | integer | |

**Seed default:**
*Income:* Gaji, Bonus, Project, Lain-lain.
*Expense:* Makan, Transport, Tagihan, Belanja, Hiburan, Kesehatan, Relasi,
Lain-lain.

Transaksi `transfer` **tidak punya kategori** (`category_id = null`).

### 5.3 `finance_transaction`

| Field | Tipe | Nullable | Keterangan |
|---|---|---|---|
| `id` | text (UUIDv7) | ✗ | PK |
| `user_id` | text | ✗ | FK, cascade |
| `date` | date | ✗ | **DATE, bukan timestamp** — §11.7 |
| `type` | text | ✗ | `income` \| `expense` \| `transfer` |
| `amount` | bigint | ✗ | rupiah bulat, **selalu positif** |
| `category_id` | text | ✓ | null jika `transfer` |
| `from_account_id` | text | ✓ | null jika `income` |
| `from_pocket` | text | ✓ | null jika `income` |
| `to_account_id` | text | ✓ | null jika `expense` |
| `to_pocket` | text | ✓ | null jika `expense` |
| `counterparty` | text | ✓ | nama orang (piutang) / nama project |
| `note` | text | ✓ | |
| `idempotency_key` | text | ✓ | §8 |
| `deleted_at` | timestamptz | ✓ | soft delete |
| `created_at` | timestamptz | ✗ | |
| `updated_at` | timestamptz | ✗ | |

`pocket` sengaja kolom teks ber-`check`, bukan tabel — nilainya berhenti di dua
selamanya (§3).

**Indeks:**
`(user_id, date DESC)` · `(user_id, from_account_id)` ·
`(user_id, to_account_id)` · `(user_id, counterparty)` ·
`(user_id, date, from_pocket)` · **unique** `(user_id, idempotency_key)`.

**Soft delete:** setiap agregasi di §9 dan setiap listing menambahkan
`deleted_at IS NULL`. Ini juga yang membuat §11.2 bisa dibatalkan kalau user
salah pilih.

### 5.4 Kenapa satu baris, bukan double-entry

Transfer disimpan sebagai **satu baris** dengan pasangan `from`/`to`, bukan dua
baris ledger. Konsekuensinya: edit dan hapus jadi operasi tunggal (tidak ada
risiko baris yatim), dan query saldo tetap sederhana.

Trade-off-nya: bentuk ini tidak cocok kalau nanti butuh split transaction. Kalau
kebutuhan itu muncul, **itu titik migrasi ke ledger** — bukan sekarang.

### 5.5 Setting menempel di `app_user`

Tiga kolom baru di tabel `app_user`, bukan tabel setting sendiri:

```
finance_business_enabled     boolean  default false
finance_savings_target_mode  text     nullable   -- 'amount' | 'percent'
finance_savings_target_value bigint   nullable
```

**Kenapa:** persis pola yang sudah ada — `storage_quota_bytes`, `timezone`,
`week_start` semuanya kolom preferensi di `app_user`. Konsekuensi
menyenangkannya, ketiganya ikut `PATCH /api/me` yang sudah ada, jadi Finance
tidak butuh endpoint setting sama sekali.

`timezone` di tabel yang sama juga yang dipakai §11.7 untuk menentukan "hari
ini" saat menyimpan `date`.

**Soal mode target:** `amount` berarti target rupiah tetap per bulan; `percent`
berarti target = persen × **Masuk** bulan berjalan (§9.5), dihitung ulang tiap
kali beranda dibuka. `percent` lebih tahan banting kalau income tidak tetap —
dan dengan adanya kantong bisnis, kemungkinan besar memang begitu. Targetnya
ikut turun di bulan sepi, jadi progress bar tidak selalu merah dan user tidak
berhenti memakai app-nya.

---

## 6. Invariant (§2.4 draft)

Ditegakkan di `validateTransaction` (§4.2), **bukan** cuma sebagai constraint DB
— karena pesan kesalahannya harus bisa muncul di form sebelum request dikirim.

| `type` | `from_*` | `to_*` | `category_id` |
|---|---|---|---|
| `income` | harus null | harus terisi | wajib, kategori ber-`type=income` |
| `expense` | harus terisi | harus null | wajib, kategori ber-`type=expense` |
| `transfer` | harus terisi | harus terisi | harus null |

Aturan tambahan:

- `amount > 0` selalu. Arah uang ditentukan `type`, bukan tanda minus.
- Untuk `transfer`: `from_account_id ≠ to_account_id` **ATAU**
  `from_pocket ≠ to_pocket`. Transfer ke diri sendiri persis = ditolak.
- Transaksi yang menyentuh akun `receivable` **wajib** mengisi `counterparty`.
- `date` tidak boleh lebih dari 1 hari di masa depan (toleransi timezone).
- Akun dan kategori ber-`is_archived = true` tidak boleh dipakai untuk transaksi
  **baru**, tapi tetap sah di transaksi lama (§11.6).

DB tetap memasang `check` untuk enum (`type`, `pocket`, `kind`) dan
`amount > 0` sebagai jaring terakhir. Bentuk `from`/`to` per tipe tidak
di-`check` di DB — aturannya kondisional dan lebih jelas dibaca sebagai kode.

---

## 7. Pemetaan aksi UI → data

Kontrak antara UI dan `buildTransaction`. User tidak pernah melihat kolom kanan.

| Aksi UI | Input user | `type` | `from` | `to` | `category` |
|---|---|---|---|---|---|
| **🛒 Pengeluaran** *(default)* | jumlah, kategori | `expense` | akun terakhir / `personal` | — | pilihan user |
| **💰 Gajian** | jumlah, akun | `income` | — | akun / `personal` | Gaji |
| **🏦 Nabung** | jumlah, dari, ke | `transfer` | akun / `personal` | akun non-spendable / `personal` | — |
| **🤝 Ngutangin** | jumlah, nama | `transfer` | akun / `personal` | Piutang / `personal` | — |
| **✅ Utang dibayar** | nama, jumlah | `transfer` | Piutang / `personal` | akun / `personal` | — |
| **📦 Project cair** | jumlah, nama project, akun | `income` | — | akun / `business` | Project |
| **🔁 Ambil dari bisnis** | jumlah, dari, ke | `transfer` | akun / `business` | akun / `personal` | — |
| **💸 Biaya bisnis** | jumlah, kategori, akun | `expense` | akun / `business` | — | pilihan user |

Default alur cepat: `type = expense`, `pocket = personal`,
`account = akun terakhir dipakai`, `date = hari ini`. User hanya menyentuh
jumlah dan kategori.

**Aksi yang tidak berlaku tidak ditampilkan sama sekali** (bukan disabled):

- Tiga aksi bisnis muncul hanya bila `finance_business_enabled = true`
- 🏦 Nabung muncul hanya bila ada akun `is_spendable = false` non-sistem (§4.3)

Model datanya tetap sama di kedua keadaan — user yang berubah pikiran soal
punya usaha tidak butuh migrasi apa pun, cuma menyalakan toggle.

---

## 8. API

Modul `apps/api/src/modules/finance/`, di-mount `app.route('/api', financeRoutes)`
seperti empat modul lain.

```
GET    /finance/overview                                   §9.4 + §9.5 + progress + chip
GET    /finance/summary      ?month&pocket&account_id      §9.5
GET    /finance/accounts                                   §9.1 + §9.3
GET    /finance/receivables                                §9.6
GET    /finance/networth                                   §9.7
GET    /finance/transactions ?month&pocket&account_id&cursor
POST   /finance/transactions                               header Idempotency-Key
PATCH  /finance/transactions/:id
DELETE /finance/transactions/:id  ?cascade=one|all         §11.2
POST   /finance/accounts    ·  PATCH :id  ·  DELETE :id → is_archived
GET    /finance/categories  ·  POST  ·  PATCH :id  ·  DELETE :id → is_archived
```

`/finance/overview` ada supaya beranda cukup satu round-trip. Isinya
`spendable_personal`, ringkasan bulan berjalan, progress target, dan chip ringkas
(`piutang_total`, `business_total`) — chip hanya dikirim kalau nilainya ≠ 0.

**Setting tidak punya endpoint sendiri** — `finance_business_enabled` dan target
nabung ikut `PATCH /api/me` yang sudah ada (§5.5).

**Idempotency:** `POST` menerima header `Idempotency-Key`; kuncinya disimpan
sebagai kolom pada transaksi dengan unique index, bukan tabel terpisah. POST
ulang dengan kunci sama mengembalikan **baris yang sudah ada dengan 200**, bukan
error — alur input cepat rawan double-submit di koneksi jelek, dan duplikat diam
adalah kegagalan yang paling sulit disadari user.

**Seed lazy, bukan migrasi.** `ensureFinanceSeed(userId)` dipanggil di awal tiap
request finance dan membuat Dompet + Piutang + 12 kategori bila belum ada —
persis pola `getOrCreatePersonalArea` di modul storage. User lama tidak butuh
backfill; user baru tidak butuh langkah ekstra.

**Bentuk respons mengikuti tipe frontend**, bukan kolom DB (CLAUDE.md: frontend
types adalah kontrak). `is_archived` → `isArchived`, `from_account_id` →
`fromAccountId`, dan `amount` sampai ke client sebagai `number` rupiah bulat —
bukan string bigint. Aman karena rupiah bulat jauh di bawah `Number.MAX_SAFE_INTEGER`.

---

## 9. Perhitungan — semuanya derived

Semua query di bagian ini difilter `user_id = ?` **dan** `deleted_at IS NULL`.

### 9.1 Saldo per akun

```
saldo(account) = SUM(amount) WHERE to_account_id   = account
               − SUM(amount) WHERE from_account_id = account
```

Berlaku untuk semua `type` sekaligus — `income`/`transfer` masuk lewat `to_`,
`expense`/`transfer` keluar lewat `from_`. Tidak perlu percabangan per tipe.

Angka ini harus **sama persis** dengan mBanking atau isi dompet fisik. Itu
gunanya, dan itu alasan §4.3 melarang akun yang tidak punya padanan fisik.

### 9.2 Saldo per kantong

Rumus identik, `account_id` → `pocket`.

Konsekuensi yang perlu dipahami: transfer *dalam* kantong yang sama (nabung:
BCA → Tabungan, dua-duanya `personal`) tidak mengubah saldo kantong sama sekali.
Yang mengubah saldo kantong hanya transfer **lintas kantong** — yaitu prive.

### 9.3 Saldo per akun × kantong

`GROUP BY account_id, pocket`. Ini yang menyelesaikan kasus rekening yang kadang
campur kadang pisah: user mengisi apa adanya, sistem yang memecah.

### 9.4 Headline "Uang kamu"

```
spendable_personal = Σ saldo(account, pocket='personal')
                     WHERE account.is_spendable = true
```

Angka besar di beranda. Sengaja **mengecualikan** tabungan dan piutang: user
butuh tahu berapa yang aman dipakai hari ini, bukan total kekayaan.

### 9.5 Ringkasan bulanan

Parameter `pocket` default `personal`; `account_id` opsional untuk ringkasan per
bisnis (§4.4).

```
Masuk     = Σ income   WHERE to_pocket   = :pocket
          + Σ transfer WHERE to_pocket   = :pocket AND from_pocket <> :pocket   -- prive
Keluar    = Σ expense  WHERE from_pocket = :pocket
          + Σ transfer WHERE from_pocket = :pocket AND to_pocket   <> :pocket   -- prive keluar
Tersimpan = Masuk − Keluar
```

Untuk `pocket = 'personal'` baris "prive keluar" selalu nol dalam pemakaian
normal (uang personal tidak disetor balik ke bisnis), tapi ia ditulis eksplisit
supaya rumusnya benar untuk `pocket = 'business'` juga — di situ prive justru
*adalah* keluarnya.

Bila `account_id` diisi, tiap baris menambah `AND to_account_id = :acc`
(untuk baris Masuk) atau `AND from_account_id = :acc` (untuk baris Keluar).

Tiga hal yang **sengaja tidak** dihitung sebagai Keluar, dan ini inti seluruh
desain:

- **Nabung** → `transfer`, bukan `expense`
- **Ngutangin** → `transfer` ke akun Piutang
- **Omzet bisnis** → `income` di kantong `business`; baru masuk hitungan
  personal saat ditarik jadi prive

### 9.6 Daftar piutang

```sql
SELECT counterparty,
       SUM(CASE WHEN to_account_id = :piutang THEN amount ELSE -amount END) AS sisa
FROM finance_transaction
WHERE :piutang IN (from_account_id, to_account_id)
  AND user_id = :user AND deleted_at IS NULL
GROUP BY counterparty
HAVING sisa <> 0
```

Tidak ada kolom status lunas/belum. `sisa = 0` **berarti** lunas, dan barisnya
otomatis hilang dari daftar. Satu sumber kebenaran, tidak ada state yang bisa
desinkron.

### 9.7 Kekayaan bersih

`Σ saldo semua akun`, termasuk tabungan dan piutang. Halaman terpisah yang
dibuka dari tab Akun — bukan angka beranda, supaya tidak bersaing dengan §9.4.

---

## 10. UI

### 10.1 Navigasi

Satu item **Finance** di sidebar tepat di bawah Storage (`WalletIcon`), route
`/finance` dengan empat tab: **Beranda · Riwayat · Akun · Piutang**. Kekayaan
bersih dibuka dari tab Akun; tab kelima cuma menggodanya jadi angka harian.

`deriveViewFromPathname` (`apps/web/src/routes.ts`) sekarang hanya mengenal dua
segmen untuk `/project/:id`. Ia menambah satu field `sub: string | null` supaya
`/finance/riwayat`, `/finance/akun`, dan `/finance/piutang` punya alamat
sungguhan — spec induk §8 menetapkan tiap view punya alamat nyata, dan menyimpan
tab di `useState` akan membuat tab Finance jadi satu-satunya layar yang tidak
bisa di-bookmark. `ViewType` bertambah `'finance'`.

### 10.2 Input

Tombol `+` membuka **daftar situasi** (§7), user memilih satu, lalu muncul form
yang field-nya sudah pas untuk situasi itu. Aksi yang tidak berlaku tidak muncul.

Alur ini dipilih ketimbang keypad-dengan-chip karena tiap situasi butuh
kombinasi field yang berbeda (Ngutangin butuh nama, Nabung butuh dua akun,
Gajian butuh akun tujuan) — satu layar yang menukar-nukar field untuk sembilan
kasus lebih sulit dibaca *dan* lebih sulit dites daripada delapan form kecil
yang masing-masing eksplisit. Harganya satu ketukan ekstra pada alur 90%, dan
itu diterima.

### 10.3 Tampilan angka

Rupiah bulat, format `id-ID`, tanpa desimal. Saldo negatif ditampilkan merah,
tidak pernah diblokir (§11.4).

### 10.4 Setup awal

Tiga pertanyaan, sisanya default. Target < 1 menit. Muncul saat user membuka
Finance dan belum punya akun selain hasil seed.

1. Punya rekening apa? → buat `finance_account` (Dompet sudah pre-filled;
   tiap akun punya checkbox *"ini tabungan"* dan pilihan kantong bila bisnis
   sudah dinyalakan)
2. Punya usaha / project sampingan? → `finance_business_enabled`
3. Target nabung per bulan? → `finance_savings_target_*`, boleh di-skip

### 10.5 Offline

Finance butuh koneksi (§4.1). Saat request gagal karena jaringan, UI menampilkan
state yang menyebutkannya apa adanya dan menyediakan tombol coba lagi — bukan
spinner yang menggantung, dan bukan form yang menerima input lalu membuangnya.

---

## 11. Edge case

**11.1 Edit transaksi apa pun** — cukup update baris. Karena saldo tidak pernah
disimpan (prinsip 2), tidak ada yang perlu direkalkulasi. Ini alasan utama
desain ini dipilih.

**11.2 Hapus pinjaman yang sudah dibayar sebagian** — akan membuat sisa piutang
orang itu negatif. **Jangan blokir, tapi jangan menebak juga.**

`DELETE` sebuah transaksi piutang yang counterparty-nya masih punya transaksi
lain membalas `409 CONFIRM_REQUIRED` beserta `{ counterparty, otherCount,
otherTotal }`. Client menampilkan konfirmasi — *"Budi masih punya catatan
pembayaran Rp 200.000. Hapus juga?"* — lalu mengulang request dengan
`?cascade=all` (hapus semua transaksi counterparty itu) atau `?cascade=one`
(hapus satu saja). Server tidak pernah memutuskan sendiri.

Saldo negatif yang tersisa tetap ditampilkan merah sebagai sinyal salah input.

**11.3 Utang diikhlaskan** — **jangan hapus** transaksi aslinya. Buat transaksi
baru: `expense` dari akun Piutang, kategori Relasi, `counterparty` = nama orang.
Efeknya sisa piutang jadi 0 (hilang dari daftar) dan angkanya masuk ke Keluar
bulan ini — yang memang benar secara akuntansi. Tombol "Ikhlaskan" di detail
piutang cuma pintasan yang membentuk transaksi itu; nol kode baru di service.

**11.4 Saldo akun negatif** — diizinkan, ditampilkan merah. Hampir selalu berarti
ada transaksi yang lupa dicatat, bukan error sistem. Memblokirnya justru membuat
user berhenti mencatat.

**11.5 Transaksi backdate / lintas bulan** — bebas. Tidak ada snapshot bulanan
yang perlu di-invalidate.

**11.6 Hapus akun atau kategori yang masih punya transaksi** — **tidak boleh**,
hanya `is_archived = true`. Yang terarsip hilang dari dropdown input tapi tetap
muncul di riwayat lama. Akun `is_system` (Piutang) tidak bisa diarsipkan
sekalipun.

**11.7 Timezone** — `date` disimpan sebagai DATE lokal user (dari
`app_user.timezone`), bukan timestamp UTC. Alasannya: transaksi jam 23:00 WIB
kalau disimpan UTC jatuh ke tanggal — dan bisa bulan — sebelumnya, dan ringkasan
bulanan jadi meleset. Timestamp presisi tetap ada di `created_at` untuk audit.

**11.8 Pembulatan** — `amount` bigint rupiah bulat: tidak ada desimal, tidak ada
float. Tidak ada operasi pembagian dalam perhitungan saldo, jadi tidak ada
masalah pembulatan sama sekali. Progress target (§9.5) memang membagi, tapi
hasilnya cuma dipakai untuk lebar progress bar — tidak pernah kembali jadi uang.

**11.9 Performa** — full scan agregasi aman sampai puluhan ribu baris. Kalau
nanti terasa lambat, solusinya cache di layer aplikasi atau materialized view
bulanan — **bukan** menyimpan kolom saldo di tabel akun. Jangan pernah langgar
prinsip 2.

---

## 12. Tes

Tiga lapis, masing-masing menjawab pertanyaan yang berbeda.

**`@better/core` (vitest, tanpa DB)** — satu kasus tes per baris tabel §6 dan
per baris tabel §7. Ini lapis paling murah dan paling penting: §6 adalah aturan
yang menjaga seluruh saldo derived tetap benar.

**Integrasi API** — §9.1 sampai §9.6 di atas data yang disiapkan, plus dua tes
yang menjaga prinsip desain:

1. Edit dan hapus transaksi, lalu pastikan saldo ikut berubah **tanpa langkah
   rekalkulasi apa pun** (penjaga prinsip 2).
2. POST dua kali dengan `Idempotency-Key` sama menghasilkan satu baris.

**E2E Playwright** — satu alur 90%: buka Finance → catat pengeluaran → angka
beranda berubah. Bukan menguji ulang perhitungan, tapi memastikan rantai
UI → core → API → agregasi benar-benar tersambung.

---

## 13. Urutan implementasi

Dipecah jadi blok yang masing-masing bisa diverifikasi sendiri. Urutan ini yang
akan jadi issue detail di epic.

- **A. Skema & seed** — tiga tabel + indeks + `check`, tiga kolom di `app_user`,
  `ensureFinanceSeed`
- **B. Core** — `finance-action.ts`, `finance-validate.ts`, dan tesnya
- **C. Query agregasi** — §9.1–9.7 sebagai fungsi service + tes integrasi
- **D. Endpoint baca** — `/overview`, `/summary`, `/accounts`, `/receivables`,
  `/networth`, `/transactions`
- **E. Endpoint tulis** — CRUD transaksi + idempotency + `?cascade` (§11.2),
  CRUD akun & kategori
- **F. Shell UI** — item sidebar, route + `sub`, `FinanceView` empat tab
- **G. Beranda** — headline, ringkasan, progress target, chip
- **H. Input** — daftar situasi + delapan form (§7, §10.2)
- **I. Akun, piutang, kekayaan bersih** — termasuk dialog §11.2 dan tombol
  Ikhlaskan §11.3
- **J. Setup awal** — §10.4, plus toggle `business_enabled` di settings
- **K. E2E** — §12 lapis ketiga
