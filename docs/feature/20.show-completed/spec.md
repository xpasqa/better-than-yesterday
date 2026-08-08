# Spec: Toggle tampilkan/sembunyikan task selesai

**Tanggal:** 2026-08-08
**Status:** disetujui, siap diimplementasi
**Menutup:** issue #30
**Berdampingan dengan:** fitur 17 (Logbook) — keduanya dikerjakan, bukan salah satu

---

## 1. Konteks

Task yang dicentang **langsung hilang tanpa jejak** dari Today, Inbox,
Upcoming, dan Project. Tidak ada pilihan untuk menahannya tetap terlihat.

Berbeda dengan Outline, yang justru sudah menampilkan item selesai dengan
gaya tercoret (`OutlineView.tsx:194`, kelas `.outline-node--completed`) —
karena Outline tidak lewat filter yang sama.

### Akarnya

`packages/core/src/views.ts`:

```ts
function isActiveItem(n: Node): boolean {
  return n.kind === 'item' && n.deletedAt === null && n.completedAt === null
}
```

Dipakai **seluruh** fungsi view (`today`, `upcoming`, `project`, `inbox`),
tanpa opsi untuk memuat yang selesai.

### Yang sudah siap tapi tidak terpakai

`TaskRow.tsx` sudah lengkap menangani item selesai:

- `const done = node.completedAt !== null` → kelas `task-row--done`
- `TaskRow.css:81` — `text-decoration: line-through`, warna redup

Tinggal itemnya yang tidak pernah sampai ke sana.

## 2. Hubungannya dengan Logbook

Keduanya dikerjakan. Menjawab kebutuhan berbeda:

| | Menjawab |
|---|---|
| **Toggle** (spec ini) | *"Saya baru mencentang ini, biarkan terlihat tercoret"* — konteks sesaat, di tempat |
| **Logbook** (fitur 17) | *"Apa saja yang saya selesaikan minggu lalu?"* — riwayat, terpisah |

Sumber datanya sama (`completedAt` dan tabel `completion`), jadi tidak ada
duplikasi maupun kemungkinan keduanya berbeda pendapat.

## 3. Batasan yang harus jujur disebut

**Task recurring tidak akan pernah muncul sebagai "selesai" di view mana pun,
seberapa pun toggle-nya dinyalakan.**

Sejak fitur recurring (#23), mencentang task berulang **tidak menutupnya** —
`due_date`-nya maju dan `completedAt` tetap `null`. Riwayatnya hanya ada di
tabel `completion`, yang dibaca Logbook.

Ini konsekuensi wajar dari perilaku recurring yang memang diinginkan, bukan
cacat toggle ini. Tapi harus ditulis di sini, karena kalau tidak, orang akan
melaporkannya sebagai bug.

## 4. Scope

**In:**
- Satu setelan "tampilkan task selesai", tersimpan antar-sesi
- Berlaku di Today, Inbox, Upcoming, Project — dan Anytime/Someday begitu
  fitur 18 selesai
- Task selesai tampil **di tempatnya**, tercoret

**Out (dengan alasan):**
- **Search.** Fitur 12 sudah memutuskan search **selalu** memuat task selesai
  — orang mencari justru karena ingat pernah mengerjakannya. Toggle ini tidak
  berlaku di sana, dan itu disengaja.
- **Outline.** Sudah menampilkan item selesai sejak awal, lewat jalur berbeda.
  Tidak disentuh.
- **Menyembunyikan yang selesai setelah sekian lama** (mis. auto-hide setelah
  sehari) — Things melakukan sesuatu semacam itu. Di sini menambah timer dan
  aturan usia demi masalah yang belum pernah dikeluhkan.

## 5. Keputusan desain

| Keputusan | Alasan |
|---|---|
| **Satu setelan global**, bukan per-view | Orang memutuskan "saya mau lihat yang selesai" sekali, bukan empat kali. Per-view berarti empat keadaan yang harus diingat dan ditampilkan. |
| **Disimpan di `localStorage`** | Mengikuti pola `useTheme` yang sudah ada di repo. Setelan yang lupa tiap muat ulang lebih mengganggu daripada tidak ada setelan sama sekali. |
| **Tombolnya tetap di header tiap view** | Setelannya global, tapi tempat orang menyadari butuhnya adalah saat menatap daftar. Menyembunyikannya di halaman setelan (yang bahkan belum ada) membuatnya tak pernah ditemukan. |
| **Task selesai tampil di tempatnya**, bukan dikumpulkan di bawah | Menjaga konteks — "ini sudah, dan letaknya memang di antara dua ini". Mengumpulkan di bawah butuh pengurutan tambahan demi hasil yang justru kurang informatif. |
| **Parameter di `views.ts`**, bukan menyaring di komponen | Kalau tiap view menyaring sendiri, empat tempat harus sepakat. Satu parameter di fungsi murni jauh lebih mudah diuji. |

## 6. Blok kerja

### A. Core — `packages/core/src/views.ts`

```ts
function isActiveItem(n: Node, includeCompleted = false): boolean {
  return n.kind === 'item'
    && n.deletedAt === null
    && (includeCompleted || n.completedAt === null)
}

export function today(nodes: Node[], todayStr: string, includeCompleted?: boolean): { overdue: Node[]; today: Node[] }
export function upcoming(nodes: Node[], todayStr: string, includeCompleted?: boolean): Array<{ date: string; items: Node[] }>
export function project(nodes: Node[], projectId: string, includeCompleted?: boolean): Node[]
export function inbox(nodes: Node[], includeCompleted?: boolean): Node[]
```

Default `false` di semua — perilaku sekarang tidak berubah sampai
pemanggilnya meminta.

### B. UI

- Hook `useShowCompleted()` — `[value, toggle]`, tersimpan di `localStorage`,
  polanya mengikuti `useTheme`
- Tombol di header `TodayReal`, `InboxReal`, `UpcomingReal`, `ProjectReal`
- `TaskRow` **tidak perlu diubah** — `task-row--done` sudah ada

## 7. Success Criteria

- [ ] Toggle mati (default): perilaku sama persis seperti sekarang
- [ ] Toggle nyala: task selesai tampil **tercoret**, di posisi semestinya
- [ ] Setelan bertahan setelah muat ulang halaman
- [ ] Menyalakan di satu view menyalakannya di semua view
- [ ] Search tetap selalu memuat task selesai, tak terpengaruh toggle
- [ ] Outline tidak berubah sama sekali
- [ ] Task recurring tetap tidak muncul sebagai selesai — sesuai §3
- [ ] `npm run verify` hijau; fungsi `views.ts` tetap 100% branch coverage
