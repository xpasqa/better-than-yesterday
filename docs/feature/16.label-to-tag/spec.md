# Spec: Label → Tag (ala Things 3)

**Tanggal:** 2026-08-08
**Status:** disetujui, siap diimplementasi

---

## 1. Konteks

App ini memakai istilah **label** (warisan Todoist). Model organisasinya
sekarang bergerak ke Things 3 (Area → Project, fitur 13), dan Things
menyebutnya **tag**. Dokumen, issue, dan UI jadi memakai dua kosakata untuk
satu benda.

## 2. Riset: tag di Things 3

| Perilaku | Things | Di sini |
|---|---|---|
| Bisa di-nest (tag induk/anak) | ✓ | ✗ |
| Punya warna | tidak didokumentasikan | ✓ (sudah jalan) |
| Bisa dipasang di to-do | ✓ | ✓ |
| Bisa dipasang di project & area | ✓ | ada di model (`labelIds` di `node`), belum ada UI-nya |
| Item di dalam list **mewarisi** tag list-nya | ✓ | ✗ |
| Filter bar per-list | ✓ | ✗ |

Kutipan yang paling menjelaskan: *"you can also tag your lists. When you tag
a list, all of the items inside the list **inherit** that tag."*

## 3. Scope

**In — hanya penggantian nama.**

`label` → `tag` di seluruh lapisan: tipe core, tabel database, kolom
`node.labelIds`, kontrak sync, tabel Dexie, dan seluruh UI.

**Out — dan ini bagian penting dari spec ini.**

| Tidak dikerjakan | Alasan |
|---|---|
| **Tag bersarang** | Things punya, tapi belum ada yang membutuhkannya. Nesting berarti kolom `parentId` di tabel tag, picker bertingkat, dan query yang harus menelusuri leluhur. YAGNI sampai ada kasus nyata. |
| **Pewarisan tag dari list ke isinya** | Perilaku Things yang paling khas, dan paling mahal: setiap query "item bertag X" harus menelusuri leluhur. Lebih menentukan lagi — **belum ada view yang menampilkan item per tag**, jadi pewarisannya tidak akan terlihat di mana pun. Membangun perilaku yang tak kasat mata adalah definisi pekerjaan sia-sia. |
| **View per tag** | `1.todo/spec.md` §6 mendaftarkannya ("Label — semua task ber-label itu") tapi tak pernah dibangun. Fitur tersendiri, bukan bagian penggantian nama. |
| **Kelola tag** (rename/warna/hapus) | Belum ada halamannya. Fitur tersendiri. |
| **Memasang tag di project/area** | Butuh UI di `ProjectModal` yang sedang dikerjakan fitur 13. Menunggu itu selesai. |

## 4. Keputusan desain

| Keputusan | Alasan |
|---|---|
| **Ganti nama sampai ke database**, bukan cuma UI | Setengah-ganti lebih buruk dari dua-duanya: UI bilang "tag", database bilang "label", dan setiap orang yang membacanya tersandung selamanya. |
| **Warna dipertahankan** | Things tidak mendokumentasikan warna tag, tapi di sini warnanya sudah ada dan berfungsi. Membuang fitur yang jalan demi menyamai app lain persis-persis adalah meniru tanpa alasan. |
| **Sigil `$` dipertahankan** | `$nama` di quick-add sudah mapan dan dijaga 57 tes parser. Things tidak punya konsep sigil untuk ditiru. Tidak ada yang perlu diperbaiki. |
| **Nama tag tetap tanpa spasi** | CHECK `label_name_shape` melarang spasi karena nama itu **adalah** token `$nama`. Mengizinkan spasi berarti merombak parser. Tag multi-kata pakai tanda hubung: `$deep-work`. Ini menyimpang dari Things, dan disengaja. |

## 5. Jujur soal ongkosnya

Perubahan ini **nol perubahan perilaku**. Tidak ada yang bisa dilakukan
sesudahnya yang tidak bisa dilakukan sebelumnya. Yang didapat cuma satu:
seluruh kode, dokumen, dan UI memakai satu kata.

Ongkosnya nyata: dua penggantian nama di database (tabel `label`, kolom
`node.label_ids`), satu perubahan format wire (`changes.labels` →
`changes.tags`), satu migrasi Dexie, dan sekitar 38 berkas tersentuh.

Yang membuatnya layak: kosakata yang bercabang itu menagih ongkosnya
selamanya, dan makin mahal tiap kali ada dokumen baru ditulis. Sekarang
adalah saat termurah untuk membereskannya — sebelum tag view dan pengelolaan
tag dibangun di atas nama yang salah.

Karena murni mekanis, `npm run typecheck` menangkap hampir semua kelalaian.

## 6. Success Criteria

- [ ] Tidak ada lagi identifier `label`/`Label` yang merujuk konsep ini
- [ ] Tabel `tag`, kolom `node.tag_ids` di database
- [ ] Sync mengirim `changes.tags`; klien dan server seiring
- [ ] Dexie punya tabel `tags`; data lama ikut termigrasi, tidak hilang
- [ ] Token `$nama` di quick-add tetap berfungsi persis seperti sebelumnya
- [ ] Warna tag tetap berfungsi
- [ ] `npm run verify` hijau; seluruh 231 tes lulus
