# Todo: Agent — Dua Ruang

Checklist hidup ada di epic
[#134](https://github.com/xpasqa/better-than-yesterday/issues/134).
Rincian langkah: [plan.md](plan.md). Alasan keputusan: [spec.md](spec.md).

## Status

- [ ] [#125](https://github.com/xpasqa/better-than-yesterday/issues/125) Blok A — ekstraksi `applyIncoming*` dari `sync/routes.ts` + helper DTO server-side
- [ ] [#126](https://github.com/xpasqa/better-than-yesterday/issues/126) Blok B — migrasi `0002`: `max_steps`, `scope` di `agent_file`, buang `agent_project`, arsip memori project, tutup sesi lama
- [ ] [#127](https://github.com/xpasqa/better-than-yesterday/issues/127) Blok C — `core/sse.ts` + tipe event bersama + chat-routes JSON + parser AgentView
- [ ] [#128](https://github.com/xpasqa/better-than-yesterday/issues/128) Blok D — runner tahan gateway + runner parametrik untuk dua agent
- [ ] [#129](https://github.com/xpasqa/better-than-yesterday/issues/129) Blok E — `core/context.ts` + dua susunan lapisan + peta workspace
- [ ] [#130](https://github.com/xpasqa/better-than-yesterday/issues/130) Blok F — 13 tool workspace lewat `applyIncoming*` + undo
- [ ] [#131](https://github.com/xpasqa/better-than-yesterday/issues/131) Blok G — `core/edit.ts` + `edit_file` + memori dua tingkat berbasis `scope`
- [ ] [#132](https://github.com/xpasqa/better-than-yesterday/issues/132) Blok H — siklus hidup sesi chat: close, sesi tertutup terbaca
- [ ] [#135](https://github.com/xpasqa/better-than-yesterday/issues/135) Blok I — kotak perintah Todo (`POST /api/agent/command` + `TodoCommandBar`)
- [ ] [#133](https://github.com/xpasqa/better-than-yesterday/issues/133) Blok J — frontend chat & Settings: penyunting `AGENT.md`, kuota, indikator tool
- [ ] Verifikasi di browser sungguhan (syarat Done)

## Titik rilis

Setelah **Blok I** agent sudah berhenti rusak dan mulai berguna: teks utuh (C),
tool tidak hilang (D), seluruh workspace terlihat (F), kotak perintah bekerja
(I). Jalur chat boleh menyusul.

## Coverage yang tidak bisa ditawar

Empat fungsi murni ini **100% branch**, dan tesnya ditulis lebih dulu.
Ketiadaan tes di jalur inilah yang membuat enam bug spec §1 lolos sekaligus.

- [ ] `packages/core/src/sse.ts`
- [ ] `packages/core/src/context.ts`
- [ ] `packages/core/src/edit.ts`
- [ ] `packages/core/src/tool-calls.ts`

## Tes anti-regresi per bug

Tiap bug di spec §1 punya tes yang gagal sebelum perbaikannya.

- [ ] #1 token berisi spasi tunggal tidak hilang; markdown multi-baris utuh
- [ ] #2 `list_tasks` menjawab tanpa `nodeId` diisi
- [ ] #3 tool tetap dieksekusi saat `finish_reason: 'stop'`
- [ ] #4 nama tool yang diulang tiap chunk tidak jadi `write_filewrite_file`
- [ ] #5 percakapan 40 giliran tanpa error konteks; "New chat" menutup sesi
- [ ] #6 `seq` bertambah di setiap penulisan agent

## Batas dua ruang

Yang paling gampang bocor diam-diam, jadi dikunci tes tersendiri.

- [ ] `SESSION.md` sesi lain tidak pernah terbaca
- [ ] Dokumen `scope='doc'` terbaca dari sesi mana pun milik user yang sama
- [ ] Tidak ada tool yang bisa menulis `AGENT.md`
- [ ] Kotak perintah Todo tidak meninggalkan satu baris pun di `agent_session`

## Urutan ketergantungan

```
Fondasi (paralel)   A · B · C
Mesin               D ─► E                    (butuh C)
Jalur Todo          F ─► I                    (butuh A, D, E)   ◄── rilis di sini
Jalur Chat          G ─► H                    (butuh B)
Permukaan           J                         (butuh C, G, H, I)
```

Kalau harus berhenti lebih awal lagi: C → D → F.

## Prasyarat sekali jalan

```bash
docker compose -f docker-compose.test.yml up -d
```
