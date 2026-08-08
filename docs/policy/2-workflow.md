# 2. Workflow Policy

Aturan alur kerja dari ide sampai selesai. Berlaku untuk semua fitur, semua
sesi agent, tanpa kecuali. Kalau ada keputusan yang bertentangan dengan
dokumen ini, dokumen ini yang menang — kecuali kamu mengubah dokumennya dulu.

Melengkapi [1-engineering-policy.md](1-engineering-policy.md): dokumen itu
mengatur *bagaimana menulis kode*, dokumen ini mengatur *kapan kode boleh
mulai ditulis dan kapan boleh disebut selesai*.

**Ini aturan wajib, bukan saran.** Tidak ada jalur cepat, tidak ada
pengecualian "cuma sebentar ini".

---

## 1. Alur

```
brainstorm  →  spec.md  →  plan.md + todo.md + issue  →  kerja  →  terverifikasi
   Inbox        Backlog              Ready              Ongoing   Review → Done
   ╰── issue biasa ──╯               ╰────────── [EPIC] ──────────────────╯
```

Papan proyek adalah **keluaran** alur ini, bukan tempat menampung pikiran
yang lewat. Tidak ada yang masuk papan tanpa melewati setiap tahap, berurutan.

**Satu fitur = satu kartu, selamanya.** Ia lahir sebagai issue biasa, berubah
jadi `[EPIC]` saat masuk Ready, dan sejak itu issue-issue detailnya dilacak
di dalamnya — tidak pernah jadi kartu terpisah.

---

## 2. Enam kolom

Tiap kolom punya **gate masuk** (semua syarat harus terpenuhi) dan **gate
keluar** (apa yang harus dihasilkan untuk pindah). Kartu yang tidak memenuhi
gate masuk kolomnya sendiri tidak berhak ada di situ — pindahkan mundur.

### Inbox — ide mentah

- **Masuk:** ide yang layak disimpan. Belum ada tulisan apa-apa.
- **Keluar:** `spec.md` ditulis → Backlog.
- Ide boleh mengendap di sini selamanya. Ini satu-satunya kolom tanpa tekanan.

### Backlog — sudah di-spec, belum di-plan

- **Masuk:** `docs/feature/<n>.<slug>/spec.md` ada, memuat *apa* dan
  *kenapa*, dengan alasan untuk tiap keputusan dan daftar out-of-scope yang
  eksplisit.
- **Keluar:** `plan.md` + `todo.md` ditulis, issue detail dibuat, dan kartunya
  **dipromosikan jadi epic** yang me-list issue-issue itu → Ready.
- Spec yang cuma bilang *apa* tanpa *kenapa* belum selesai. "Kenapa" itulah
  yang mencegah orang berikutnya memperdebatkan ulang hal yang sama.

### Ready — lengkap, belum dimulai

- **Masuk:** keempatnya harus benar —
  1. `spec.md` lengkap
  2. `plan.md` lengkap (langkah demi langkah, per blok)
  3. `todo.md` lengkap
  4. Kartunya sudah `[EPIC]` dan me-list tiap issue detail sebagai checklist
- **Keluar:** ada yang benar-benar mulai → Ongoing.
- Apa pun di sini harus bisa diambil **tanpa bertanya satu pertanyaan pun**.
  Kalau saat mulai muncul pertanyaan, itu kartu Backlog yang menyamar jadi
  Ready — kembalikan dan perbaiki spec-nya.

### Ongoing — sedang dikerjakan

- **Masuk:** kerja benar-benar dimulai (branch/worktree ada, commit pertama
  jalan).
- **Keluar:** implementasi selesai, tes hijau, sudah di-push → Review.
- **Batas WIP: satu fitur saja.** Di dalam fitur itu, ikuti urutan
  ketergantungan yang ditulis epic-nya. Beberapa fitur setengah jadi
  bersamaan adalah cara tercepat kehilangan konteks.

### Review — sudah dibangun, belum dipercaya

- **Masuk:** implementasi selesai dan sudah di-push; `npm run verify` hijau.
- **Keluar:** review lolos **dan** verifikasi benar-benar dijalankan → Done.
- **Self-review dan AI review dua-duanya sah.** Tidak perlu manusia kedua.
- Untuk perubahan berisiko, **utamakan review berkonteks segar** — agent yang
  belum melihat percakapan implementasinya — ketimbang membaca ulang diff
  sendiri. Bedanya terukur di repo ini: whole-branch review pada recurring
  tasks menangkap dua bug serius (sync macet permanen, dan "perbaikan"
  quick-add yang diam-diam mematikan 6 dari 8 pola) yang lolos dari sembilan
  review per-task berturut-turut.

### Done — selesai dan terbukti

- **Masuk:** semuanya —
  1. Merged ke `master`
  2. Issue tertutup
  3. `npm run verify` hijau **di hasil merge**, bukan cuma di branch
  4. Verifikasi atas klaim fitur itu **benar-benar dijalankan**
- Tidak ada yang keluar dari Done.

> **Verifikasi yang belum dijalankan menahan kartu di Review — tidak lolos ke
> Done.** Menulis gap-nya jadi issue tersendiri itu cara *melacak*, bukan cara
> *melewati*. Recurring tasks adalah contoh hidupnya: merged ke production,
> `verify` hijau, semua sub-issue tertutup — tapi tidak pernah sekalipun
> diklik di browser sungguhan (issue #24). Kartunya duduk di **Review**, bukan
> Done, karena "sudah merged" dan "terbukti jalan" adalah dua klaim berbeda.

---

## 3. Bentuk kartu per kolom

**Kartu itu issue biasa sampai Ready, baru kemudian jadi epic.**

| Kolom | Kartunya | Kenapa |
|---|---|---|
| Inbox | issue biasa | Masih ide. Belum cukup jelas untuk dipecah. |
| Backlog | issue biasa | Sudah di-spec, tapi belum dipecah — belum ada daftar untuk di-index. |
| Ready → Done | **epic** | Planning sudah menentukan potongannya, jadi kartunya bisa jadi daftar isi. |

**Apa pun yang masih belum jelas tetap issue biasa.** Checklist epic tidak
bisa ditulis sebelum tahu apa saja issue-nya — dan itu justru hasil dari
planning. Mempromosikan kartu yang masih kabur jadi `[EPIC]` cuma
menghasilkan daftar isi yang kosong.

Perpindahan **Backlog → Ready** karena itu adalah tempat promosinya: kartu
di-retitle jadi `[EPIC] <fitur>`, lalu diisi checklist issue detail yang baru
saja lahir dari planning.

---

## 4. Hanya epic yang jadi kartu

Begitu sebuah kartu jadi epic, issue-issue detailnya hidup di GitHub dan
ditautkan dari checklist epic — tapi **tidak** ditambahkan sebagai kartu.
Papan yang menampilkan tiap sub-issue adalah papan kotor: kolomnya berhenti
menunjukkan "fitur mana yang sedang jalan" dan berubah jadi "file mana yang
sedang disunting".

```
Papan  →  #31 [EPIC] Search       ← satu-satunya kartu
              ├── #32  Blok A      ← issue sungguhan, dilacak lewat
              ├── #33  Blok B         checklist epic, BUKAN kartu
              └── #34  Blok C
```

Kolom epic **diturunkan dari issue-issuenya, tidak pernah di-set tangan**:

| Epic pindah ke | Kapan |
|---|---|
| Ready | semua issue-nya sudah ditulis dan belum dimulai |
| Ongoing | **ada** satu issue yang mulai |
| Review | **semua** issue sudah diimplementasi dan di-push |
| Done | **semua** issue sudah merged dan tertutup |

Epic karena itu selalu berada di posisi *paling belakang* di antara
issue-issuenya. Ia tidak bisa Done selama masih ada satu issue terbuka.

---

## 5. Bergerak mundur

Demosi itu normal, bukan kegagalan. Justru itu yang menjaga kolom tetap jujur.

| Pemicu | Tindakan |
|---|---|
| Muncul pertanyaan yang tidak dijawab spec | Ready/Ongoing → **Backlog**, perbaiki spec dulu |
| Review menemukan cacat desain, bukan sekadar bug | Review → **Backlog** (spec-nya yang salah), bukan → Ongoing |
| Review menemukan bug biasa | Review → **Ongoing** |
| Kerjaan ditinggalkan di tengah jalan | Ongoing → **Ready**, dan tuliskan alasannya di issue |
| Scope membengkak melewati yang dicakup spec | Pecah: bagian barunya jadi **kartu Inbox baru** — jangan pernah melebarkan kartu yang sedang jalan |

---

## 6. Aturan wajib

1. **Tiap brainstorm berakhir jadi issue.** Sesi brainstorming belum selesai
   sampai menghasilkan `spec.md`, `plan.md`, `todo.md`, dan epic + issue
   detailnya di GitHub. Baru setelah itu masuk **Ready**.
2. **Issue detail milik epic tidak pernah jadi kartu.** Mereka hidup di GitHub
   dan dilacak lewat checklist epic. (Kartu Inbox dan Backlog berupa issue
   biasa — itu satu-satunya kasus non-epic jadi kartu.)
3. **Satu papan, satu kartu per fitur.** Jangan bikin papan terpisah per
   fitur, dan jangan biarkan satu fitur menempati lebih dari satu kartu.
4. **Tidak ada yang masuk Ready setengah jadi.** Spec tanpa plan berarti
   **Backlog**, bukan Ready. Pembedaan inilah seluruh alasan punya dua kolom.
5. **Satu fitur di Ongoing pada satu waktu.** Selesaikan atau parkir secara
   eksplisit sebelum mulai yang berikutnya.
6. **Dilarang lompat kolom.** Inbox → Backlog → Ready → Ongoing → Review →
   Done, berurutan. Perbaikan sepele yang terasa layak jalan pintas justru
   bukti bahwa ia semestinya ide Inbox, bukan kartu yang dipercepat.
7. **Done mewajibkan verifikasi benar-benar dijalankan.** Kartu yang
   verifikasinya belum jalan tetap di **Review**, sehijau apa pun tesnya.
   Menulis gap-nya jadi issue itu untuk melacak, bukan pengganti menjalankan.

---

## 7. Perintah papan

```bash
gh project view 7 --owner xpasqa                  # lihat papan
gh project item-list 7 --owner xpasqa             # isi papan
gh project item-add 7 --owner xpasqa --url <issue-url>
gh project field-list 7 --owner xpasqa            # id field + opsi
```
