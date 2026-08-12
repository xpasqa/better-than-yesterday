# Todo: Sidebar bersih — Workspace & Recent Chats asli

Checklist hidup ada di issue epic (nomor diisi saat epic dibuat).
Rincian langkah: [plan.md](plan.md). Alasan keputusan: [spec.md](spec.md).

## Status

- [ ] Blok A — restrukturisasi sidebar: urutan baru, seksi Workspace, hapus mock
- [ ] Blok B — API `GET /sessions` + `GET /sessions/:id` + derivasi judul
- [ ] Blok C — Recent Chats asli di sidebar + AgentView memuat sesi
- [ ] Verifikasi di browser sungguhan (syarat Done)

## Urutan ketergantungan

```
A ──► C ◄── B      (A dan B paralel; C butuh keduanya)
```

## Prasyarat sekali jalan

```bash
docker compose -f docker-compose.test.yml up -d
```
