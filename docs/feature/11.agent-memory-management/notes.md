# Agent Memory Management — Catatan Arsitektur & Diskusi

> Dokumen ini dibuat untuk diskusi dengan Claude Opus.  
> Tujuan: memetakan apa yang sudah ada, masalah yang perlu dipecahkan, dan arah pengembangan sistem memory agent.

---

## 1. Apa yang Sudah Ada di Codebase

### 1.1 Stack
- **Backend:** Node 22, Hono, Drizzle ORM, PostgreSQL 16
- **Frontend:** React + Vite, TypeScript
- **AI:** OpenAI-compatible API (default: `https://aimurah.my.id/api/v1`, model `claude-sonnet-4.5`)
- **Auth:** Session cookie (httpOnly)

### 1.2 Database Schema — Entity Relationship

```
appUser
  └── aiSettings (1:1) — baseUrl, model, apiKeyEnc (AES-256-GCM encrypted)
  └── agentProject (1:N)
        ├── kind: 'global'  → 1 row per user → stores AGENT.md
        └── kind: 'project' → 1 row per project node → stores PROJECT.md
              └── agentSession (1:N per agentProject)
                    ├── memory (SESSION.md, max 8000 chars)
                    ├── history (JSON array of OpenAI messages)
                    ├── createdAt, updatedAt
                    └── closedAt (null = active, set = closed)
              └── agentFile (1:N per agentProject)
                    ├── path (e.g. 'docs/riset-pasar.md')
                    ├── content (markdown)
                    └── deletedAt (soft-delete)
```

### 1.3 Memory Limits (hardcoded)

| Layer | Max Size |
|-------|----------|
| AGENT.md (global) | 4,000 chars |
| PROJECT.md (per project) | 8,000 chars |
| SESSION.md (per session) | 8,000 chars |

### 1.4 Cara Runner Bekerja (`runner.ts`)

Setiap request ke `/api/agent/chat`:

1. Load `aiSettings` user (baseUrl, model, apiKey)
2. Load atau buat `agentProject` global (AGENT.md)
3. Load atau buat `agentProject` per nodeId jika ada (PROJECT.md)
4. Load atau buat `agentSession` open (SESSION.md + message history)
5. Assemble **system prompt** dari: AGENT.md + PROJECT.md + SESSION.md
6. Append user message ke `messages[]`
7. Loop max 6 steps: call AI → stream tokens → execute tool calls
8. Persist semua pesan baru ke `agentSession.history`

**System prompt structure saat ini:**
```
# Global memory (AGENT.md)
{content}

# Project memory (PROJECT.md)
{content}  ← hanya kalau nodeId ada

# Session notes (SESSION.md)
{content}

---
You are a helpful AI assistant. You have access to file and task tools.
Use plan-then-execute: think first, then act. Max 6 tool steps per turn.
After completing work, update SESSION.md via compact_memory if it is getting long.
```

### 1.5 Tools yang Tersedia untuk Agent

**File tools:** `list_files`, `read_file`, `write_file`, `append_file`, `delete_file`
**Task tools:** `list_tasks`, `create_task`, `update_task` (dan 2 lainnya)
**Memory tool:** `compact_memory` — overwrite SESSION.md dengan versi yang lebih pendek

### 1.6 State Frontend Saat Ini

- `AgentView.tsx` menyimpan messages hanya di **React state** (hilang saat refresh)
- "New task" button hanya reset state frontend, tidak close session di backend
- Sidebar "Recent Chats" adalah **mock data hardcoded** (tidak dari DB)
- Tidak ada cara user untuk resume session lama dari UI
- Session ID tidak pernah dikirim ke backend dari frontend

---

## 2. Masalah yang Perlu Dipecahkan

### 2.1 Context Window Terbatas

LLM punya context window terbatas. Semakin panjang conversation, makin besar token yang dipakai. Ada dua jenis "besar":

- **Message history** (`agentSession.history`): semua turn percakapan, bisa sangat besar
- **System prompt** (AGENT.md + PROJECT.md + SESSION.md): fixed per session tapi accumulated

**Problem saat ini:**
- History tidak pernah ditruncate — bisa jadi ribuan tokens setelah conversation panjang
- `compact_memory` hanya mengecilkan SESSION.md, tidak message history
- Agent hanya diberi instruksi "compact kalau sudah panjang" — tidak ada enforcement otomatis
- Tidak ada token counting — runner tidak tahu seberapa besar context saat ini

### 2.2 Session Management Tidak Lengkap

- Session baru dibuat saat tidak ada session open untuk projectId itu
- "New task" di UI tidak close session lama → session lama tetap open → session baru tidak pernah dibuat → semua pesan masuk ke session yang sama selamanya
- Tidak ada `title` field di session → sidebar tidak bisa menampilkan topik
- Tidak ada endpoint untuk list sessions → sidebar pakai mock data
- `sessionId` tidak pernah dikirim dari frontend ke backend (ada di chat-routes input schema tapi tidak dipakai di runner)

### 2.3 Memory Tidak Mengalir Antar Session

Ketika user mulai session baru (setelah topic berubah), knowledge dari session lama tidak ada di session baru. Yang tersedia hanya:
- AGENT.md (global, jarang diupdate karena tidak ada UI)
- PROJECT.md (per project, jarang diupdate karena tidak ada UI)

SESSION.md dari session sebelumnya tidak di-distill ke PROJECT.md secara otomatis saat session ditutup.

### 2.4 Tidak Ada UI untuk Memory Files

User tidak bisa melihat atau mengedit AGENT.md dan PROJECT.md. Mereka tidak tahu apa yang "diingat" agent tentang mereka. Ini membuat memory layer terasa seperti black box.

---

## 3. Arsitektur Memory yang Diusulkan

### 3.1 Tiga Layer Memory (sudah ada, perlu diperkuat)

```
┌─────────────────────────────────────────────────────┐
│  AGENT.md (Global, 4000 chars)                      │
│  "Siapa user ini, preferensinya, cara kerjanya"     │
│  Update: manual via UI atau agent via tool           │
│  Scope: semua session, semua project                 │
└─────────────────────────────────────────────────────┘
         ↓ dimuat di setiap session
┌─────────────────────────────────────────────────────┐
│  PROJECT.md (Per Project, 8000 chars)               │
│  "Konteks project: tujuan, stack, key decisions"    │
│  Update: manual via UI atau agent via tool           │
│  Scope: semua session dalam satu project             │
└─────────────────────────────────────────────────────┘
         ↓ dimuat di setiap session dalam project itu
┌─────────────────────────────────────────────────────┐
│  SESSION.md (Per Session, 8000 chars)               │
│  "Apa yang sedang dikerjakan di session ini"        │
│  Update: agent via compact_memory tool               │
│  Scope: hanya session ini                            │
└─────────────────────────────────────────────────────┘
         ↓ append-only per turn
┌─────────────────────────────────────────────────────┐
│  message history (Per Session, unlimited saat ini)  │
│  Full conversation turns (user + assistant + tools) │
│  MASALAH: tidak pernah ditruncate                   │
└─────────────────────────────────────────────────────┘
```

### 3.2 Strategi Context Management yang Perlu Diputuskan

**A. History Truncation**
- Sliding window: ambil N turn terakhir saja
- Summary-based: minta agent summarize bagian awal sebelum membuang
- Hybrid: keep last N turns verbatim + summary dari sebelumnya di SESSION.md

**B. Session-to-Project Memory Distillation**
- Ketika session ditutup, key insights otomatis di-merge ke PROJECT.md?
- Tool baru: `update_project_memory` dan `update_global_memory`
- Agent diprompt untuk call distillation tool saat session mau berakhir

**C. Token Budget Awareness**
- Estimate token usage sebelum kirim ke API
- 1 token ≈ 4 chars untuk English/Indonesian (rough proxy)
- Model berbeda punya context window berbeda

---

## 4. Yang Perlu Diimplementasikan

### P0 — Fungsionalitas Dasar yang Rusak

- [ ] Tambah kolom `title text` di `agent_session` (DB migration)
- [ ] Set title dari pesan pertama user di `runner.ts`
- [ ] `GET /api/agent/sessions` — list sessions untuk sidebar (sorted by updatedAt DESC)
- [ ] `POST /api/agent/sessions/:id/close` — close session
- [ ] "New task" di frontend: close session lama via API, buat state baru
- [ ] Sidebar: replace mock `recentChats` dengan fetch dari API

### P1 — Context Continuity

- [ ] `GET /api/agent/sessions/:id/messages` — load history untuk resume
- [ ] Frontend: klik session lama di sidebar → load ke AgentChat
- [ ] Kirim `sessionId` dari frontend ke backend saat resume
- [ ] History truncation: jika history > 40 messages, ambil 20 terakhir

### P2 — Memory Management

- [ ] Tool baru: `update_project_memory(content)` — agent update PROJECT.md
- [ ] Tool baru: `update_global_memory(content)` — agent update AGENT.md
- [ ] UI: modal/halaman untuk lihat dan edit AGENT.md dan PROJECT.md
- [ ] Prompt saat session ditutup: instruksikan agent extract key insights ke PROJECT.md

### P3 — Advanced

- [ ] Token budget counting di runner
- [ ] Summary-based history compression
- [ ] "Handoff notes" antar session (distill SESSION.md ke session baru)

---

## 5. Pertanyaan untuk Didiskusikan dengan Opus

1. **History truncation**: Sliding window (ambil N turn terakhir) vs summary-based (agent summarize bagian awal)? Mana yang lebih cost-efficient tanpa kehilangan important context?

2. **Distillation trigger**: Kapan SESSION.md di-distill ke PROJECT.md?
   - Option A: Manual (user trigger "save to project memory")
   - Option B: Auto saat session ditutup
   - Option C: Agent diprompt untuk call `update_project_memory` sebelum session berakhir

3. **Token counting**: Perlu estimate token usage sebelum kirim ke API? Atau character count sebagai proxy sudah cukup untuk MVP?

4. **AGENT.md workflow**: Bagaimana user mengisi AGENT.md? Perlu UI editor, atau agent yang diminta "update global memory" sudah cukup?

5. **Memory visibility**: Apakah user perlu bisa lihat/edit memory files secara eksplisit (seperti Claude Projects)? Atau cukup abstracted?

6. **Session grouping di sidebar**: Group by project/date atau flat list sorted by recency?

7. **Resume session**: Load full history atau hanya N pesan terakhir untuk performa?

8. **"Handoff" antar session**: Saat session baru dibuat di project yang sama, apakah SESSION.md lama perlu diinclude sebagai context tambahan?

---

## 6. Referensi Relevan

- **Claude Projects**: knowledge files manual + conversation history per project — model paling mirip dengan arsitektur kita
- **ChatGPT Memory**: auto-extract facts dari conversation ke user profile global
- **LangChain ConversationSummaryBufferMemory**: hybrid — keep recent messages verbatim, summarize older ones
- **MemGPT/Letta**: agent yang explicitly manage sendiri context window via tool calls — inspirasi untuk `compact_memory` approach yang sudah ada
- **Mem0**: open source library untuk persistent memory layer di AI apps

---

## 7. Keputusan yang Sudah Dibuat (Jangan Diubah)

- Memory disimpan di PostgreSQL (bukan vector DB) — intentional untuk simplicity
- API key dienkripsi AES-256-GCM di DB — jangan simpan plaintext
- Frontend types di `apps/web/src/types/index.ts` adalah kontrak — backend harus shape response sesuai frontend
- SSE untuk streaming (bukan WebSocket)
- Max 6 tool steps per turn — hardcoded di `runner.ts`
- OpenAI-compatible API (bukan native Anthropic SDK) — karena pakai proxy

---

*Ditulis: 2026-08-07*
*Oleh: Kiro (analisis codebase bty.xvntr.my.id)*
