# Todo: Halaman Settings — timezone

Checklist hidup ada di GitHub. Epic **[#78](https://github.com/xpasqa/better-than-yesterday/issues/78)** adalah daftar isinya.

| Blok | Issue | Isi |
|---|---|---|
| A | [#68](https://github.com/xpasqa/better-than-yesterday/issues/68) | `PATCH /api/me` — tulis timezone, tolak yang tidak sah |
| B | [#69](https://github.com/xpasqa/better-than-yesterday/issues/69) | `SettingsView` + `updateMe` + routing + tautan di menu profil |

A lebih dulu.

**Hanya timezone.** `language`, `week_start`, dan `default_remind_time` ada di
DB tapi tidak dibaca di mana pun — kenop tanpa kabel. Keputusannya di issue
[#74](https://github.com/xpasqa/better-than-yesterday/issues/74), bukan di sini. Lihat [spec.md](spec.md) §2.

Rincian langkah: [plan.md](plan.md). Alasan tiap keputusan: [spec.md](spec.md).

## Status

- [ ] A — route
- [ ] B — halaman
