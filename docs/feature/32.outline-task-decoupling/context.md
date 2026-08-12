# Context: Outline dilepas dari Todo

**Tanggal:** 2026-08-12
**Asal:** brainstorm 2026-08-12
**Status:** desain disetujui

Dokumen ini menyimpan *bagaimana* keputusan di [spec.md](spec.md) diambil —
gejalanya, akar masalahnya, dan percabangan yang ditolak. Spec menuliskan
hasilnya; di sini alasannya diawetkan supaya tidak diperdebatkan ulang.

---

## 1. Gejala

> *"Saat ini saya pusing banget karena outline ini otomatis terhubung ke task
> todo, harusnya tidak."*

Setiap baris yang diketik di Outline langsung muncul di **Anytime** — dan di
**Today** kalau kebetulan punya tanggal. Menulis catatan berarti menambah
pekerjaan. Todo jadi tidak bisa dipercaya sebagai daftar kerja, karena isinya
tercampur kalimat catatan.

## 2. Akar masalah

Bukan bug. Ini konsekuensi langsung dari model data.

Outline dan Todo memakai satu tabel `node` yang sama — keputusan sadar di
[2.backend/2.outline §12](../2.backend/2.outline/spec.md): *tanpa tabel baru,
tanpa migrasi*. Baris outline dibuat dengan `kind: 'item'`
([outline-actions.ts:41](../../../apps/web/src/store/outline-actions.ts)),
dan seluruh filter view Todo memakai satu predikat yang sama:

```ts
// packages/core/src/views.ts:11
function isActiveItem(n: Node, includeCompleted = false): boolean {
  return n.kind === 'item' && n.deletedAt === null && (includeCompleted || n.completedAt === null)
}
```

`kind='item'` adalah satu-satunya syarat keanggotaan Todo. Baris outline
memenuhinya sejak detik ia dibuat. Tidak ada yang perlu "terhubung" — ia
memang sudah satu populasi.

Berbagi tabel itu sendiri tidak salah dan tetap dipertahankan. Yang salah:
**tidak ada apa pun yang membedakan "kalimat" dari "pekerjaan" di dalamnya.**

## 3. Percabangan yang dipertimbangkan

### 3.1 Apa arti `#project` pada sebuah baris?

| Opsi | Alasan ditolak / dipilih |
|---|---|
| Baris pindah (reparent) ke project | **Ditolak.** Kalimatnya hilang dari tempatnya; catatan jadi berlubang. |
| Baris *berubah* jadi task (promote) | **Ditolak.** Satu node dengan dua tempat — posisi di outline dan keanggotaan project — dan tidak jelas mana yang menang saat dipindah. |
| Baris tetap, melahirkan task tertaut | **Dipilih.** Dua entitas, satu tautan. Catatan tetap utuh sebagai kalimat, pekerjaan hidup di tempat yang benar. Polanya sudah ada di spec: chip `@mention` §3.3. |

### 3.2 Apa penanda "bukan task"?

| Opsi | Alasan ditolak / dipilih |
|---|---|
| Ditentukan leluhur (di bawah project/area = task) | **Ditolak sebagai aturan runtime.** Setiap filter view harus menelusuri pohon — lebih mahal, dan aturannya implisit. *(Tetap dipakai sekali, sebagai heuristik migrasi — lihat §3.4.)* |
| Kolom boolean `is_task` | **Ditolak.** Dimensi ketiga di samping `kind`, dan bisa bentrok: `kind='item'` tapi `is_task=false` berarti apa? |
| `kind='note'` | **Dipilih.** Satu nilai enum baru. `isActiveItem` yang ada sudah memfilter `kind === 'item'`, jadi seluruh view Todo bersih tanpa disentuh. Preseden persis ada: migrasi `0005_add_area_kind.sql` menambah `'area'` dengan cara yang sama. |

### 3.3 Baris yang diketik saat zoom ke sebuah project?

Dipilih: **tetap catatan.** Konsistensi mutlak menang — tidak ada baris outline
yang pernah jadi task tanpa aksi eksplisit, di mana pun ia berada.

Harganya diterima secara sadar: catatan yang ditulis di dalam project tidak
tampil di layar project Todo. Itu benar secara semantik (ia catatan), dan
Outline tetap menampilkannya di posisi aslinya.

### 3.4 Data lama

Dipilih: **bersihkan otomatis lewat heuristik** — `kind='item'` yang rantai
leluhurnya tidak mencapai `project`/`area` diturunkan jadi `note`.

Ditolak: membiarkan data lama (Anytime tetap kotor, dan pusing yang memicu
seluruh sesi ini tidak hilang) dan layar tinjauan sekali-pakai (satu layar
yang lahir langsung untuk dibuang).

Risikonya dihitung: task lepas yang sengaja ditaruh di akar ikut terdegradasi.
Diterima — node semacam itu tidak muncul di sidebar, tidak punya project, dan
praktis hanya bisa dijangkau lewat Outline. Ia tetap ada di Outline dan bisa
ditandai ulang dengan `#project`.

### 3.5 Penyimpanan tautan

Dipilih: kolom `linked_task_id`. Ditolak: menyimpan tautan di dalam teks
sebagai chip `@[judul](id)` — tautan jadi bagian kalimat yang bisa terhapus
saat mengedit, dan satu baris bisa punya banyak tautan tanpa maksud.

## 4. Keputusan spec lama yang dibatalkan

[2.backend/2.outline §4](../2.backend/2.outline/spec.md) menyatakan:

> `#` **tidak ditawarkan di outline** — `#` berarti "taruh di project ini",
> sementara sebuah baris outline sudah punya tempatnya.

Alasan itu berlaku ketika baris outline *adalah* task. Setelah baris outline
jadi `note`, ia tidak punya tempat di Todo sama sekali — dan `#` berhenti
berarti "pindahkan", mulai berarti "lahirkan task di sana". Premisnya hilang,
jadi larangannya ikut hilang.
