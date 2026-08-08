# 3. Product Policy

Aturan soal *apa* yang dibangun — melengkapi
[1-engineering-policy.md](1-engineering-policy.md) (*bagaimana* menulis kode)
dan [2-workflow.md](2-workflow.md) (*kapan* boleh mulai dan kapan boleh
disebut selesai).

Kalau ada keputusan yang bertentangan dengan dokumen ini, dokumen ini yang
menang — kecuali kamu mengubah dokumennya dulu.

---

## 1. Things adalah pondasi, Todoist adalah tambahan

**Things 3 menentukan strukturnya. Todoist menyumbang kemampuan di atasnya.**

Bukan "salah satu menang". Keduanya bagus di hal yang berbeda:

| | Kekuatannya | Perannya di sini |
|---|---|---|
| **Things** | Struktur yang memutuskan lebih dulu apa yang pantas kamu lihat | **Pondasi** — model data dan daftar bawaan |
| **Todoist** | Kemampuan yang matang: kanban, prioritas, tanggal natural, recurring | **Tambahan** di atas pondasi itu |

Yang diambil dari Things: Area → Project → Task → subtask, dan lima daftar
bawaan (Inbox, Today, Upcoming, Anytime, Someday) plus Logbook.

Yang diambil dari Todoist: prioritas, tampilan kanban, parsing tanggal
natural saat mengetik, dan recurring.

## 2. Ujiannya: mengubah model, atau duduk di atasnya?

Ini garis yang memisahkan "tambahan yang bagus" dari "dua jawaban untuk satu
pertanyaan".

> **Kalau sebuah fitur mengubah cara data ditata, ia harus tunduk pada
> Things.**
> **Kalau ia cuma duduk di atas model yang sudah ada, ia boleh diambil dari
> mana pun — asal memang bagus.**

### Ditolak: mengubah model

| Fitur Todoist | Kenapa ditolak | Penggantinya |
|---|---|---|
| Project bersarang di project | Menjawab pertanyaan "bagaimana project dikelompokkan" dengan cara yang bertabrakan dengan Area | Area → Project (fitur 13) |
| Bahasa query filter tersimpan | Memperkenalkan mekanisme penataan kedua yang bersaing dengan daftar bawaan | Dihapus (fitur 15); Tag + Search sudah menjawabnya |
| Sebutan "label" | Dua kosakata untuk satu benda | Tag (fitur 16) |

### Diterima: duduk di atas model

| Fitur Todoist | Kenapa diterima |
|---|---|
| **Prioritas P1–P4** | Sebuah field di task. Tidak mengubah cara apa pun ditata — cuma menambah satu sumbu pengurutan. |
| **Tampilan kanban** | Cara lain merender data yang **sama persis**. Kolomnya adalah `kind='section'` yang memang sudah ada di model Things (Things menyebutnya *heading*). |
| **Tanggal natural saat mengetik** | Murni kenyamanan input. Hasil akhirnya sama dengan mengetik tanggal manual. |
| **Recurring** | Things punya juga. Bukan pilihan antara dua, cuma soal seberapa lengkap. |

Perhatikan bahwa yang diterima **tidak satu pun** menambah tempat baru untuk
menyimpan atau menata sesuatu. Itu ujiannya.

## 3. Yang tetap dijaga dari Things

Menambah kemampuan bukan alasan menambah kontrol tanpa batas. Yang berikut ini
tetap **tidak** dibangun, karena justru merusak yang membuat Things berharga:

- **Grouping & sorting yang bisa dikonfigurasi per view.** Kanban boleh, tapi
  kolomnya **selalu** section — bukan menu "kelompokkan berdasarkan
  tanggal/prioritas/label". Begitu tiap daftar punya menu penataannya
  sendiri, struktur yang sudah memutuskan lebih dulu kehilangan gunanya.
- **Menu penyaringan di tiap daftar.** Daftar bawaan sudah menyaring; itu
  memang tugasnya.

Cultured Code sendiri menyebut memilih apa yang **tidak** dibangun sebagai
yang membedakan produk dari gumpalan tanpa bentuk. Yang dijaga di sini
strukturnya, bukan kemiskinan fiturnya.

## 4. Menyimpang dari keduanya juga boleh

Asal alasannya ditulis di spec. Yang sudah diputuskan begitu:

- **Warna tag** — Things tidak punya; di sini sudah ada dan berfungsi.
- **Sigil `$nama` di quick-add** — Things tidak punya konsep sigil; punya kita
  sudah mapan dan dijaga 57 tes.
- **Subtask adalah node penuh** — Things sengaja membuat checklist item lebih
  miskin; `1.todo/spec.md` §3.1 memutuskan sebaliknya lebih dulu, dengan
  alasan yang masih berlaku (subtask *adalah* outline).
- **Toggle tampilkan task selesai** — Things hanya punya Logbook; toggle
  menjawab kebutuhan berbeda (fitur 20).

## 5. Kalau ragu

Dua pertanyaan, berurutan:

1. **Apakah ini menambah tempat baru untuk menyimpan atau menata sesuatu?**
   Kalau ya — ia harus tunduk pada model Things, atau tidak dibangun.
2. **Kalau tidak: apakah tanpa ini app-nya jadi lebih buruk untuk dipakai
   sehari-hari?** Kalau tidak juga — jangan bangun.

Pertanyaan pertama menjaga strukturnya. Yang kedua menjaga supaya "ambil yang
bagus dari keduanya" tidak berubah jadi "ambil semuanya".
