# Spec: Auto-scheduling — tanggal relatif majemuk saat mengetik

**Tanggal:** 2026-08-08
**Status:** disetujui, siap diimplementasi
**Menutup:** gap yang ditulis sendiri oleh header `packages/core/src/parse.ts`

---

## 1. Konteks

Permintaannya: *"auto scheduling kaya today, next week, in 5 days otomatis
itu juga bagus banget."*

Setengahnya sudah jalan. `parse.ts` sudah mengurai `hari ini`/`today`,
`besok`/`bsk`/`tomorrow`, `lusa`, `kemarin`/`yesterday`, nama hari (`senin`,
`monday`) dengan `depan`/`next`, tanggal eksplisit, ISO, dan `d nama-bulan`.

Yang belum, dan **sudah dicatat sendiri oleh header filenya**:

> `// NOT implemented yet: compound relative phrases ("minggu depan" and`
> `// "bulan depan" on their own, "N hari lagi", "akhir bulan").`

"next week" dan "in 5 days" jatuh persis ke dua celah itu. "today" sudah ada.

Ini murni kenyamanan input — hasilnya sama dengan mengetik tanggal manual.
Menurut [policy 3](../../policy/3-product-policy.md) §2 ia "duduk di atas
model", jadi diterima tanpa syarat.

---

## 2. Tabrakan yang harus diputuskan lebih dulu

**`minggu` ada di dua tabel sekaligus.** Ia nama hari (Sunday) di
`WEEKDAY_NUMBERS`, dan sekaligus kata "week". Hari ini `minggu depan` sudah
terurai — sebagai **hari Minggu pekan depan**.

Dalam bahasa Indonesia sehari-hari, "minggu depan" hampir selalu berarti
*next week*, bukan *hari Minggu berikutnya*. Untuk hari Minggu orang bilang
"hari minggu depan".

**Keputusan:**

| Input | Hasil | Berubah? |
|---|---|---|
| `minggu depan` | Senin pekan depan | **ya** — sebelumnya Minggu pekan depan |
| `hari minggu depan` | Minggu pekan depan | tidak |
| `minggu` (sendirian) | Minggu terdekat | tidak |
| `next week` | Senin pekan depan | baru |

Ini **satu-satunya perubahan perilaku** di fitur ini; sisanya murni tambahan.
Tesnya ditulis eksplisit supaya perubahan itu terlihat, bukan diam-diam.

### Kenapa guard, bukan urutan push

`pickRightmostNonNested` menjatuhkan kandidat yang **sepenuhnya tertelan**
kandidat lain. Dua kandidat dengan span **persis sama** sama-sama lolos, dan
pemenangnya jadi yang dipush duluan — bergantung urutan baris kode.

Karena itu pola weekday **wajib diberi guard**, bukan diakali dengan menaruh
pola baru lebih dulu:

```
lewati kandidat weekday bila  m[2] == 'minggu'
                        dan   m[3] == 'depan' (atau m[1] == 'next')
                        dan   TIDAK didahului "hari "
```

Baru setelah itu pola majemuk boleh mengklaim span-nya. Mengandalkan urutan
push berarti menaruh bom waktu untuk orang yang merapikan file ini nanti.

---

## 3. Scope

**In** — enam frasa, ID + EN:

| Frasa | Hasil |
|---|---|
| `minggu depan` · `next week` | Senin pekan depan |
| `bulan depan` · `next month` | **tanggal 1** bulan depan |
| `N hari lagi` · `in N days` | `today + N` |
| `N minggu lagi` · `in N weeks` | `today + 7N` |
| `akhir bulan` · `end of month` | hari terakhir bulan berjalan |

**Out (dengan alasan):**

- **`minggu ini` / `bulan ini`** — "minggu ini" tidak menunjuk satu hari.
  Menebaknya (hari ini? Jumat?) adalah kejutan, bukan fitur.
- **`akhir minggu` / `akhir pekan`** — Sabtu atau Minggu? Tidak ada jawaban
  yang tidak mengejutkan separuh orang.
- **`N bulan lagi`** — butuh keputusan clamp (31 Jan + 1 bulan = ?). Dua frasa
  bulan yang sudah masuk scope sengaja dipilih karena **bebas clamp**.
- **`tanggal N bulan depan`** — komposisi frasa; pola sekarang datar dan
  murah, dan tidak ada yang mengeluhkannya.
- **Frasa relatif untuk waktu** (`2 jam lagi`) — `dueTime` beda sumbu dari
  `dueDate`; sebaiknya fitur sendiri kalau memang dibutuhkan.

---

## 4. Keputusan desain

| Keputusan | Alasan |
|---|---|
| **Semua "next X" mendarat di *awal* periode** — Senin, tanggal 1 | Konsisten, dan **bebas clamp**: tidak ada "31 Februari". Kalau "bulan depan" berarti "tanggal yang sama bulan depan", 31 Januari langsung jadi kasus khusus. |
| **Senin sebagai awal pekan** | Sudah jadi asumsi app ini: `recurrence.ts` memakai `FREQ=WEEKLY;BYDAY=MO..FR` untuk "hari kerja". |
| **`N` dibatasi 1–999** | Tanpa batas, `9999999 hari lagi` melahirkan tanggal tahun 29000. Batas atas menjaga hasil tetap masuk akal tanpa menambah pesan error. `N=0` ditolak — "0 hari lagi" bukan kalimat. |
| **Dua helper baru di `date.ts`**, bukan di `parse.ts` | `date.ts` sudah rumah `addDays`/`dayOfWeek`. Aritmetika kalender milik `date.ts`; `parse.ts` mengurai teks. |
| **Tanpa entri baru di `RELATIVE_DAY_OFFSETS`** | Tabel itu memetakan kata → offset hari tetap. `akhir bulan` dan `bulan depan` bukan offset tetap. Memaksanya masuk berarti merusak arti tabelnya. |

---

## 5. Core — `packages/core/src/date.ts`

Dua fungsi murni baru, seragam dengan yang sudah ada (`YYYY-MM-DD` masuk,
`YYYY-MM-DD` keluar, `Date.UTC` jam 12 untuk menghindari DST):

```ts
/** Tanggal 1 bulan berikutnya. Desember menggulung ke Januari tahun depan. */
export function firstOfNextMonth(dateStr: string): string

/** Hari terakhir bulan yang memuat `dateStr` — 28/29/30/31, tahun kabisat benar. */
export function endOfMonth(dateStr: string): string
```

Senin pekan depan tidak perlu helper — sudah bisa dari yang ada:

```ts
// dayOfWeek: 0=Minggu … 6=Sabtu. Minggu (0) hanya 1 hari sebelum Senin.
const dow = dayOfWeek(today)
const toNextMonday = dow === 0 ? 1 : 8 - dow
addDays(today, toNextMonday)
```

> `dow === 0` adalah kasus yang paling mudah salah: rumus `8 - dow` memberi 8
> untuk hari Minggu, yaitu Senin **lusa pekan depan**. Wajib punya tesnya
> sendiri.

### 5.1 Tes `date.ts`

- `firstOfNextMonth`: tengah bulan · tanggal 1 · **31 Des → 1 Jan tahun +1** ·
  dari Februari (kabisat & bukan)
- `endOfMonth`: 31 hari · 30 hari · **Feb tahun kabisat → 29** · **Feb bukan
  kabisat → 28** · **tahun 2000 → 29** (aturan kabisat 400) · sudah di hari
  terakhir → tidak berubah

---

## 6. Core — `packages/core/src/parse.ts`

### 6.1 Guard pada pola weekday

Sesuai §2. Ditulis sebagai satu `continue` bersyarat dengan komentar yang
menyebut §2 spec ini, supaya tidak "dirapikan" orang lain nanti.

### 6.2 Pola majemuk

Ditambahkan di `findDateCandidates`, **setelah** pola weekday:

```ts
// "minggu depan" / "next week" → Senin pekan depan. Pola weekday di atas
// sengaja melepas span ini (§2 spec 21).
/\b(?:minggu\s+depan|next\s+week)\b/gi

// "bulan depan" / "next month" → tanggal 1 bulan depan.
/\b(?:bulan\s+depan|next\s+month)\b/gi

// "N hari lagi" / "in N days" — dan varian minggu.
/\b(\d{1,3})\s+hari\s+lagi\b/gi
/\bin\s+(\d{1,3})\s+days?\b/gi
/\b(\d{1,3})\s+minggu\s+lagi\b/gi
/\bin\s+(\d{1,3})\s+weeks?\b/gi

// "akhir bulan" / "end of month".
/\b(?:akhir\s+bulan|end\s+of\s+(?:the\s+)?month)\b/gi
```

`N === 0` → `continue` (bukan kandidat). `\d{1,3}` sudah menegakkan batas
atas 999 dari §4 tanpa perbandingan tambahan.

> **`hari lagi` vs `hari ini`:** keduanya diawali `hari`, tapi tidak pernah
> bertabrakan — `RELATIVE_DAY_OFFSETS` hanya cocok pada frasa `hari ini`
> utuh, dan `5 hari lagi` tidak memuatnya.

### 6.3 Header file

Blok komentar yang mendaftar "NOT implemented yet" **wajib diperbarui** —
empat dari empat celah yang disebutnya sudah ditutup. Membiarkannya adalah
komentar yang berbohong.

### 6.4 Tes `parse.ts`

Menyusul pola tabel yang sudah dipakai file itu. `today` di tes dipilih
sadar, bukan asal:

| Input | `today` | `dueDate` | `content` |
|---|---|---|---|
| `rapat minggu depan` | Jum 2026-08-07 | 2026-08-10 | `rapat` |
| `rapat minggu depan` | **Min 2026-08-09** | **2026-08-10** | `rapat` |
| `meeting next week` | Jum 2026-08-07 | 2026-08-10 | `meeting` |
| `rapat hari minggu depan` | Jum 2026-08-07 | **2026-08-16** | `rapat hari` |
| `bayar sewa bulan depan` | 2026-08-07 | 2026-09-01 | `bayar sewa` |
| `bayar sewa bulan depan` | **2026-12-20** | **2027-01-01** | `bayar sewa` |
| `lapor akhir bulan` | 2026-08-07 | 2026-08-31 | `lapor` |
| `lapor akhir bulan` | **2028-02-10** | **2028-02-29** | `lapor` |
| `kirim 5 hari lagi` | 2026-08-07 | 2026-08-12 | `kirim` |
| `ship in 5 days` | 2026-08-07 | 2026-08-12 | `ship` |
| `ship in 1 day` | 2026-08-07 | 2026-08-08 | `ship` |
| `cek 2 minggu lagi` | 2026-08-07 | 2026-08-21 | `cek` |
| `cek in 2 weeks` | 2026-08-07 | 2026-08-21 | `cek` |
| `beli 0 hari lagi` | 2026-08-07 | **null** | `beli 0 hari lagi` |

Baris 2 adalah yang menangkap bug `dow === 0`. Baris 4 membuktikan
disambiguasi `hari`. Baris terakhir menegakkan satu-satunya aturan keras
parser: **yang tidak dikenali tidak pernah dibuang**.

Ditambah:
- Gabungan: `rapat minggu depan jam 9 #Kerja p1` → tanggal, jam, project,
  prioritas semua benar dan `content` tinggal `rapat`
- Rightmost menang: `besok atau minggu depan` → `minggu depan`
- Tes lama `"senin depan"` **tetap hijau tanpa diubah** — bukti guard §2
  tidak melukai nama hari lain

---

## 7. UI

**Nol perubahan.** `AddTaskFormReal` dan `QuickAdd` sudah memanggil `parse()`
dan sudah merender `spans` sebagai chip. Frasa baru otomatis ikut tersorot
karena keluar sebagai `kind: 'date'` seperti frasa lama.

Itu memang tandanya batas modul di sini digambar di tempat yang benar.

---

## 8. Success Criteria

- [ ] Enam frasa di §3 menghasilkan tanggal yang benar, ID dan EN
- [ ] `minggu depan` → Senin pekan depan, termasuk **saat hari ini Minggu**
- [ ] `hari minggu depan` tetap berarti hari Minggu pekan depan
- [ ] `akhir bulan` benar di Februari kabisat, non-kabisat, dan tahun 2000
- [ ] `bulan depan` dari Desember menggulung ke Januari tahun berikutnya
- [ ] `0 hari lagi` tidak dikenali dan teksnya utuh di `content`
- [ ] Frasa baru tersorot sebagai chip tanggal di quick-add tanpa kode UI baru
- [ ] Header `parse.ts` tidak lagi menyebut celah yang sudah ditutup
- [ ] `npm run verify` hijau; `date.ts` dan `parse.ts` 100% branch coverage
- [ ] Seluruh 57 tes parser lama tetap hijau **tanpa diubah**, kecuali yang
      memang mengunci perilaku `minggu depan` lama
