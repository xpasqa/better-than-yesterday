# Todo: Project hierarchy & appearance

Checklist hidup ada di GitHub. Epic **[#29](https://github.com/xpasqa/better-than-yesterday/issues/29)** adalah daftar isinya; detail teknis tiap blok ada di issue-nya masing-masing.

| Blok | Issue | Isi |
|---|---|---|
| A | [#35](https://github.com/xpasqa/better-than-yesterday/issues/35) | `project-actions` — `createProject` terima `color` + `parentId`, tambah `updateProject` |
| B | [#36](https://github.com/xpasqa/better-than-yesterday/issues/36) | `ProjectModal` — satu modal untuk create + edit |
| C | [#37](https://github.com/xpasqa/better-than-yesterday/issues/37) | Sidebar hierarki dengan indentasi |

Urutan: A → B → C. A murni store (bisa merge sendiri). Setelah B, warna dan sub-project sudah bisa dibuat & diubah — hierarkinya baru terlihat setelah C.

Rincian langkah per blok: [plan.md](plan.md). Alasan tiap keputusan: [spec.md](spec.md).

## Status

- [ ] A — store
- [ ] B — modal
- [ ] C — sidebar
