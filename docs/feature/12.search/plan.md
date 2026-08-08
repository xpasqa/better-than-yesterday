# Plan: Search

Urutan eksekusi [spec.md](spec.md). Tiga blok, masing-masing bisa di-merge
sendiri: A murni core (tanpa UI), B membuat fiturnya terpakai, C polish yang
tidak menghalangi apa pun.

Dilacak di epic **[#31](https://github.com/xpasqa/better-than-yesterday/issues/31)** sebagai daftar isi,
dengan detail tiap blok di #32, #33, dan #34.

---

## A. Core — `packages/core/src/search.ts` (#32)

Fungsi murni, tanpa I/O, 100% branch coverage seperti modul core lain.

- [ ] `tokenize(query)` — lowercase, split `/\s+/`, buang token kosong
- [ ] `matches(node, tokens)` — tiap token ada di judul ATAU catatan;
      haystack di-lowercase sekali per node; `note: null` aman
- [ ] `search(nodes, query)` — kandidat `kind==='item' && deletedAt===null`
      (**`completedAt` sengaja tidak difilter**, beri komentar alasannya
      supaya tidak "diperbaiki" orang lain), lalu skor + urutkan
- [ ] Skor: semua token di judul = 0 · sebagian = 1 · tak ada di judul = 2
- [ ] Tiebreak: `dueDate` menaik dengan sentinel `'9999-99-99'` untuk yang
      tanpa tanggal (pola sama seperti `'99:99'` di `views.ts`), lalu `rank`
- [ ] Tes tabel input→output sesuai spec §4.4
- [ ] **Verifikasi:** `npm test -w @better/core` hijau, `search.ts` 100%
      branch coverage, tidak ada I/O di modul

## B. View & routing (#33)

Bergantung pada A.

- [ ] `types/index.ts` — `'search'` masuk `ViewType`
- [ ] `routes.ts` — `'search'` masuk `PLAIN_VIEWS`
- [ ] `SearchView.tsx` — mengikuti bentuk `TodayReal.tsx`; input auto-focus;
      `search(nodes, query)` dipanggil saat render (sinkron, tanpa debounce)
- [ ] `TaskRow` per hasil, **`allNodes` diteruskan** (nama project induk) +
      `timezone` (wajib sejak #26) + `onOpenNode`
- [ ] Tiga kondisi: query kosong → ajakan mengetik; nol hasil → pesan dengan
      query-nya; ada hasil → header jumlah lalu daftar
- [ ] `App.tsx` — cabang `activeView === 'search'` sebelum fallback `null`
- [ ] `Sidebar.tsx:178` — tombol mati dihidupkan: `onClick` + kelas `--active`
- [ ] **Verifikasi:** `npm run verify` hijau; `/search` bisa dibuka langsung
      dari URL; seluruh Success Criteria spec §7 kecuali highlight

## C. Highlight kecocokan (#34)

Polish. Tidak menghalangi B dipakai.

- [ ] Bungkus substring yang cocok di judul & catatan dengan `<mark>`
- [ ] Aman terhadap regex-injection dari input user (escape token dulu)
- [ ] Sisipkan sebagai **React node** (array string + elemen `<mark>`), bukan
      `dangerouslySetInnerHTML` — isi task adalah teks dari user
- [ ] **Verifikasi:** keyword dengan karakter regex (`.`, `*`, `(`) tidak
      melempar error dan tetap tersorot benar
