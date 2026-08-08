# Spec: Halaman kelola tag

**Tanggal:** 2026-08-08
**Status:** disetujui, siap diimplementasi
**Bergantung pada:** fitur 16 (Label → Tag) — dikerjakan setelahnya
**Melengkapi:** `1.todo/spec.md` blok F ("Warna/favorit/rename label lewat UI — belum ada")

---

## 1. Konteks

Tag hari ini cuma bisa **dibuat**, tidak pernah bisa diubah:

| Fungsi di `label-actions.ts` | Ada? |
|---|---|
| `createLabelFromUI` | ✓ |
| `resolveOrCreateLabelIds` (dari `$nama` quick-add) | ✓ |
| rename | ✗ |
| ubah warna | ✗ |
| hapus | ✗ |

Akibatnya satu salah ketik — `$kerjaa` — hidup selamanya, dan warna yang
dipilih saat membuat tidak pernah bisa diperbaiki.

## 2. Kenapa rename justru murah di sini

`1.todo/spec.md` §3.2 sudah merancangnya sejak awal:

> Label adalah entitas, bukan string [...] mengganti nama satu label **tidak
> boleh menyentuh satu baris `node` pun**: `node.labelIds` menyimpan id,
> tidak pernah nama.

Jadi rename = **satu baris di tabel `tag`**. Tidak ada penelusuran, tidak ada
pembaruan massal, tidak ada risiko sebagian gagal. Rancangan itu selama ini
membayar ongkosnya (id, bukan string) tanpa pernah menikmati hasilnya.
Fitur ini yang menagihnya.

## 3. Temuan: nama kembar adalah bahaya nyata

`resolveOrCreateLabelIds` mencocokkan tag begini:

```ts
const found = active.find((l) => l.name.toLowerCase() === normalized)
```

`.find()` mengambil **yang pertama ketemu**. Selama tag hanya bisa dibuat
lewat jalur yang mengecek duplikat, itu aman. Begitu rename ada, dua tag bisa
punya nama sama — dan sejak itu `$nama` di quick-add menempel ke salah satu
secara sewenang-wenang, berubah-ubah sesuai urutan array.

**Rename wajib menolak nama yang bentrok** (case-insensitive) dengan tag lain
yang masih hidup. Ini bukan kemewahan; tanpanya fitur ini memperkenalkan bug
yang sulit dilacak.

## 4. Scope

**In:**
- Halaman `/tags` + nav sidebar
- Rename tag (dengan penjagaan bentrok nama)
- Ubah warna tag
- Hapus tag (soft-delete)
- Jumlah pemakaian per tag

**Out (dengan alasan):**
- **Membuat tag dari halaman ini.** Tag lahir dari `$nama` di quick-add atau
  dari `CreateTagModal` di task detail — dua jalur yang sudah ada dan sudah
  pas. Jalur ketiga hanya menambah tempat yang harus dijaga konsisten.
- **Tag favorit.** Kolom `isFavorite` ada di tabel, tapi tidak ada satu pun
  tempat di UI yang menampilkan tag favorit. Toggle yang tidak berefek ke
  mana pun adalah ongkos tanpa hasil — sama alasannya dengan favorit area
  yang ditolak di fitur 13.
- **Menggabungkan dua tag** (merge). Berguna setelah salah ketik terlanjur
  dipakai, tapi butuh penulisan massal ke `node.tagIds` — persis hal yang
  §3.2 rancang untuk dihindari. Keputusan tersendiri kalau nanti benar-benar
  dibutuhkan.
- **View per tag** (klik tag → semua task bertag itu). Fitur tersendiri;
  halaman ini soal mengelola, bukan menjelajah.

## 5. Keputusan desain

| Keputusan | Alasan |
|---|---|
| **Hapus = soft-delete saja**, `node.tagIds` tidak disentuh | `TaskRow.tsx:46` dan `NodeDetailModal.tsx:95` sudah melakukan `.map(id => tagsById.get(id)).filter(Boolean)` — id yatim otomatis lenyap dari tampilan. Menyapu `tagIds` di seluruh node berarti penulisan massal demi sesuatu yang **sudah tidak terlihat**. |
| **Tapi id yatim memang tertinggal di data** | Konsekuensi jujur dari keputusan di atas: `tagIds` menyimpan id tag yang sudah dihapus, selamanya. Tidak kelihatan, tidak berbahaya (uuid tidak akan terpakai ulang), tapi ada. Kalau nanti mengganggu, bersih-bersihnya satu skrip sekali jalan — bukan alasan menulis massal sekarang. |
| **Rename menolak nama bentrok**, bukan menggabungkan otomatis | Menggabungkan diam-diam berarti memindahkan task antar-tag tanpa diminta. Menolak dengan pesan jelas membuat user yang memutuskan. |
| **Jumlah pemakaian dihitung di klien** | Seluruh node sudah ada di memori lewat `useAllNodes()`. Menghitungnya sepele, dan angkanya penting justru sebelum menghapus. |
| **Aturan nama sama persis dengan saat membuat** | 1–60 karakter, tanpa spasi — karena nama itu **adalah** token `$nama`. Rename yang mengizinkan spasi akan menghasilkan tag yang tidak bisa diketik lagi di quick-add. |

## 6. Blok kerja

### A. Store — `apps/web/src/store/tag-actions.ts`

```ts
/** Ganti nama dan/atau warna. Menolak diam-diam kalau nama bentrok dengan tag lain. */
export async function updateTag(
  id: string,
  patch: { name?: string; color?: string },
): Promise<{ ok: true } | { ok: false; reason: 'duplicate-name' | 'invalid-name' }>

/** Soft-delete. `node.tagIds` sengaja tidak disentuh — lihat spec §5. */
export async function deleteTag(id: string): Promise<void>
```

- Validasi nama: 1–60 karakter setelah trim, tanpa spasi
- Bentrok: ada tag lain hidup dengan nama sama (case-insensitive)
- Mengembalikan hasil bertipe, bukan melempar — pemanggilnya perlu
  menampilkan pesan, bukan menangkap exception

### B. Halaman — `apps/web/src/components/TagsView.tsx`

- Daftar seluruh tag hidup, urut `rank`
- Tiap baris: titik warna, nama, jumlah pemakaian, aksi ubah & hapus
- Ubah: inline atau modal kecil — nama + swatch warna
- Hapus: konfirmasi yang **menyebut jumlah task** yang memakainya
- Kondisi kosong yang mengarahkan kalau belum ada tag

## 7. Success Criteria

- [ ] `/tags` bisa dibuka dari sidebar dan langsung dari URL
- [ ] Rename tag langsung terlihat di semua task yang memakainya, **tanpa**
      satu baris `node` pun berubah
- [ ] Rename ke nama yang sudah dipakai tag lain ditolak dengan pesan jelas
- [ ] Rename ke nama berspasi ditolak
- [ ] Ubah warna langsung terlihat di semua task yang memakainya
- [ ] Hapus tag menghilangkannya dari semua task, tanpa error
- [ ] Konfirmasi hapus menyebut jumlah task yang memakainya
- [ ] Jumlah pemakaian per tag benar
- [ ] `npm run verify` hijau
