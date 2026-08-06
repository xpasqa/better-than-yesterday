# Spec: Environment Setup & Production Deployment

**Tanggal:** 2026-08-06
**Status:** disetujui, siap diimplementasi
**Policy:** tunduk pada [`docs/policy/1-engineering-policy.md`](../../policy/1-engineering-policy.md)
**Bergantung pada:** Phase 3 (Agent, issue #7) · Phase 4 (Storage, issue #8) — kode sudah di master, tinggal environment-nya yang belum siap

---

## 1. Konteks

Fase 3 dan 4 sudah di-merge ke master tapi belum bisa dijalankan karena dua hambatan lingkungan:

1. **`node_modules` dimiliki `root`** — `npm install` gagal dengan `EACCES`. Package `openai`, `@aws-sdk/client-s3`, dan `@aws-sdk/s3-request-presigner` belum terinstall. Saat ini digantikan ambient type shims (`.d.ts`) supaya tsc tetap pass.
2. **Migrasi DB belum dijalankan** — `drizzle/0001_agent_phase3.sql` dan `drizzle/0002_storage_phase4.sql` belum diapply. Tabel `ai_settings`, `agent_project`, `agent_file`, `agent_session`, `storage_area`, `storage_folder`, `storage_file` belum ada di database, dan kolom `storage_quota_bytes` belum ada di `app_user`.
3. **Env vars belum diset** — `APP_ENCRYPTION_KEY`, `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`.

---

## 2. Scope

**In:**
- Fix ownership `node_modules` agar `npm install` bisa jalan sebagai user `ubuntu`
- Install dependencies baru: `openai ^4.103.0`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`
- Hapus ambient type shims setelah package real terinstall
- Jalankan DB migrations `0001` dan `0002`
- Set env vars di `.env` (dev) dan environment production
- Verifikasi end-to-end: API sehat, Agent chat streaming, Storage presign/confirm

**Out:**
- Perubahan kode aplikasi (semua sudah di master)
- Setup server baru / VPS baru
- CI/CD pipeline (bisa menyusul di issue terpisah)

---

## 3. Langkah Fix `node_modules`

```bash
# Ambil ownership node_modules ke user ubuntu
sudo chown -R ubuntu:ubuntu /home/ubuntu/bty/app/node_modules
sudo chown -R ubuntu:ubuntu /home/ubuntu/bty/app/apps/web/node_modules/.vite-temp
sudo chown -R ubuntu:ubuntu /home/ubuntu/bty/app/apps/web/node_modules/.tmp

# Lalu install dari root workspace (npm workspaces)
cd /home/ubuntu/bty/app
npm install
```

Setelah `npm install` berhasil, hapus type shims yang tidak lagi diperlukan:
- `apps/api/src/types/openai-shim.d.ts`
- `apps/api/src/types/aws-shim.d.ts`

---

## 4. Env Vars yang Dibutuhkan

### Sudah ada (tidak perlu diubah)
- `DATABASE_URL`
- `SESSION_SECRET`

### Baru — wajib untuk Agent (fase 3)
| Var | Keterangan |
|---|---|
| `APP_ENCRYPTION_KEY` | String ≥32 karakter, dipakai AES-256-GCM untuk enkripsi API key user. Generate: `openssl rand -hex 32` |

### Baru — opsional untuk Storage (fase 4)
| Var | Keterangan |
|---|---|
| `S3_ENDPOINT` | URL iDrive e2, contoh: `https://<endpoint>.idrivee2-XX.com` |
| `S3_REGION` | Region iDrive e2, contoh: `us-east-1` |
| `S3_ACCESS_KEY_ID` | Access key dari iDrive e2 |
| `S3_SECRET_ACCESS_KEY` | Secret key dari iDrive e2 |
| `S3_BUCKET` | Nama bucket |

Storage bersifat opsional saat start — bila S3 tidak dikonfigurasi, endpoint storage mengembalikan `503` tapi app tetap jalan. Agent dan todo tetap berfungsi penuh tanpa S3.

`.env` template:
```
DATABASE_URL=postgresql://postgres@127.0.0.1:5432/better
TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55432/better_test
SESSION_SECRET=<min 32 chars>
APP_ENCRYPTION_KEY=<min 32 chars, generate: openssl rand -hex 32>

# Storage — opsional, isi bila iDrive e2 sudah siap
# S3_ENDPOINT=
# S3_REGION=us-east-1
# S3_ACCESS_KEY_ID=
# S3_SECRET_ACCESS_KEY=
# S3_BUCKET=
```

---

## 5. Migrasi Database

```bash
cd /home/ubuntu/bty/app

# Pastikan DATABASE_URL diset di .env atau env
npm run db:migrate -w @better/api
```

Dua migrasi yang akan dijalankan (berurutan, idempotent):
1. `0001_agent_phase3.sql` — tabel `ai_settings`, `agent_project`, `agent_file`, `agent_session`
2. `0002_storage_phase4.sql` — tabel `storage_area`, `storage_folder`, `storage_file`, kolom `app_user.storage_quota_bytes`

---

## 6. Hapus Type Shims

Setelah `npm install` berhasil, hapus shims dan pastikan tsc tetap clean:

```bash
rm apps/api/src/types/openai-shim.d.ts
rm apps/api/src/types/aws-shim.d.ts
cd apps/api && npx tsc --noEmit
```

Jika ada error baru setelah shims dihapus (karena type real berbeda dengan shim), fix error tersebut sebelum commit.

---

## 7. Verifikasi

### Tier 1 — wajib sebelum dinyatakan selesai
- [ ] `npm install` selesai tanpa error
- [ ] `npm run typecheck` (seluruh workspace) — clean
- [ ] `npm run lint` — clean
- [ ] `npm run db:migrate -w @better/api` — "No pending migrations" atau "2 migrations applied"
- [ ] `curl http://localhost:3001/health` → `{"ok":true}`
- [ ] `npm run test -w @better/api` — semua pass (butuh `TEST_DATABASE_URL`)

### Tier 2 — verifikasi fitur baru
- [ ] Set API key di UI Agent → kirim pesan → SSE token mengalir → jawaban muncul di chat
- [ ] Agent membuat file → muncul di file panel
- [ ] "New task" mereset semua state
- [ ] Storage: `POST /api/storage/files/presign` → presigned URL dikembalikan (butuh S3 dikonfigurasi)
- [ ] Storage: PUT ke presigned URL → `POST /api/storage/files/:id/confirm` → status `ready`

### Tier 3 — regresi
- [ ] Todo sync masih jalan
- [ ] Outline masih jalan
- [ ] Login/logout masih jalan

---

## 8. Success Criteria

Selesai berarti:
- `npm install` jalan sebagai user `ubuntu` tanpa `sudo`
- Semua tes hijau
- Agent chat streaming end-to-end terbukti dengan API key nyata
- Storage presign→PUT→confirm terbukti bila S3 dikonfigurasi
- Tidak ada shims `.d.ts` yang tersisa untuk package yang sudah terinstall
