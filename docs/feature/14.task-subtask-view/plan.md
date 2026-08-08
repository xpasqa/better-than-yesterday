# Plan: Menampilkan subtask di task detail

Urutan eksekusi [spec.md](spec.md). Satu blok — seluruhnya di
`apps/web/src/components/NodeDetailModal.tsx`, nol perubahan model data.

Dilacak di epic **[#39](https://github.com/xpasqa/better-than-yesterday/issues/39)**.

---

## A. Daftar subtask di `NodeDetailModal`

- [ ] Ambil anak langsung dari `useAllNodes()` yang **sudah dipanggil** di
      komponen ini — tidak perlu hook baru:
      `allNodes.filter(n => n.parentId === node.id && n.kind === 'item' && n.deletedAt === null)`
      diurutkan `rank`
- [ ] Render di bawah field Note, dengan header progres "Subtask 2/5"
- [ ] Checkbox per baris memanggil **`toggleTaskComplete`** yang sudah ada —
      jangan tulis jalur penyelesaian sendiri, karena fungsi itu juga
      menangani recurring dan penulisan `completion`
- [ ] Subtask selesai **tetap ditampilkan, tercoret** (beda dari daftar utama;
      di dalam satu task, "3 dari 5 sudah" justru informasi yang dicari)
- [ ] Aksi hapus per baris memanggil **`deleteTask`** yang sudah ada
- [ ] Input "Tambah subtask": Enter menyimpan, Escape membatalkan
- [ ] Menambah subtask membuat node minimal dengan `parentId: node.id` —
      **tanpa** parsing quick-add. Mengurai "besok jam 9" di dalam checklist
      adalah kejutan, bukan fitur
- [ ] Task tanpa subtask: tidak menampilkan daftar kosong yang mengganggu
- [ ] Cucu **tidak** ditampilkan — satu tingkat saja
- [ ] **Verifikasi:** seluruh Success Criteria spec §6; `npm run verify` hijau
