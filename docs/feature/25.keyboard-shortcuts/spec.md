# Spec: Keyboard shortcut

**Tanggal:** 2026-08-08
**Status:** disetujui, siap diimplementasi
**Menutup:** `1.todo/todo.md` blok E baris "`q`/`a` quick add" · blok J baris "Keyboard shortcut"

---

## 1. Konteks

App ini **tidak punya satupun shortcut global**. Yang ada cuma penanganan
tombol di dalam form (Enter mengirim, Escape membatalkan) dan tiga modal yang
mendaftarkan `document.addEventListener('keydown')` sendiri untuk Escape
(`NodeDetailModal.tsx:77`, `CreateLabelModal.tsx:33`,
`AgentSettingsModal.tsx:55`).

Tiga modal itu penting: mereka membuktikan polanya sudah ada di codebase, dan
sekaligus jadi **hal yang paling gampang dirusak** oleh handler global baru.

---

## 2. Scope

**In** — enam shortcut:

| Tombol | Aksi |
|---|---|
| `q` | Buka quick-add di view mana pun |
| `a` | Tambah task di view yang sedang terbuka |
| `/` | Buka Search |
| `g` lalu `i` / `t` / `u` | Pindah ke Inbox / Today / Upcoming |
| `?` | Tampilkan daftar shortcut |
| `Escape` | Tutup yang sedang terbuka (sudah ada, dibiarkan) |

**Out (dengan alasan):**
- **`⌘Z` undo** — bukan shortcut, melainkan fitur undo yang kebetulan punya
  shortcut. Ia butuh tumpukan aksi yang bisa dibalik di atas outbox dan
  Dexie, dan keputusan soal apa yang bisa dibatalkan setelah tersinkron.
  Kartunya sendiri ([#76](https://github.com/xpasqa/better-than-yesterday/issues/76)).
- **Shortcut yang bisa diubah user** — belum ada yang memintanya, dan itu
  berarti menyimpan pemetaan, UI-nya, dan penanganan bentrok.
- **Navigasi panah di daftar task** — butuh konsep "baris terpilih" yang
  belum ada di komponen mana pun. Pekerjaan tersendiri.
- **`⌘K` command palette** — [spec 12](../12.search/spec.md) sudah memutuskan
  Search adalah halaman ber-URL, bukan overlay. `/` menghormati keputusan itu.

---

## 3. Yang gampang salah

Tiga hal, dan semuanya membuat app **terasa rusak** kalau meleset — bukan
sekadar kurang fitur.

**1. Mengetik huruf `q` di dalam input tidak boleh membuka quick-add.**
Ini kesalahan nomor satu untuk shortcut satu-huruf. Handler wajib keluar
lebih dulu kalau fokus ada di `input`, `textarea`, atau elemen
`contenteditable`.

```ts
const el = document.activeElement
if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLElement && el.isContentEditable)) return
```

**2. Modal yang terbuka harus menang.** Menekan `q` di atas
`NodeDetailModal` yang terbuka tidak boleh membuka quick-add di belakangnya.
Karena modal-modal itu dirender bersyarat dari `App.tsx`, `App` sudah tahu
mana yang terbuka — jadi penjaganya cukup satu syarat di sana, tanpa registry
modal global.

**3. Shortcut dengan modifier dilewatkan.** `Ctrl`/`Cmd`/`Alt` + huruf milik
browser dan sistem operasi. Handler keluar kalau salah satunya ditekan —
kalau tidak, `⌘A` (pilih semua) berubah jadi "tambah task".

---

## 4. Keputusan desain

| Keputusan | Alasan |
|---|---|
| **Satu listener di `App.tsx`**, bukan hook per komponen | `App` sudah tahu view yang aktif dan modal yang terbuka — dua hal yang dibutuhkan penjaganya. Menyebarnya ke tiap view berarti tiap view harus tahu soal modal. |
| **`g` sebagai prefiks, bukan `⌘1`/`⌘2`** | Angka bermodifier bentrok dengan pindah-tab browser. Prefiks `g` dipakai GitHub dan Gmail, jadi sudah dikenal. |
| **Prefiks `g` kedaluwarsa dalam 1,5 detik** | Tanpa batas waktu, `g` yang tertekan tak sengaja membuat huruf berikutnya jadi navigasi — beberapa menit kemudian. |
| **Daftar shortcut `?` sebagai modal biasa** | Bentuknya sudah ada tiga kali di codebase. Tidak ada yang baru untuk dipelajari, dan Escape-nya gratis. |
| **Tanpa library** | Enam shortcut, satu listener. Library hotkey untuk ini melanggar [policy 1](../../policy/1-engineering-policy.md). |

---

## 5. Blok kerja

| Blok | Isi |
|---|---|
| A | Listener global di `App.tsx` + ketiga penjaga di §3 + lima shortcut aksi/navigasi |
| B | Modal daftar shortcut (`?`) |

A punya nilai penuh tanpa B. B tanpa A tidak ada gunanya.

---

## 6. Success Criteria

- [ ] `q` membuka quick-add dari view mana pun
- [ ] **Mengetik huruf `q` di dalam input tidak memicu apa pun**
- [ ] `q` saat modal terbuka tidak memicu apa pun
- [ ] `⌘A`/`Ctrl+A` tetap memilih semua teks seperti biasa
- [ ] `a` menambah task di view yang sedang terbuka
- [ ] `/` membuka Search (butuh [fitur 12](../12.search/spec.md))
- [ ] `g i` / `g t` / `g u` berpindah view; `g` lalu diam 2 detik lalu `t` **tidak** berpindah
- [ ] `?` menampilkan daftar; Escape menutupnya
- [ ] `npm run verify` hijau
