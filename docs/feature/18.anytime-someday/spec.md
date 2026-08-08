# Spec: Anytime & Someday

**Tanggal:** 2026-08-08
**Status:** disetujui, siap diimplementasi
**Melengkapi:** `1.todo/spec.md` §6 (tabel View)

---

## 1. Konteks

Things 3 punya enam list bawaan. App ini punya tiga di antaranya:

| List Things | Di sini |
|---|---|
| Inbox | ✓ |
| Today | ✓ |
| Upcoming | ✓ |
| **Anytime** | ✗ |
| **Someday** | ✗ |
| Logbook | sedang dikerjakan (fitur 17) |

## 2. Riset: apa isi tiap list

Dari dokumentasi resmi:

| List | Isi |
|---|---|
| **Today** | to-do yang *"start date, deadline, atau aturan repeating"*-nya jatuh hari ini |
| **Upcoming** | terjadwal ke tanggal depan; *"tujuh hari berikutnya ditampilkan terpisah, mulai besok"* |
| **Anytime** | *"hanya to-do aktif"* tanpa start date di masa depan — *"yang bisa dikerjakan kapan saja"*. Task tanpa tanggal **muncul di sini**. Task Today juga ikut muncul, ditandai bintang |
| **Someday** | gagasan mentah dan project *"yang belum punya rencana"*. *"Disembunyikan dari Anytime dan Upcoming supaya tidak mengganggu"* |

Pembeda intinya:

> **Anytime** = bisa dikerjakan sekarang.
> **Someday** = belum tentu dikerjakan sama sekali, sengaja disembunyikan.

## 3. Temuan: `dueDate` di sini berperan sebagai *start date*, bukan deadline

Things membedakan dua tanggal:

- **start date** ("when") — menentukan kapan task muncul di Today/Anytime
- **deadline** — batas keras, ditampilkan terpisah

App ini cuma punya satu, `dueDate`, dan `views.ts` memakainya persis seperti
start date Things: `today()` mengambil `dueDate <= today`, `upcoming()`
mengambil `dueDate > today`.

**Spec ini tidak menambahkan deadline terpisah.** Itu perubahan besar —
kolom baru, UI baru, dan mengubah arti `today()`/`upcoming()` yang sudah
mapan. Yang dicatat di sini cukup: kalau nanti deadline ditambahkan, ia
kolom **baru**, dan `dueDate` tetap berperan sebagai start date.

## 4. Kenapa Anytime dan Someday harus sepasang

Bisa saja hanya membangun Anytime. Tapi tanpa Someday, Anytime berisi
**seluruh** task tak bertanggal — termasuk gagasan mentah yang belum tentu
dikerjakan. Yang justru dihindari Things: *"disembunyikan supaya tidak
mengganggu"*.

Anytime tanpa Someday adalah daftar yang terlalu ramai untuk dipercaya.
Keduanya dikerjakan bersama.

### Yang berubah untuk task tak bertanggal

`1.todo/spec.md` §6 menulis:

> **Upcoming tidak memuat task tanpa tanggal** — Task tanpa tanggal hidup di
> project-nya; itulah gunanya pohon.

Itu tetap benar untuk Upcoming. Yang berubah: task tak bertanggal sekarang
punya **satu tempat berkumpul** — Anytime — selain project masing-masing.
Selama ini satu-satunya cara melihatnya adalah membuka project satu per satu.

## 5. Scope

**In:**
- Kolom `isSomeday` di `node`
- `anytime()` dan `someday()` di `core/views.ts`
- View `/anytime` dan `/someday` + nav sidebar
- Cara menandai task sebagai Someday (dan membatalkannya) di `NodeDetailModal`

**Out (dengan alasan):**
- **Deadline terpisah dari start date** — §3 di atas. Perubahan besar, dan
  tidak diminta.
- **Bintang kuning di Anytime** untuk menandai task Today (Things punya) —
  penanda visual; bisa menyusul kalau Anytime terasa membingungkan.
- **Project ber-Someday** — Things mengizinkan project ditaruh di Someday.
  Di sini project belum bisa diselesaikan pun; menunggu fitur 13 selesai.
- **Someday otomatis pindah** ke Anytime pada tanggal tertentu — itu
  penjadwalan, dan Someday justru berarti *belum* dijadwalkan.

## 6. Keputusan desain

| Keputusan | Alasan |
|---|---|
| **Kolom boolean `isSomeday`**, bukan tag khusus | Tag `$someday` tidak butuh migrasi, tapi ia akan ikut muncul di daftar tag bersama tag sungguhan, dan bisa dihapus orang tanpa sadar. Someday adalah *keadaan*, bukan label — dan keadaan tempatnya di kolom. |
| **Someday mengecualikan dari Today dan Upcoming juga**, bukan cuma Anytime | Mengikuti Things. Task Someday yang punya tanggal lama akan tetap menghantui Today kalau tidak dikecualikan — persis gangguan yang hendak dihindari. |
| **Someday tidak mengubah `dueDate`** | Menandai Someday tidak menghapus tanggalnya; kalau nanti dikembalikan, tanggalnya masih ada. Menghapus data diam-diam adalah kejutan. |
| **Anytime memuat task Today juga** | Mengikuti Things — Anytime adalah "semua yang bisa dikerjakan sekarang", dan yang jatuh tempo hari ini jelas termasuk. Menyaringnya keluar bikin Anytime bohong. |

## 7. Core — `packages/core/src/views.ts`

```ts
/** Task aktif yang bisa dikerjakan sekarang: tanpa tanggal, atau tanggalnya sudah tiba. Someday dikecualikan. */
export function anytime(nodes: Node[], todayStr: string): Node[]

/** Task yang ditandai Someday. Tidak muncul di view lain mana pun. */
export function someday(nodes: Node[]): Node[]
```

- `anytime`: `isActiveItem(n) && !n.isSomeday && (n.dueDate === null || n.dueDate <= todayStr)`
- `someday`: `isActiveItem(n) && n.isSomeday`
- **`today()` dan `upcoming()` juga harus mengecualikan `isSomeday`** — kalau
  tidak, task Someday bertanggal tetap muncul di sana

Urutan: `dueDate` menaik (tanpa tanggal terakhir), lalu `priority`, lalu `rank`
— pola `byTodayOrder` yang sudah ada.

## 8. Success Criteria

- [ ] `/anytime` menampilkan task tak bertanggal **dan** yang tanggalnya sudah tiba
- [ ] `/someday` menampilkan hanya task ber-Someday
- [ ] Task Someday **tidak muncul** di Today, Upcoming, maupun Anytime
- [ ] Menandai Someday tidak menghapus `dueDate`-nya
- [ ] Membatalkan Someday mengembalikan task ke view yang semestinya
- [ ] Keduanya bisa dibuka dari sidebar dan langsung dari URL
- [ ] Task lama (`isSomeday` false secara default) tetap tampil normal
- [ ] `npm run verify` hijau; fungsi baru 100% branch coverage

## Sumber

- [An In-Depth Look at Today, Upcoming, Anytime, and Someday](https://culturedcode.com/things/support/articles/4001304/)
