# Spec: Backend Outline — Workflowy yang Terhubung ke Task

> Pohon teks yang bisa di-zoom, dengan dua cara terhubung ke Todo: sebuah
> baris **bisa menjadi** task, dan sebuah baris **bisa menyebut** task lain
> lewat `@` — lengkap dengan status dan progresnya.

**Status:** v1 · **Fase:** 2 · **Bergantung pada:**
[1.todo](../1.todo/spec.md) · [0.infrastructure](../0.infrastructure/spec.md) ·
[spec induk](../spec.md) — keputusan pokok, konvensi token

---

## 1. Objective

Menggantikan Workflowy untuk catatan harian, dan membuat catatan itu
menyatu dengan pekerjaan — bukan hidup di aplikasi sebelah.

Fase ini **tidak menambah satu pun tabel dan satu pun migrasi**. Pohonnya
sudah dibangun di fase 1; yang dikerjakan di sini adalah cara mengedit,
menelusuri, dan merujuknya. Itulah bayaran dari keputusan "satu pohon"
([spec induk §2.1](../spec.md)) — dan kalau spec ini terasa pendek untuk
fitur sebesar Workflowy, itu sebabnya.

---

## 2. Dua Cara Terhubung — dan kapan memakai yang mana

Ini bagian terpenting spec ini. Permintaan Anda ("di Workflowy bisa manggil
task") sebenarnya punya dua bentuk, dan keduanya dibangun:

### 2.1 Struktural — barisnya **adalah** task

Di model ini tidak ada dinding antara catatan dan task. Sebuah baris outline
yang diberi tanggal **berubah menjadi** task dan langsung muncul di Today —
tanpa membuat apa pun, tanpa menautkan apa pun.

```
Riset kompetitor
├─ baca laporan McKinsey        ⌘+T →  besok        →  muncul di Today
└─ ringkas jadi 1 halaman
```

Inilah alasan awal proyek ini ada: *"ketika saya punya sebuah idea dan
menulisnya, saya bisa mengaitkan link node outline ini ke todo."* Di model
terpadu, "mengaitkan" tidak diperlukan lagi — idenya sendiri yang naik pangkat
menjadi pekerjaan.

Dipakai saat: **pekerjaan itu lahir di catatan ini**.

### 2.2 Referensial — barisnya **menyebut** task yang tinggal di tempat lain

Persis yang Anda tulis:

```
Hari ini kerjain project @Bikin spec produk    3/7 · besok
```

`@` menyisipkan rujukan hidup ke node lain di mana pun ia berada. Yang tampil
bukan teks mati, melainkan **chip yang menyala**: judul terkini, kotak
centang, tanggal, prioritas, dan **progres** `3/7`.

Dipakai saat: **pekerjaannya sudah ada di project lain**, dan catatan hari ini
hanya menunjuknya.

> Aturan praktisnya satu kalimat: *tulis di tempat pekerjaannya tinggal,
> sebut dari tempat Anda sedang berpikir.*

---

## 3. Mention `@`

### 3.1 Sigil

`@` berarti **sebutan** — di sini, di quick add Todo, dan di komposer Agent.
Tidak ada permukaan di mana ia berarti sesuatu yang lain. Selengkapnya di
[konvensi token](../spec.md):

| Sigil | Di dalam baris outline |
|---|---|
| `@` | Sebut task/project lain → chip hidup §3.3 |
| `$` | Tempelkan label ke baris ini |
| `!` | Beri prioritas 1–4 pada baris ini (dan baris itu menjadi task) |
| `#` | **Dibatalkan** — lihat catatan di bawah. Melahirkan task tertaut lewat popup, bukan memindahkan baris |

Pemilih `@` mencari seluruh pohon dan menampilkan breadcrumb tiap kandidat,
sehingga dua task bernama mirip di project berbeda bisa dibedakan sebelum
dipilih.

> **Dibatalkan (docs/feature/32.outline-task-decoupling/spec.md §4, 2026-08-12):**
> baris di atas melarang `#` di outline dengan alasan "sebuah baris outline
> sudah punya tempatnya" — itu berlaku ketika setiap baris outline *adalah*
> task Todo. Sejak `kind='note'` (feature #32), baris outline default tidak
> punya tempat di Todo sama sekali, jadi `#` berhenti berarti "pindahkan" dan
> mulai berarti "lahirkan task tertaut di sana", lewat popup — bukan
> `Tab`/`Shift+Tab`/seret. Lihat spec #32 §4 untuk alur lengkapnya.

### 3.2 Format penyimpanan

Mention disimpan **inline di dalam `content`**, memakai sintaks link markdown:

```
Hari ini kerjain project @[Bikin spec produk](01931f7c-…)
```

Tiga alasan format ini, bukan tabel relasi:

1. **Tidak ada yang bisa melenceng.** Teks itu sendiri adalah kebenarannya —
   tidak ada baris relasi yang bisa tertinggal saat teksnya diedit.
2. **Tidak ada entitas sync baru.** `/sync` tetap membawa node apa adanya.
3. **Tetap greppable dan markdown**, sesuai prinsip proyek: tidak ada format
   milik editor di mana pun.

Yang disimpan adalah **id**, sehingga mengganti nama task otomatis mengubah
semua penyebutannya. Label di dalam kurung siku hanya cadangan — dipakai saat
targetnya hilang, supaya yang tampil "Bikin spec produk *(dihapus)*", bukan
sebaris uuid.

Indeks backlink **diturunkan di klien** (Dexie multi-entry index atas id yang
diekstrak saat menulis node). Server tidak perlu tahu apa-apa soal mention.

### 3.3 Yang tampil di chip

| Bagian | Isi |
|---|---|
| Kotak centang | Status task; **bisa dicentang langsung dari sini** |
| Judul | Nama terkini node target (bukan yang disimpan) |
| Progres | `3/7` bila punya keturunan — §4 |
| Tanggal | Chip tanggal bila ada, merah bila overdue |
| Prioritas | Titik warna P1–P3 |
| Klik | Zoom ke node itu (`⌘`+klik: buka detail task) |

Chip yang menyebut **project** menampilkan progres agregat project itu — inilah
"lihat progres udah sampai mana" untuk sesuatu yang besar.

### 3.4 Mention yang bisa dibentangkan — usulan tambahan

Chip punya segitiga kecil. Membentangkannya menampilkan **anak-anak node
target, langsung di tempat**, tanpa berpindah halaman:

```
Hari ini kerjain project @Bikin spec produk   3/7 · besok   ▾
    ☑ kumpulkan referensi
    ☑ kerangka bab
    ☐ tulis bagian metode
```

Ini versi ringan dari *mirror* Workflowy — fitur yang paling dicintai dan
paling mahal di sana. Yang membuatnya murah di sini: seluruh pohon sudah ada
di Dexie, jadi merendernya di titik mana pun tidak butuh apa-apa lagi.

Batasnya ditarik dengan sengaja: **di dalam bentangan boleh mencentang, tidak
boleh mengubah struktur** (tidak ada Enter/Tab/reorder). Mencentang tidak
ambigu — hasilnya sama dari mana pun dilakukan. Sementara menyisipkan baris
"di dalam mirror" memunculkan pertanyaan yang tak berjawab murah: ia masuk ke
pohon yang mana. Menyunting isinya dilakukan dengan mengklik chip dan zoom ke
sana — satu klik, dan tempatnya jelas.

Bentangan dibatasi kedalaman 3 tingkat, dan sebuah node tidak pernah
dibentangkan dua kali dalam satu jalur render — pagar sederhana terhadap
lingkaran (A menyebut B, B menyebut A).

---

## 4. Progres

Satu aturan, berlaku di mana saja — chip mention, baris outline, judul saat
zoom:

> **progres = keturunan yang selesai ÷ seluruh keturunan `kind='item'`**
> (yang tidak terhapus), dihitung seluruh kedalaman.

Ditampilkan `3/7`, ditambah bilah tipis saat node sedang di-zoom. Node tanpa
keturunan tidak menampilkan apa-apa — bukan `0/0`.

Dihitung di `core/progress.ts` sebagai fungsi murni atas pohon; tidak ada
kolom yang disimpan, jadi tidak ada yang bisa basi.

---

## 5. Backlink — arah sebaliknya

Karena mention adalah teks, arah baliknya adalah pencarian atas indeks yang
diturunkan tadi:

- **Di detail task**: bagian "Disebut di **3** tempat", tiap baris dengan
  breadcrumb induknya; mengkliknya zoom ke baris itu.
- **Di baris outline**: badge `↗ 3` bila baris itu disebut di tempat lain.

Tidak ada yang disimpan, jadi backlink tidak bisa basi.

---

## 6. Merender & Menyunting

Tiga aturan ini yang membuat fitur sebesar Workflowy tetap kecil:

- **Node yang sedang difokus adalah `<input>` biasa; semua node lain adalah
  teks statis. Tepat satu `<input>` ada di DOM pada satu waktu.**
  `contenteditable` membawa perilaku caret yang berbeda antar browser dan
  ekor kasus tepi yang tak habis — dan hampir seluruh kerumitan yang dulu
  diperkirakan untuk fitur ini sebenarnya ada untuk menambal itu.
- Node yang tidak difokus merender **markdown inline**: `**tebal**`,
  `*miring*`, `` `kode` ``, `~~coret~~`, `[teks](url)`, dan chip mention.
  Yang difokus menampilkan sumber mentahnya.
- **Tidak pernah `dangerouslySetInnerHTML`.** Markdown dirender menjadi node
  React, sehingga `<img onerror=…>` yang ter-paste tidak punya jalan
  mengeksekusi apa pun.
- Satu node = satu baris. `Enter` membuat node baru, bukan baris baru.
- **Catatan multi-baris** ada di kolom `note` (sudah ada sejak fase 1),
  dibuka dengan `Shift+Enter` — teks kecil abu-abu di bawah barisnya. Ini
  juga field `description` yang sama dengan yang dipakai detail task.

Menyimpan: saat blur, dan debounce 500 ms saat mengetik — supaya menutup tab
tidak menghilangkan kalimat terakhir.

---

## 7. Keyboard

| Tombol | Prasyarat | Hasil |
|---|---|---|
| `Enter` | — | Sisipkan sibling kosong **setelah** node ini, fokus ke sana |
| `Shift+Enter` | — | Buka/tutup catatan node |
| `Tab` | Ada sibling sebelumnya | Jadi **anak terakhir** sibling itu, membawa anak-anaknya |
| `Shift+Tab` | Punya induk | Jadi **sibling berikutnya** induknya, membawa anak-anaknya |
| `Backspace` | Caret di awal, isi kosong, tanpa anak | Hapus; fokus ke node terlihat sebelumnya |
| `↑` `↓` | — | Fokus ke node **terlihat** sebelum/sesudahnya |
| `⌘↑` `⌘↓` | Ada sibling ke arah itu | Tukar posisi; anak-anak ikut |
| `⌘.` | Punya anak | Buka/tutup |
| `⌘⏎` | — | Toggle selesai |
| `⌘T` | — | Beri tanggal (baris ini menjadi task) |
| `@` `$` `!` | — | Sebutan · label · prioritas §3.1 |
| `Esc` | — | Blur; commit; render markdown |

Yang **tidak** ada, dan alasannya: **tidak ada pemisahan node di tengah teks**
pada `Enter`, dan **tidak ada penggabungan saat `Backspace`**. Keduanya
sengaja dibuang — penggabungan dua node adalah operasi yang paling mungkin
menghilangkan karakter secara diam-diam. Keduanya bisa ditambahkan nanti bila
pemakaian harian membuktikan mereka dirindukan.

---

## 8. Zoom, dan Router yang Harus Ditambahkan

Zoom adalah cara Workflowy dipakai, bukan fitur tambahan: `/outline/{nodeId}`
menampilkan node itu sebagai akar, dengan leluhurnya sebagai breadcrumb yang
bisa diklik. Mengklik bulatan mana pun berarti zoom.

**Zoom adalah routing, bukan state** — URL-nya bisa dikirim, tombol back
bekerja, dan sebuah baris bisa dibuka langsung dari mention. Ini hanya mungkin
karena tiap node adalah baris database.

**Temuan yang harus dieksekusi di fase ini:** aplikasi sekarang **tidak punya
router sama sekali** — `App.tsx` berpindah view dengan `useState`. Jadi fase
ini memasang router untuk seluruh aplikasi, bukan hanya outline:

```
/today  /upcoming  /inbox  /project/:id  /label/:name  /filter/:id
/outline  /outline/:nodeId  /storage  /agent  /mail  /settings
```

Ini juga yang membuat notifikasi push fase 1 bisa membuka task yang tepat saat
diklik, dan membuat PWA punya alamat yang masuk akal.

---

## 9. Tampilan Akar & Hubungannya dengan Project

Outline menampilkan **seluruh pohon** — termasuk project Todo Anda. Zoom ke
sebuah project berarti melihat task-task yang *sudah* task-nya sebagai baris
outline yang bisa di-indent; menyunting task yang sudah ada di sana langsung
terlihat di Today dan Board. Inilah wujud paling langsung dari janji "satu
pohon".

Supaya level akar tetap tenang: **akar dirender tertutup**, dan ada satu
sakelar *sembunyikan project* bagi yang ingin outline berisi catatan saja.
Node akar biasa (bukan `kind='project'`) adalah dokumen catatan — ia tidak
punya warna dan tidak muncul di daftar project sidebar.

> **Diperbarui (docs/feature/32.outline-task-decoupling/spec.md, 2026-08-12):**
> "satu pohon" tidak lagi berarti "satu keanggotaan". Baris **baru** yang
> diketik di Outline — termasuk saat sedang zoom ke dalam sebuah project —
> dibuat `kind='note'` dan **tidak** muncul di Today/Board/dst sampai
> ditandai `#project` secara eksplisit lewat popup. Konsistensi ini disengaja:
> tidak ada baris outline yang pernah jadi task tanpa aksi eksplisit, di mana
> pun ia ditulis. Task yang sudah ada (`kind='item'`) tetap tampil dan bisa
> disunting persis seperti sebelumnya. Lihat spec #32 §2 (prinsip 2) dan §9
> (out-of-scope) untuk alasan lengkapnya.

---

## 10. Pencarian & Penyaringan di Dalam Outline

- Pencarian dalam pohon yang sedang tampak, menyorot kecocokan dan otomatis
  membuka induk yang menutupinya.
- Sakelar **sembunyikan yang sudah selesai**, tersimpan per node.
- `⌘K` global (fase 1) sudah mencakup pencarian lintas task dan baris outline.

---

## 11. iPad & Ponsel

**Papan ketik lunak iPad tidak punya `Tab`.** iPad adalah perangkat sasaran,
jadi ini keharusan, bukan pelengkap — dan ini hal yang paling mudah terlupa
dan paling menjengkelkan bila ditemukan terlambat.

Saat sebuah node difokus, toolbar menempel di atas papan ketik:

`⇤ outdent` · `⇥ indent` · `@ mention` · `⌘T tanggal` · `☑ selesai`

Selain itu: mengetuk bulatan berarti zoom, sasaran sentuh minimal 44×44 pt,
dan geser ke kiri memunculkan hapus (dikonfirmasi bila node punya anak).

---

## 12. Data Model

**Tidak ada tabel baru. Tidak ada migrasi.** Yang dipakai sudah ada sejak
fase 1: `parent_id`, `rank`, `content`, `note`, `collapsed`, `completed_at`,
dan semua kolom task.

Yang ditambahkan hanya di klien:

- Indeks multi-entry di Dexie atas `refIds` — id yang diekstrak dari `content`
  saat node ditulis. Sumbernya tetap teks; indeksnya bisa dibangun ulang kapan
  saja dari nol.

Invarian tetap ditegakkan di `core/tree.ts`, bukan di UI: tolak lingkaran
(telusuri dari induk tujuan ke atas), dan batas kedalaman 50 saat membaca
sebagai jaring pengaman terhadap bug — bukan batas produk.

---

## 13. Migrasi Frontend

1. `initialOutline` yang di-hardcode di `OutlineView.tsx` dihapus; view membaca
   pohon dari store yang sama dengan Todo.
2. Pohon bersarang di state React (`children` tertanam) → pohon datar
   `parent_id` dari store; `OutlineNode.isCompleted` → `completed_at`.
3. Lima operasi keyboard yang sudah ada dipetakan ke `core/tree.ts` —
   implementasi yang sama dengan drag di Board.
4. Router dipasang untuk seluruh aplikasi (§8), menggantikan
   `useState<ViewType>` di `App.tsx`.
5. Baru: chip mention + pemilih `@`, bentangan, progres, badge backlink,
   bagian "Disebut di" pada detail task, toolbar iPad, catatan `note`.

---

## 14. Testing

| Level | Cakupan |
|---|---|
| Unit — wajib | **Tiap baris tabel keyboard §7 punya tes, termasuk yang no-op** (Tab tanpa sibling sebelumnya; Shift+Tab di akar) · `tree.move` membawa seluruh subtree dengan urutan terjaga · lingkaran ditolak · ekstraksi mention dari `content` (termasuk teks yang menyerupai sintaks) · `core/progress.ts` (kosong, sebagian, semua selesai, bersarang dalam) |
| Integrasi | Node yang di-mention lalu dihapus tetap merender label cadangan · indeks backlink dibangun ulang dari nol memberi hasil yang sama |
| E2E | Ketik baris → Tab → muat ulang → strukturnya utuh · `@` sebut task dari project lain → centang dari chip → berubah juga di Today · zoom lewat URL → back kembali ke induk |

---

## 15. Success Criteria

- [ ] Tiap baris tabel keyboard §7 punya tes yang lulus, termasuk no-op
- [ ] `Tab` pada node beranak memindahkan seluruh subtree, urutan terjaga;
      `Shift+Tab` tidak mengadopsi sibling berikutnya
- [ ] `Backspace` di node berisi menghapus karakter, bukan node; di node
      kosong beranak tidak melakukan apa-apa
- [ ] Mengetik lalu menutup tab dalam 500 ms tetap tersimpan
- [ ] Status buka/tutup bertahan setelah muat ulang dan terlihat di perangkat kedua
- [ ] Memberi tanggal pada baris outline membuatnya muncul di Today; mencentangnya
      di Today menghilangkan centangnya di outline **tanpa muat ulang**
- [ ] `@` mencari seluruh pohon dengan breadcrumb dan menyisipkan chip;
      `$` menempelkan label; `!1` memberi prioritas
- [ ] `#` tidak ditawarkan di outline
- [ ] Chip menampilkan judul terkini setelah task itu di-rename
- [ ] Chip menampilkan progres `3/7` dan tanggal; mencentang dari chip
      mengubah task aslinya
- [ ] Membentangkan chip menampilkan anak-anaknya; mencentang di sana berlaku;
      lingkaran A↔B tidak membuat render berulang tanpa henti
- [ ] Task yang di-mention lalu dihapus tampil sebagai label bercoret, bukan uuid
- [ ] Detail task menampilkan "Disebut di N tempat" yang benar dan bisa diklik
- [ ] `/outline/{nodeId}` bisa dibuka langsung; tombol back kembali ke induknya
- [ ] Seluruh view lain juga punya URL sendiri (§8)
- [ ] Indent dan outdent bisa dilakukan di iPad tanpa papan ketik fisik
- [ ] Tepat satu `<input>` ada di DOM pada satu waktu
- [ ] Pohon 1.000 node dirender < 300 ms dan mulus digulir di iPad
- [ ] Menyunting outline milik user lain mustahil — kasus baru di tes isolasi

---

## 16. Out of Scope

| Ditunda | Alasan |
|---|---|
| **Mirror penuh (sunting struktur lewat bentangan)** | Menyisipkan baris "di dalam mirror" tidak punya jawaban murah soal ia masuk pohon yang mana. Bentangan baca + centang menutupi kebutuhan nyatanya |
| Pemisahan node di tengah teks & penggabungan `Backspace` | Sengaja dibuang; operasi yang paling mudah menghilangkan karakter diam-diam. Bisa dipulihkan bila terbukti dirindukan |
| Dokumen bernama banyak | Satu pohon dengan node akar sudah hal yang sama, dengan UI lebih sedikit |
| Kotak centang terpisah dari task | Tidak perlu — di model ini centang **adalah** penyelesaian task |
| Riwayat versi per node | Undo sesi menutupi kesalahan yang nyata, yang selalu terjadi seketika |
| Virtualisasi daftar | Ditambahkan saat pohon nyata terbukti lambat diukur, bukan sebelumnya |
| Ekspor OPML / impor Workflowy | Sekali pakai; skrip lebih murah daripada UI |
| Menyambungkan outline ke AI | Fase 4 memutuskannya, bukan di sini |
