# Todo: Reminder & notifikasi web push

Checklist hidup ada di epic **[#82](https://github.com/xpasqa/better-than-yesterday/issues/82)**.

Keputusan penjadwal sudah diambil: **`node-cron` di dalam proses API**. Lihat
[plan.md](plan.md) untuk rancangan lengkap tiap blok dan urutan pengerjaan
(A → C → D → B → E).

| Blok | Isi |
|---|---|
| A | `reminder` masuk `/api/sync` + `reminder-actions` di store + hitung ulang `fireAt` |
| B | UI reminder di `NodeDetailModal` |
| C | Service worker + manifest + langganan + alur izin |
| D | Penjadwal `node-cron` + `web-push` + VAPID + penanganan 410 |
| E | `notification` mengalir ke klien + sambungkan tombol lonceng (`Sidebar.tsx:247`, saat ini dead button) |

**Belum dikerjakan** — kartu ini naik ke Ready (plan sudah lengkap), tapi
implementasinya sengaja ditahan untuk sesi tersendiri. Tiga bloknya
(C, D) infrastruktur yang perlu diverifikasi di perangkat/browser
sungguhan menerima notifikasi saat app tertutup, bukan sekadar kode ada.

## Status

- [ ] A — sync + store + hitung ulang fireAt
- [ ] B — UI reminder di task detail
- [ ] C — service worker + langganan + izin
- [ ] D — penjadwal + web-push + VAPID
- [ ] E — notification ke klien + tombol lonceng
