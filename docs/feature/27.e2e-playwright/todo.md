# Todo: E2E Playwright

Checklist hidup ada di GitHub. Epic **[#80](https://github.com/xpasqa/better-than-yesterday/issues/80)** adalah daftar isinya.

| Blok | Issue | Isi |
|---|---|---|
| A | [#72](https://github.com/xpasqa/better-than-yesterday/issues/72) | Pasang Playwright, config, `webServer`, helper login, skrip npm |
| B | [#73](https://github.com/xpasqa/better-than-yesterday/issues/73) | Dua alur: quick-add → Today → selesai · offline → antre → sync |

A lebih dulu — B tidak bisa jalan tanpanya.

**Alur recurring di blok B menutup [#24](https://github.com/xpasqa/better-than-yesterday/issues/24)**,
verifikasi manual yang selama ini menahan #23 di Review.

`npm run verify` **tidak** ikut menjalankan e2e — verify dipakai tiap task
oleh implementer subagent dan harus tetap cepat.

Rincian langkah: [plan.md](plan.md). Alasan tiap keputusan: [spec.md](spec.md).

## Status

- [x] A — pemasangan
- [x] B — dua alur
