# Todo: Board (kanban)

Checklist hidup ada di GitHub. Epic **[#65](https://github.com/xpasqa/better-than-yesterday/issues/65)** adalah daftar isinya.

| Blok | Issue | Isi |
|---|---|---|
| A | [#60](https://github.com/xpasqa/better-than-yesterday/issues/60) | `core/board.ts` — kolom per section, kolom implisit, urut `rank` |
| B | [#61](https://github.com/xpasqa/better-than-yesterday/issues/61) | `createSection` + `deleteSection` di store |
| C | [#62](https://github.com/xpasqa/better-than-yesterday/issues/62) | `BoardView` + `BoardCard` + seret + toggle list ↔ board |
| D | [#63](https://github.com/xpasqa/better-than-yesterday/issues/63) | Heading section di list view |

A lebih dulu; C butuh B. D bebas setelah A, **tapi jangan dikerjakan sebelum
[fitur 14](../14.task-subtask-view/spec.md) mendarat** — D memindahkan list
ke `board()`, yang berhenti menampilkan subtask sebagai baris sendiri.

**Prioritas tidak ada di sini** — sudah terpasang penuh (model, parser,
pengurutan, UI). Lihat [spec.md](spec.md) §1.

**Kolom selalu section.** Tidak ada menu grouping/sorting — dilarang
[policy 3](../../policy/3-product-policy.md) §3.

Rincian langkah: [plan.md](plan.md). Alasan tiap keputusan: [spec.md](spec.md).

## Status

- [ ] A — core
- [ ] B — store
- [ ] C — board view
- [ ] D — heading di list
