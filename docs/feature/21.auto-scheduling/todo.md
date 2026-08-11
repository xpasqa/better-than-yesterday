# Todo: Auto-scheduling

Checklist hidup ada di GitHub. Epic **[#64](https://github.com/xpasqa/better-than-yesterday/issues/64)** adalah daftar isinya.

| Blok | Issue | Isi |
|---|---|---|
| A | [#58](https://github.com/xpasqa/better-than-yesterday/issues/58) | `firstOfNextMonth` + `endOfMonth` di `date.ts` |
| B | [#59](https://github.com/xpasqa/better-than-yesterday/issues/59) | Guard weekday + enam pola majemuk di `parse.ts` |

A lebih dulu — B mengimpor keduanya.

Nol perubahan UI: quick-add sudah merender `kind: 'date'`, jadi frasa baru
otomatis jadi chip.

Rincian langkah: [plan.md](plan.md). Alasan tiap keputusan: [spec.md](spec.md).

## Status

- [x] A — helper kalender
- [x] B — pola parser
