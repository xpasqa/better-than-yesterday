# 3. Product Policy

Aturan soal *apa* yang dibangun — melengkapi
[1-engineering-policy.md](1-engineering-policy.md) (*bagaimana* menulis kode)
dan [2-workflow.md](2-workflow.md) (*kapan* boleh mulai dan kapan boleh
disebut selesai).

Kalau ada keputusan yang bertentangan dengan dokumen ini, dokumen ini yang
menang — kecuali kamu mengubah dokumennya dulu.

---

## 1. Things 3 adalah acuan utama

**Kalau rancangan Things 3 (Cultured Code) dan Todoist bertentangan, Things
menang.** Fitur bergaya Todoist yang bentrok dihapus, bukan didampingkan.

App ini lahir meniru Todoist, lalu berpindah haluan ke Things. Membiarkan
keduanya hidup berdampingan menghasilkan app yang punya dua jawaban untuk
satu pertanyaan — dan itu lebih buruk daripada memilih salah satu dengan
tegas.

### Kenapa Things, bukan Todoist

Todoist menambah kontrol: prioritas, filter, grouping, board, sorting.
Things menghapusnya, dan menggantinya dengan struktur — Area, Project,
dan lima list bawaan yang memutuskan lebih dulu apa yang pantas kamu lihat.

(Dari daftar itu, **prioritas tetap dipertahankan** di sini — alasannya di
§3. Sisanya dihapus.)

Yang dikutip Cultured Code sendiri: menolak permintaan fitur dan memilih apa
yang **tidak** dibangun adalah yang membedakan produk dari gumpalan tanpa
bentuk.

Untuk app satu pengguna, arah itu lebih tepat. Setiap kontrol tambahan adalah
keputusan yang harus diambil ulang tiap kali membuka app.

## 2. Cara menerapkannya

Bedakan dua hal, karena penanganannya berbeda:

| | Artinya | Tindakan |
|---|---|---|
| **Bentrok** | Dua rancangan menjawab pertanyaan yang sama dengan cara yang tidak bisa hidup bersama | Yang Todoist **dihapus** |
| **Sekadar tidak ada di Things** | Things tidak punya fiturnya, tapi tidak ada yang bertabrakan | Ditimbang kasus per kasus, defaultnya **jangan bangun** |

Contoh bentrok yang sudah diputuskan:

| Pertanyaan | Todoist | Things | Hasil |
|---|---|---|---|
| Bagaimana project dikelompokkan? | project bersarang di project | Area → Project | Area menang (fitur 13) |
| Bagaimana menyaring lintas daftar? | bahasa query filter tersimpan | tidak ada; Tag + pencarian | Filter dihapus (fitur 15) |
| Apa sebutan penanda lintas-daftar? | label | tag | Tag menang (fitur 16) |
| Bagaimana task ditampilkan? | list **dan** papan kanban | hanya list | Board dihapus (`1.todo/spec.md` §6) |
| Bagaimana daftar diatur? | grouping & sorting yang bisa dikonfigurasi | struktur yang sudah memutuskan lebih dulu | Grouping/sorting dihapus (`1.todo/spec.md` §6) |

## 3. Yang tetap boleh menyimpang

Menyalin Things persis-persis bukan tujuannya. Menyimpang **boleh, asal
alasannya ditulis di spec**. Yang sudah diputuskan begitu:

- **Warna tag** — Things tidak punya; di sini sudah ada dan berfungsi.
  Membuang fitur yang jalan demi menyamai app lain adalah meniru tanpa alasan.
- **Sigil `$nama` di quick-add** — Things tidak punya konsep sigil. Punya kita
  sudah mapan dan dijaga 57 tes.
- **Subtask adalah node penuh** — Things sengaja membuat checklist item lebih
  miskin; `1.todo/spec.md` §3.1 memutuskan sebaliknya lebih dulu, dengan
  alasan yang masih berlaku (subtask *adalah* outline).
- **Toggle tampilkan task selesai** — Things hanya punya Logbook. Toggle
  diminta eksplisit dan menjawab kebutuhan berbeda (fitur 20).
- **Prioritas P1–P4** — Things sengaja tidak punya level prioritas;
  penjadwalan dan list Today-lah mekanisme prioritasnya. **Di sini
  dipertahankan** (diputuskan 2026-08-08).

  Alasannya justru pembedaan di §2: prioritas **tidak bentrok** dengan apa
  pun di rancangan Things — tidak ada dua jawaban untuk satu pertanyaan, ia
  cuma tambahan. Yang dihapus adalah yang bertabrakan, bukan segala sesuatu
  yang absen dari Things.

  Ini juga menandai batas aturannya: "Things menang" berlaku saat **harus
  memilih**, bukan sebagai perintah memangkas app sampai persis menyerupai
  Things.

Polanya: menyimpang karena **ada alasan yang lebih kuat di konteks kita**,
bukan karena belum sempat menyesuaikan.

## 4. Kalau ragu

Pertanyaannya bukan *"apakah fitur ini berguna?"* — hampir semua fitur
berguna bagi seseorang. Pertanyaannya:

> Apakah tanpa ini app-nya jadi tidak bisa dipakai?

Kalau tidak, jangan bangun. Itu yang membuat Things tetap Things.
