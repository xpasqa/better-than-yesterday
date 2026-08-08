# Spec: Hapus filter tersimpan

**Tanggal:** 2026-08-08
**Status:** disetujui, siap diimplementasi
**Menghapus:** `1.todo/spec.md` §7 · tabel `saved_filter` · separuh blok G `1.todo/todo.md`

---

## 1. Konteks

`1.todo/spec.md` §7 merancang bahasa query kecil untuk filter tersimpan —
lengkap dengan grammar, operator negasi `-`, dan pelaporan posisi karakter
yang gagal di-parse:

```
expr   := or
or     := and ('|' and)*
and    := unary ('&' unary)*
term   := 'today' | 'overdue' | 'no date' | '#'nama | '$'nama | ...
```

Rancangan itu **tidak pernah diimplementasi**, dan sekarang dibatalkan.

### Seberapa mati fiturnya hari ini

Diverifikasi dengan menelusuri seluruh kode:

| Bagian | Status |
|---|---|
| `core/filter.ts` (parser + predikat) | **tidak pernah ada** |
| Route sync untuk `saved_filter` | **tidak pernah ada** |
| UI apa pun | **tidak pernah ada** |
| `ViewType` `'filters'` | sudah dihapus di #20 (halamannya selalu kosong) |
| Tabel `saved_filter` | **ada di skema**, tapi tidak pernah dibaca maupun ditulis |

Yang tersisa hanya **skema mati**: definisi tabel, registrasinya di
`db/client.ts`, satu penyebutan di `truncate` milik test helper, dan
beberapa komentar.

## 2. Kenapa dihapus, bukan ditunda

Skema mati bukan sekadar netral — ia berbohong. Siapa pun yang membaca
`db/client.ts` atau daftar tabel akan menyimpulkan fitur ini ada atau
setidaknya sedang dikerjakan. Migrasi berikutnya harus memikirkannya. Tes
harus terus me-`truncate`-nya.

Search — satu-satunya bagian blok G yang benar-benar dibutuhkan — sudah
dipisah jadi fiturnya sendiri (fitur 12) dan tidak bergantung pada §7.

## 3. Scope

**In:**
- Drop tabel `saved_filter` (migrasi)
- Hapus `db/schema/saved-filter.ts` dan registrasinya di `db/client.ts`
- Bersihkan penyebutannya di `test/helpers.ts` dan komentar terkait
- Hapus §7 dari `1.todo/spec.md`, sisakan catatan bahwa ia dibatalkan
- Perbarui blok G `1.todo/todo.md` — tinggal search

**Out:**
- **Menyentuh Search** — sudah berdiri sendiri di fitur 12
- **Mengganti dengan fitur lain.** Tidak ada penggantinya. Kalau nanti butuh
  penyaringan, Search dan tag sudah menjawab sebagian besar kebutuhan; sisanya
  keputusan baru, bukan utang dari §7.

## 4. Keputusan desain

| Keputusan | Alasan |
|---|---|
| **Drop tabel, bukan biarkan** | Tabel yang tidak pernah dibaca tetap menagih biaya: dipikirkan tiap migrasi, di-`truncate` tiap tes, disalahpahami tiap orang baru. |
| **Coret §7, jangan hapus diam-diam** | Rancangan itu punya alasan yang ditulis rapi. Menghapusnya tanpa jejak membuat orang mengusulkannya lagi dari nol. Dicoret + diberi catatan kenapa dibatalkan. |
| **Tidak perlu migrasi data** | Tabelnya tidak pernah punya satu baris pun — tidak ada yang perlu diselamatkan. |

## 5. Success Criteria

- [ ] `saved_filter` tidak ada lagi di database
- [ ] Tidak ada satu pun rujukan `savedFilter`/`saved_filter` tersisa di kode
- [ ] `1.todo/spec.md` §7 dicoret dengan catatan pembatalan
- [ ] Blok G `1.todo/todo.md` tinggal search
- [ ] `npm run verify` hijau; 45 tes `apps/api` tetap lulus
