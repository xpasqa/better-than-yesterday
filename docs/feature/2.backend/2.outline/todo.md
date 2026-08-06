# Todo: Backend Outline — Workflowy Terhubung Task

Urutan eksekusi [spec.md](spec.md). Prasyarat: fase 1 selesai (pohon, store,
sync sudah hidup). **Tidak ada migrasi database di seluruh fase ini.**

## A. Router untuk seluruh aplikasi

- [x] Pasang router; ganti `useState<ViewType>` di `App.tsx`
- [x] Rute: `/today` `/upcoming` `/inbox` `/project/:id` `/outline`
      `/storage` `/agent` `/mail` (`apps/web/src/routes.ts`). **Not yet
      routed:** `/label/:name`, `/filter/:id`, `/outline/:nodeId` (zoom —
      needs section D), `/settings`
- [ ] Notifikasi push fase 1 membuka rute yang tepat saat diklik — push
      notifications themselves aren't built yet
- [x] **Verifikasi:** tiap view (yang sudah dirutekan) punya URL; back/forward
      bekerja; muat ulang di URL dalam tetap mendarat di tempat yang sama

## B. Outline di atas store

- [x] `initialOutline` dihapus; `OutlineView` membaca pohon dari store
- [x] Pohon bersarang di state → datar `parent_id`; `isCompleted` →
      `completed_at`
- [x] Lima operasi keyboard existing dipetakan ke `core/tree.ts`
      (`indentNode`/`outdentNode`/`createSiblingNode` in
      `apps/web/src/store/outline-actions.ts`; arrow nav and delete are
      client-only, no core/tree.ts op needed)
- [x] Simpan saat blur + debounce 500 ms (`apps/web/src/components/OutlineView.tsx`)
- [x] **Verifikasi:** ketik → Tab → muat ulang → struktur utuh (dites manual
      di browser: "baca laporan McKinsey" diketik, Enter, Tab, reload —
      struktur nested tetap ada); edit di outline (centang selesai) langsung
      terlihat di Today tanpa muat ulang (dites: centang di Outline →
      hilang dari Today list & badge count di sidebar seketika)

## C. Keyboard lengkap & catatan

- [x] Sisa tabel §7: `⌘↑/⌘↓` tukar, `⌘.` buka/tutup, `⌘⏎` selesai,
      `⌘T` beri tanggal, `Shift+Enter` catatan (`note`) — semua di
      `apps/web/src/store/outline-actions.ts` (`swapWithSibling`) dan
      `OutlineView.tsx`'s `handleKeyDown`
- [x] Markdown inline saat blur (React nodes, **bukan** `dangerouslySetInnerHTML`);
      sumber mentah saat fokus; tepat satu `<input>` di DOM —
      `packages/core/src/inline-markdown.ts` (bold/italic/code/strike/link,
      11 unit test) + `OutlineView.tsx`'s `InlineMarkdown` component
- [x] **Verifikasi:** setiap operasi diuji manual di browser lewat
      `KeyboardEvent` sintetik pada baris yang benar-benar fokus (dispatch
      langsung, karena tool otomasi browser yang dipakai sesi ini tidak
      meneruskan flag `ctrlKey`/`metaKey` dari parameter modifier-nya) —
      `⌘⏎` menyelesaikan/membatalkan task dan baris tercoret; `⌘.`
      mengubah `collapsed` (hanya bila punya anak); `⌘T` mengisi `dueDate`
      hari ini; `⌘↑`/`⌘↓` menukar posisi dengan sibling (urutan array
      dicek sebelum/sesudah); `Shift+Enter` membuka textarea catatan.
      **Belum ada:** unit test otomatis per baris tabel keyboard (tidak
      ada e2e runner di repo ini — apps/web diverifikasi manual sejak
      awal proyek, konsisten dengan phase 0/1); `Backspace` di tengah
      teks berisi belum diuji eksplisit (perilaku native `<input>`,
      bukan logika kustom, jadi risikonya rendah tapi belum dibuktikan)

## D. Zoom & breadcrumb

- [ ] `/outline/:nodeId` sebagai akar + breadcrumb leluhur yang bisa diklik
- [ ] Klik bulatan = zoom; akar dirender tertutup; sakelar *sembunyikan project*
- [ ] Sakelar *sembunyikan yang selesai* (tersimpan per node)
- [ ] **Verifikasi:** URL zoom bisa dikirim dan dibuka langsung; back kembali
      ke induk

## E. Mention `@` — inti fase ini

- [ ] `core/mention.ts` — ekstrak/sisip `@[label](id)` dari `content` + tes
      (teks yang menyerupai sintaks, mention ganda, kurung bersarang)
- [ ] Indeks `refIds` multi-entry di Dexie, dihitung saat node ditulis; bisa
      dibangun ulang dari nol
- [ ] Pemilih `@` mencari seluruh pohon dengan breadcrumb tiap kandidat;
      `$` label dan `!1–!4` prioritas juga berlaku di baris outline; `#`
      tidak ditawarkan di sini
- [ ] Render chip: centang, judul terkini, progres, tanggal, prioritas;
      klik = zoom, `⌘`+klik = detail
- [ ] Target terhapus → label cadangan bercoret, bukan uuid
- [ ] **Verifikasi:** rename task mengubah semua penyebutannya; mencentang
      dari chip mengubah task aslinya

## F. Progres & backlink

- [ ] `core/progress.ts` — keturunan selesai ÷ seluruh keturunan `kind='item'`
      + tes (kosong, sebagian, penuh, bersarang dalam)
- [ ] `3/7` di chip dan baris; bilah tipis saat node di-zoom; node tanpa
      keturunan tidak menampilkan apa-apa
- [ ] Badge `↗ N` di baris yang disebut; bagian "Disebut di N tempat" di
      detail task dengan breadcrumb, bisa diklik
- [ ] **Verifikasi:** backlink benar setelah mention dihapus dari teks

## G. Bentangan mention

- [ ] Segitiga pada chip → tampilkan anak-anak target di tempat
- [ ] Boleh mencentang; **tidak** boleh Enter/Tab/reorder di dalamnya
- [ ] Batas kedalaman 3; node tidak dibentangkan dua kali dalam satu jalur
      render (pagar lingkaran)
- [ ] **Verifikasi:** A menyebut B dan B menyebut A tidak membuat render
      berulang tanpa henti

## H. iPad & ponsel

- [ ] Toolbar di atas papan ketik: `⇤` `⇥` `@` `⌘T` `☑`
- [ ] Ketuk bulatan = zoom; sasaran sentuh ≥ 44×44 pt; geser kiri = hapus
      (konfirmasi bila punya anak)
- [ ] **Verifikasi:** indent/outdent berhasil di iPad tanpa papan ketik fisik

## I. Pencarian & penutup

- [ ] Pencarian dalam pohon tampak: sorot kecocokan, buka induk yang menutupi
- [ ] Kasus baru di `test/isolation.test.ts`: outline user lain tak tersentuh
- [ ] E2E: ketik→Tab→muat ulang; `@` sebut task lintas project → centang dari
      chip → berubah di Today; zoom lewat URL → back
- [ ] Uji performa: pohon 1.000 node < 300 ms, mulus di iPad
- [ ] **Verifikasi:** seluruh Success Criteria spec §15 tercentang

## Definisi selesai fase 2

Catatan harian ditulis di sini, bukan di Workflowy; sebuah baris catatan bisa
naik menjadi task hari itu juga; dan catatan pagi bisa menyebut pekerjaan yang
tinggal di project lain sambil menunjukkan progresnya.
