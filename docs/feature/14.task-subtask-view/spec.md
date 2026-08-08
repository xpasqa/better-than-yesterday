# Spec: Menampilkan subtask di task detail

**Tanggal:** 2026-08-08
**Status:** disetujui, siap diimplementasi
**Terkait:** `13.project-hierarchy` (model Things) — tapi **nol kode bersama**

---

## 1. Konteks

Permintaannya: *"di dalam task itu ada deskripsi dan checklist"* — meniru
Things 3.

Setelah dicek, separuhnya **sudah ada**:

| Bagian | Status |
|---|---|
| Deskripsi | **sudah jalan** — `node.note`, textarea "Note" di `NodeDetailModal.tsx:164` |
| Checklist | belum dirender sama sekali |

Jadi yang tersisa cuma satu hal: `NodeDetailModal` tidak pernah menampilkan
anak dari node yang sedang dibuka.

---

## 2. Checklist di sini **adalah** subtask

Ini keputusan yang menentukan seluruh bentuk fitur, jadi ditulis di depan.

**Di Things, checklist bukan subtask.** Dokumentasi Shortcuts Actions-nya
tegas: checklist item tidak bisa punya tanggal, tag, maupun notes. Things
bahkan tidak punya subtask sama sekali — checklist justru dibuat sebagai
jalan tengah, *"some things take several steps to complete but don't require
a full-blown project"*.

**Di app ini, keputusannya sudah diambil lebih dulu dan berlawanan.**
`1.todo/spec.md` §3.1:

> **Subtask tanpa batas kedalaman.** Todoist membatasinya, dan rancangan
> sebelumnya meniru batas itu agar subtask tidak bersaing dengan outline. Di
> sini justru sebaliknya — subtask *adalah* outline, jadi batasan itu
> kehilangan alasannya.

Maka: **checklist dan subtask adalah benda yang sama** — anak `item` dari
sebuah `item`, node penuh. Membuat `kind='checklist'` yang lebih miskin
berarti melawan §3.1 sekaligus menambah satu tipe berikut aturan pembatasnya,
demi memisahkan dua hal yang di app ini memang satu.

Yang berbeda cuma **cara menampilkan**: checkbox ringkas di dalam task detail,
bukan baris penuh di daftar.

### Tradeoff yang diterima

Karena subtask adalah node penuh, subtask yang diberi tanggal **akan muncul
sendiri di Today**. Di Things itu mustahil.

Ini diterima, bukan diabaikan: perilaku itu **sudah berlaku hari ini** untuk
subtask yang dibuat lewat Outline — bukan masalah baru yang diciptakan fitur
ini. Kalau nanti terasa mengganggu, solusinya menyaring di `views.ts`, bukan
menambah tipe node.

### Konsekuensi bagusnya

**Nol perubahan model data.** Tidak ada migrasi, tidak ada `kind` baru, tidak
ada field baru. Murni rendering.

---

## 3. Scope

**In:**
- `NodeDetailModal` menampilkan anak langsung dari task yang dibuka
- Tambah subtask baru dari dalam modal
- Centang/batal-centang subtask
- Hapus subtask
- Indikator progres ringkas ("2/5")

**Out (dengan alasan):**
- **Menampilkan cucu (subtask dari subtask).** Modelnya mengizinkan tak
  terbatas, tapi task detail bukan tempat menjelajah pohon — itu tugas
  Outline, yang sudah melakukannya dengan baik. Satu tingkat saja di sini.
- **Menyeret untuk mengurutkan subtask.** `rank` sudah menanganinya di
  belakang layar; UI pengurutan adalah fitur tersendiri.
- **Mengedit tanggal/prioritas/label subtask dari sini.** Subtask memang node
  penuh, tapi task detail dibuat untuk memecah langkah — bukan mengelola
  metadata anak. Buka subtask-nya sendiri kalau butuh itu.
- **Progres di `TaskRow`** (mis. "2/5" di daftar Today). Nilainya jelas, tapi
  itu menyentuh komponen lain dan bisa menyusul.

---

## 4. Keputusan desain

| Keputusan | Alasan |
|---|---|
| **Satu tingkat saja** yang ditampilkan | Task detail untuk memecah langkah, bukan menjelajah pohon. Outline sudah menangani kedalaman. |
| **Pakai `toggleTaskComplete` yang sudah ada** | Subtask adalah node biasa; tidak perlu jalur penyelesaian sendiri. Ia juga sudah menangani recurring dan `completion` — menulis ulang berarti kehilangan itu. |
| **Pakai `deleteTask` yang sudah ada** | Alasan yang sama. |
| **Subtask selesai tetap ditampilkan, tercoret** | Berbeda dari daftar utama yang menyembunyikannya. Di dalam satu task, "3 dari 5 sudah" adalah informasi yang justru dicari — menyembunyikan yang selesai menghilangkan rasa progres. |
| **Tanpa nomor urut** | `rank` menentukan urutan; menomori berarti menomori ulang tiap kali ada yang dihapus. |

---

## 5. Blok kerja

Semuanya di `apps/web/src/components/NodeDetailModal.tsx`.

Data yang dibutuhkan sudah tersedia — `useAllNodes()` sudah dipanggil di
komponen itu:

```ts
const subtasks = allNodes
  .filter((n) => n.parentId === node.id && n.kind === 'item' && n.deletedAt === null)
  .sort((a, b) => (a.rank < b.rank ? -1 : 1))
```

- Daftar subtask dengan checkbox, di bawah field Note
- Header ringkas dengan progres: "Subtask 2/5"
- Input "Tambah subtask" — Enter menyimpan, Escape membatalkan
- Tiap baris punya aksi hapus
- Menambah subtask memakai `createTaskFromQuickAdd`-nya sendiri? **Tidak** —
  cukup node minimal dengan `parentId: node.id`, tanpa parsing quick-add.
  Mengurai "besok jam 9" di dalam checklist adalah kejutan, bukan fitur.

---

## 6. Success Criteria

- [ ] Membuka task menampilkan subtask-nya
- [ ] Task tanpa subtask tidak menampilkan daftar kosong yang mengganggu
- [ ] Menambah subtask langsung muncul (Dexie live query)
- [ ] Mencentang subtask menandainya selesai dan tetap tampil, tercoret
- [ ] Progres "2/5" ikut berubah saat mencentang
- [ ] Menghapus subtask menghilangkannya
- [ ] Cucu (subtask dari subtask) **tidak** ikut ditampilkan
- [ ] Subtask yang punya tanggal tetap muncul di Today seperti sebelumnya
      (perilaku lama, tidak berubah)
- [ ] `npm run verify` hijau
