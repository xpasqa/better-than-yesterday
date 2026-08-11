# Spec: Undo (⌘Z)

**Tanggal:** 2026-08-11
**Status:** disetujui, siap ditulis plan.md
**Dipisahkan dari:** [fitur 25](../25.keyboard-shortcuts/spec.md) — ia bukan
shortcut, ia fitur undo yang kebetulan punya shortcut. Lihat
[issue #76](https://github.com/xpasqa/better-than-yesterday/issues/76).

---

## 1. Konteks

Belum ada yang memintanya — issue #76 sengaja ditaruh di Inbox sebagai ide
sampai brainstorm ini. Empat pertanyaan yang belum terjawab di issue asli:

1. Apa yang bisa dibatalkan?
2. Sampai kapan ia berlaku?
3. Bagaimana kalau aksinya sudah tersinkron ke server?
4. Bagaimana kalau lintas perangkat?

Spec ini menjawab keempatnya dengan jawaban paling sederhana yang cukup —
bukan tumpukan riwayat sungguhan.

---

## 2. Scope

**In:**
- Satu tingkat undo (bukan tumpukan) — aksi undo-able baru menimpa slot lama
- Hidup selama sesi/tab berjalan saja — state di memori, **hilang saat
  reload**, tidak disimpan ke `localStorage`
- Dua aksi: **hapus task** dan **centang selesai task biasa** (non-recurring)
- Muncul sebagai toast "Dibatalkan?" 5 detik lalu hilang otomatis

**Out (dengan alasan):**
- **Centang selesai task berulang.** Menyelesaikan task berulang menulis dua
  hal: memajukan `dueDate` **dan** satu baris baru ke tabel `completion`.
  Tabel `completion` sengaja dibuat **immutable** — insert-only, tidak ada
  endpoint hapus (`apps/api/src/modules/sync/routes.ts`, spec §8) karena ia
  jejak audit yang tidak pernah berubah. Membatalkan completion recurring
  berarti menghapus baris itu, yang melanggar invarian ini langsung.
  Pilihannya cuma dua: bangun mekanisme hapus untuk tabel yang sengaja tak
  bisa dihapus, atau biarkan baris sampah mencemari Logbook. Keduanya buruk
  — jadi checkbox task berulang tetap seperti sekarang, tanpa affordance
  undo.
- **Ubah tanggal, prioritas, tag, dll.** Bukan bagian dari "hapus dan
  centang" yang diusulkan issue asli sebagai cakupan minimal yang cukup.
- **Tumpukan riwayat (undo berkali-kali).** Satu tingkat sudah menangkap
  sebagian besar nilainya.
- **Bertahan lintas reload.** State di localStorage butuh serialisasi dan
  penanganan kadaluwarsa — di luar cakupan versi ini.
- **Lintas perangkat.** Otomatis tidak relevan karena state undo cuma hidup
  di memori satu tab — tidak ada cara membatalkan aksi dari perangkat lain
  sama sekali. Ini bukan keputusan terpisah, ia konsekuensi dari "sesi ini
  saja".

---

## 3. Model data

Karena kedua aksi yang didukung sama-sama biner (`deletedAt`: null↔now,
`completedAt`: null↔now untuk task non-recurring), undo **tidak perlu
snapshot state sebelumnya** — cukup tahu id node dan jenis aksinya:

```ts
type UndoAction = { type: 'delete' | 'complete'; nodeId: string; label: string }
```

- Undo hapus → `updateNode(nodeId, { deletedAt: null })`
- Undo centang → `updateNode(nodeId, { completedAt: null })`

`label` (isi `node.content` saat aksi terjadi) dipakai untuk teks toast
("'Beli susu' dihapus. Undo?") — diambil saat aksi terjadi, bukan dibaca
ulang saat undo diklik, supaya tetap benar meski node-nya sudah tidak ada
di store lokal (dihapus).

---

## 4. Soal sinkronisasi dan lintas perangkat — terjawab oleh arsitektur yang ada

**Sudah tersinkron ke server?** Tidak butuh penanganan khusus. Undo cuma
memanggil `updateNode` yang sama seperti mutasi lain — otomatis dapat
`updatedAt` baru, dan LWW yang sudah ada (`apps/api/src/modules/sync/routes.ts`)
menang secara alami saat sync jalan lagi. Tidak ada "baris kompensasi"
terpisah yang perlu ditulis.

**Lintas perangkat?** Lihat §2 — konsekuensi otomatis dari "state undo cuma
hidup di memori satu tab", bukan keputusan yang perlu logika tersendiri.

---

## 5. Yang harus benar

- Aksi undo-able baru **selalu menimpa** slot lama, bahkan kalau toast lama
  masih tampil (satu tingkat, bukan antrean toast).
- Toast otomatis hilang setelah 5 detik — timer di-reset kalau aksi
  undo-able baru terjadi sebelum toast lama hilang.
- `recordUndo` untuk aksi "centang" **hanya** dipanggil dari cabang
  non-recurring `toggleTaskComplete`, dan **hanya** saat menyelesaikan
  (`completedAt` null→now), bukan saat membatalkan centang (`now→null` —
  itu sendiri sudah jadi "undo" dari centang sebelumnya, tidak perlu
  undo-of-undo).
- **Melakukan undo itu sendiri tidak direkam sebagai aksi undo-able baru.**
  Klik "Undo" pada task yang terhapus memanggil `updateNode` secara
  langsung, bukan lewat `deleteTask`/`toggleTaskComplete` — jadi tidak ada
  toast "Undo dibatalkan?" berantai.
- Reload halaman membuang state undo tanpa peringatan — sesuai §2, ini
  perilaku yang disengaja, bukan bug.

---

## 6. Success Criteria

- [ ] Hapus task → toast muncul → klik Undo → task kembali, tidak
      ter-soft-delete
- [ ] Centang task biasa selesai → toast muncul → klik Undo → task kembali
      belum selesai
- [ ] Centang task **berulang** selesai → **tidak ada toast** (di luar scope)
- [ ] Aksi undo-able kedua sebelum toast pertama hilang → toast lama diganti,
      cuma aksi kedua yang bisa dibatalkan
- [ ] Reload sebelum toast diklik → tidak ada undo yang tersisa, tidak ada
      error
- [ ] `npm run verify` hijau
