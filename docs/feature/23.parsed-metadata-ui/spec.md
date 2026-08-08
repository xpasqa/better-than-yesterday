# Spec: Metadata terurai yang belum ditampilkan

**Tanggal:** 2026-08-08
**Status:** disetujui, siap diimplementasi
**Menutup:** `1.todo/todo.md` blok E baris "penyorotan spans" · blok H baris "indikator recurring"

---

## 1. Konteks

Dua sisa di [`todo.md`](../2.backend/1.todo/todo.md) yang tampaknya tidak
berhubungan, tapi sebenarnya **satu masalah yang sama**:

> Parser sudah mengerti. UI-nya tidak pernah memberitahu.

| Yang sudah ada | Yang tidak ditampilkan |
|---|---|
| `parse()` mengembalikan `spans` — posisi tiap token yang dikenali | Tidak ada satupun pemakai `spans`. `grep -rn "spans" apps/web/src` → nol |
| `node.recurrence` terisi dari quick-add sejak #23 | `TaskRow` meta row hanya punya tanggal, jam, label, project |

Keduanya **nol perubahan model, nol perubahan skema, nol tulisan ke DB**.
Murni perenderan data yang sudah tersedia. Itu yang membuat keduanya pantas
satu kartu — bukan karena sama-sama kecil.

Akibat nyatanya hari ini: mengetik `siram tanaman setiap hari` menghasilkan
task yang terlihat **persis sama** dengan task biasa. Satu-satunya cara tahu
ia berulang adalah membuka modalnya. Untuk fitur yang baru saja dibangun
dengan sembilan task dan dua bug nyaris-lolos, itu sayang.

---

## 2. Scope

**In:**
- Baris pratinjau di bawah quick-add: apa yang parser pahami dari ketikan
- Ikon recurring di meta row `TaskRow`

**Out (dengan alasan):**
- **Penyorotan *di dalam* input** — lihat §3, ditolak dengan alasan teknis
- **Menyunting hasil parse dari pratinjau** — pratinjau memberi tahu, bukan
  mengontrol. Kalau salah, orang mengubah ketikannya; itu justru lebih cepat.
- **Pratinjau di `AddTaskFormReal`** — komponen itu bukan quick-add. Ia punya
  chip terpisah untuk tanggal dan prioritas, dan **menimpa** hasil parse
  setelah task dibuat. Menambahkan pratinjau parser di sana justru
  membingungkan: yang ditampilkan belum tentu yang tersimpan (lihat [#75](https://github.com/xpasqa/better-than-yesterday/issues/75)).
- **Ikon untuk durasi/mention di `TaskRow`** — `durationMin` dan mention
  belum punya pemakai lain; menampilkannya sekarang berarti menebak
  kebutuhan.

---

## 3. Keputusan: pratinjau di bawah, bukan sorotan di dalam

[`todo.md`](../2.backend/1.todo/todo.md) blok E menulis "penyorotan `spans`
di dalam input". Spec ini **sengaja menyimpang**, dan alasannya ditulis di
sini sesuai aturan.

Menyorot di dalam `<input>` mustahil secara langsung — elemen input tidak
bisa memuat markup. Teknik yang biasa dipakai adalah **mirror div**: sebuah
div di belakang input yang merender teks yang sama dengan `<mark>`, dengan
input dibuat transparan di atasnya.

Itu menuntut font, `letter-spacing`, `padding`, `border`, dan posisi scroll
yang **sinkron piksel-per-piksel** antara dua elemen. Setiap pergeseran kecil
— tema gelap mengubah border, font fallback berbeda di satu perangkat,
input yang ter-scroll horizontal — membuat sorotan mendarat di huruf yang
salah. Itu bug yang sulit direproduksi dan tidak pernah benar-benar selesai.

**Yang dipilih:** satu baris di bawah input yang menampilkan hasil parse
sebagai chip, plus sisa judulnya.

```
┌────────────────────────────────────────────────┐
│ rapat tim minggu depan jam 9 #Kerja !1         │
└────────────────────────────────────────────────┘
  "rapat tim"  · 📅 10 Agu · 🕘 09:00 · # Kerja · 🚩 P1
```

Ia menyampaikan hal yang sama — **kata mana yang dimakan, jadi apa** — lewat
sisa judul yang terlihat, tanpa satupun masalah penyelarasan. Dan ia
menampilkan **nilai hasilnya** (`10 Agu`), yang sorotan warna tidak bisa:
sorotan cuma bilang "kata ini dikenali", bukan "dikenali sebagai 10 Agustus".

Untuk `minggu depan`, perbedaan itu justru yang paling penting — orang perlu
tahu ia mendarat di Senin, bukan Minggu.

---

## 4. Blok A — pratinjau quick-add

**File:** `apps/web/src/components/QuickAddBar.tsx` (+ CSS di `RealView.css`)

`QuickAddBar` sudah menerima `timezone`. Ia memanggil `parse()` langsung saat
render — sinkron, di memori, tanpa I/O, jadi tidak ada yang perlu di-debounce
(prinsip yang sama dengan [spec 12](../12.search/spec.md) §3).

```tsx
const parsed = value.trim() ? parse(value, { now: new Date(), timezone, language }) : null
const hasMetadata = Boolean(
  parsed && (parsed.dueDate || parsed.dueTime || parsed.recurrence ||
             parsed.projectQuery || parsed.priority !== null || parsed.labelNames.length > 0),
)
```

Pratinjau **hanya muncul kalau ada yang dikenali**. Baris yang selalu ada dan
biasanya kosong adalah derau.

> `new Date()` dipanggil saat render, jadi pratinjau ikut bergerak kalau
> tengah malam lewat sementara input terbuka. Itu benar, bukan masalah:
> `createTaskFromQuickAdd` juga memanggil `new Date()` sendiri saat submit,
> jadi pratinjau dan hasil memakai sumber waktu yang sama.

Chip yang ditampilkan: judul sisa · tanggal · jam · recurring · project ·
prioritas · tiap tag. Tanggal diformat manusiawi (`10 Agu`), bukan ISO —
`2026-08-10` tidak menjawab pertanyaan "berarti hari apa?".

## 5. Blok B — indikator recurring di `TaskRow`

**File:** `apps/web/src/components/TaskRow.tsx` (+ CSS)

Meta row sudah punya penjaga:

```tsx
{(dueInfo || node.dueTime || taskLabels.length > 0 || parentProject) && (
```

`node.recurrence` **wajib ditambahkan ke penjaga itu** — kalau tidak, task
berulang tanpa tanggal, tanpa label, dan tanpa project tidak akan
menampilkan meta row sama sekali, jadi ikonnya tidak pernah muncul. Itu
persis kasus `siram tanaman setiap hari`, yang **normal**, bukan sudut
langka: enam dari delapan pola recurrence spec §8 memang tidak membawa frasa
tanggal.

Ikon `ArrowsClockwiseIcon` dengan `title` berisi keterangan singkat dalam
bahasa manusia, bukan RRULE mentah — `FREQ=MONTHLY;BYMONTHDAY=8` bukan
kalimat.

### Fungsi murni baru: `describeRecurrence`

**File:** `packages/core/src/recurrence.ts`

```ts
/** RRULE → frasa pendek untuk ditampilkan. Rule tak dikenal → null. */
export function describeRecurrence(rule: string | null): string | null
```

| Rule | Hasil |
|---|---|
| `FREQ=DAILY` | `setiap hari` |
| `FREQ=DAILY;INTERVAL=3` | `setiap 3 hari` |
| `FREQ=WEEKLY;BYDAY=MO` | `setiap Senin` |
| `FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR` | `setiap hari kerja` |
| `FREQ=MONTHLY;BYMONTHDAY=8` | `setiap tanggal 8` |
| `FREQ=YEARLY;BYMONTH=8;BYMONTHDAY=17` | `setiap 17 Agustus` |
| apa pun yang lain | `null` |

Di core, bukan di komponen, karena ini transformasi murni atas format yang
`recurrence.ts` sudah miliki — dan karena ia butuh tes tabel, yang tidak
nyaman ditulis untuk kode di dalam komponen.

**`null` untuk rule tak dikenal, bukan melempar.** Ikon berulang yang hilang
adalah kekurangan kosmetik; komponen yang melempar mematikan seluruh daftar.

---

## 6. Success Criteria

- [ ] Mengetik di quick-add menampilkan pratinjau berisi judul sisa + chip
- [ ] Pratinjau tidak muncul saat tidak ada metadata yang dikenali
- [ ] `minggu depan` di pratinjau menampilkan tanggal sungguhan, bukan teks mentah
- [ ] Task berulang menampilkan ikon di meta row `TaskRow`
- [ ] **Task berulang tanpa tanggal/label/project tetap menampilkan ikonnya**
- [ ] `title` ikon berbahasa manusia, bukan RRULE
- [ ] Rule tak dikenal tidak melempar — ikonnya saja yang tidak muncul
- [ ] `npm run verify` hijau; `describeRecurrence` 100% branch coverage
