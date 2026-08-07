# Todo: Mobile UX Improvements — Bottom Nav + Touch Fixes

**Ditulis 2026-08-07 (issue #22)** — `spec.md` (status "draft") sudah ada
tanpa `plan.md`/`todo.md`, melanggar konvensi CLAUDE.md. Audit kode
menemukan sebagian besar scope spec ini **sudah di-deploy** (commit
`6115c01`, "agent settings modal, profile dropdown, mobile UX fixes")
meski `spec.md` masih berstatus draft dan tidak pernah dicentang.

Audit ini menutupi item-item utama, bukan setiap baris spec §3–§6 satu per
satu — beberapa detail granular (misal exact per-tab icon match, section
lain di luar yang dicek di bawah) belum diverifikasi ulang.

## §3 Bottom Navigation

- [x] `BottomNav.tsx`/`.css` ada, dipasang di `App.tsx`
- [x] 4 tab: Today, Inbox, Agent, More — cocok dengan spec (bukan 5 tab
      ala Todoist yang disebut sebagai referensi, sesuai keputusan §3.1)
- [x] Routing lewat `pathForView`/`deriveViewFromPathname` dari `routes.ts`
      — otomatis ikut ke `TodayReal`/`InboxReal` yang real, tidak
      tergantung `MainContent` (yang sudah dihapus di issue #20)
- [ ] Perilaku detail lain di §3.2 (muncul hanya ≤767px, height 56px +
      safe-area-inset-bottom) — terlihat benar di CSS tapi belum diverifikasi
      visual di device/browser sungguhan

## §4 Keyboard Avoidance

- [ ] **Belum dikerjakan.** `AgentChat.css`/`AgentView.css` masih pakai
      `height: 100%` polos — tidak ada `100dvh` atau listener
      `visualViewport`, jadi keyboard menimpa composer kemungkinan masih
      jadi masalah nyata di iOS Safari
- [ ] Target asli spec ini juga menyebut `TaskDetailModal` — komponen itu
      sudah dihapus (issue #20, mock mati); kalau dikerjakan, targetnya
      sekarang `NodeDetailModal.tsx`

## §5 Safe Area Inset

- [x] `env(safe-area-inset-*)` dipakai di 8 file CSS: `AgentView`,
      `CreateProjectModal`, `BottomNav`, `AgentFilePanel`,
      `AgentSettingsModal`, `NodeDetailModal`, `AgentChat`, `CreateLabelModal`

## §6 Tap Target 44px

- [x] Send button (`AgentChat.css`, `AgentView.css`) — 44px
- [x] `BottomNav.css` tab — min-height 44px
- [x] `AgentFilePanel.css` close button — 44px
- [x] `OutlineView.css` — min-height 44px pada elemen yang relevan
- [ ] Subtask checkbox (15px→44px) dan section-add button (20px→44px)
      yang disebut spec §1 sebagai masalah asli — **belum diverifikasi**
      apakah sudah diperbaiki (subtask/section-add ada di komponen yang
      sudah dihapus di issue #20; kalau masih relevan, cek padanannya di
      `NodeDetailModal`/real views)

## Rekomendasi

Update `spec.md` dari status "draft" ke "sebagian besar landed" setelah
item di atas diverifikasi manual di browser/device — audit ini hanya
berbasis pembacaan kode (tidak ada tooling browser tersedia di sesi ini).
