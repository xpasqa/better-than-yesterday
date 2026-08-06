# Spec: Mobile UX Improvements — Bottom Nav + Touch Fixes

**Tanggal:** 2026-08-07
**Status:** draft
**Fitur sebelumnya:** [4.responsive](../4.responsive/spec.md) — sudah landing, ini iterasi kedua

---

## 1. Konteks

Responsive layout (feature 4) sudah landing — sidebar jadi drawer, topbar muncul, semua view punya media queries. Tapi audit mendalam menemukan beberapa masalah nyata yang membuat app terasa berat di tangan:

1. **Tidak ada bottom navigation** — di mobile, navigasi antar view ada di topbar (hamburger → drawer). Todoist, Linear, dan semua productivity app native pakai bottom tab bar karena ibu jari tidak menjangkau pojok kiri atas dengan nyaman.
2. **Keyboard menimpa composer** — di `AgentChat` dan `TaskDetailModal`, `height: 100%` tidak mengecil ketika keyboard muncul. Input tertutup.
3. **Safe area inset belum diset** — topbar dan panel fixed tidak pakai `env(safe-area-inset-*)`, jadi di iPhone bernotch konten terpotong.
4. **Banyak tap target di bawah 44px** — send button (32px), subtask checkbox (15px), collapse toggle (18px), section-add button (20px).

---

## 2. Scope

**In:**
- Bottom navigation bar di ≤ 767px: Today, Inbox, Agent, lebih (Search/Settings)
- Keyboard avoidance di AgentChat dan TaskDetailModal
- Safe area inset untuk topbar dan fixed panels
- Tap target minimum 44px untuk primary actions (send button, checkboxes, key toggles)

**Out (iterasi berikutnya):**
- Focus-visible ring / WCAG 2.4.7 (terpisah, butuh design decision)
- Board view scroll-snap dan column-insert touch affordance
- Font size scaling untuk `--font-size-tiny` / `--font-size-xsmall`
- Semua P3 dari audit

---

## 3. Bottom Navigation

### 3.1 Referensi

Todoist mobile pakai tab bar 5 item di bawah:
- Home (Today) — task hari ini
- Inbox — unread tasks
- Search
- Browse (Projects/Labels)
- Settings (avatar)

Pendekatan ini: **4 tab** — Today, Inbox, Agent, More.

| Tab | Icon | Target view |
|---|---|---|
| Today | `CalendarCheck` | `MainContent` dengan filter Today |
| Inbox | `Tray` | `MainContent` dengan project Inbox |
| Agent | `Robot` | `AgentView` |
| More | `DotsThree` | Buka sidebar drawer (existing) |

### 3.2 Behavior

- Hanya muncul di ≤ 767px (phone)
- Height 56px + `env(safe-area-inset-bottom)` (iOS home indicator)
- Menggantikan topbar hamburger sebagai primary nav di phone — hamburger tetap ada untuk "More" affordance
- Active tab di-highlight dengan brand-red
- Sidebar drawer tetap ada, diakses via "More" tab atau topbar hamburger
- Topbar tetap tampil — menampilkan page title + notification bell
- Bottom bar dan topbar **tidak duplikat** — topbar tidak punya hamburger jika bottom bar ada

### 3.3 Layout adjustment

Semua view perlu `padding-bottom` tambahan di ≤ 767px untuk menghindari bottom bar:

```css
/* Applied to every view root at ≤ 767px */
padding-bottom: calc(56px + env(safe-area-inset-bottom));
```

---

## 4. Keyboard Avoidance

### 4.1 AgentChat

**Problem:** `.agent-chat` pakai `height: 100%`. Saat keyboard muncul di iOS/Android, layout viewport tidak mengecil — composer tertimpa keyboard.

**Fix:** Tambah `interactive-widget: resizes-content` ke viewport meta di `index.html`. Ini membuat browser mengecilkan layout viewport saat keyboard muncul, sehingga `height: 100%` juga mengecil dan composer tetap visible.

```html
<meta name="viewport" content="width=device-width, initial-scale=1, interactive-widget=resizes-content">
```

Fallback untuk browser yang tidak support: tambah `env(keyboard-inset-height)` via CSS `@supports`.

### 4.2 TaskDetailModal

Sama — `height: 100%` pada modal body tidak shrink. Fix yang sama via viewport meta cukup karena modal juga pakai `height: 100%` dan scroll internal.

---

## 5. Safe Area Insets

### 5.1 Topbar

```css
.app-topbar {
  padding-top: env(safe-area-inset-top);
  padding-left: calc(8px + env(safe-area-inset-left));
  padding-right: calc(8px + env(safe-area-inset-right));
}
```

### 5.2 AgentFilePanel (fixed overlay)

```css
.agent-file-panel {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}
```

### 5.3 AgentChat composer

```css
.agent-chat__composer {
  padding-bottom: max(24px, env(safe-area-inset-bottom));
}
```

---

## 6. Tap Target Fixes (Primary Actions)

| Element | Current | Fix |
|---|---|---|
| Send button (AgentChat, AgentView) | 32×32px | 44×44px di `hover: none` |
| Subtask checkbox (TaskDetailModal) | 15×15px | 24×24px + `min-width/height: 44px` pada wrapper di `hover: none` |
| Outline collapse toggle | 18×18px | 28×28px di `hover: none` |
| Section-add button (Sidebar) | 20×20px | 32×32px di `hover: none` |
| File panel close button | 24×24px | 36×36px di `hover: none` |
| Nav items Sidebar | 42px | 44px di `hover: none` |
| Mail toolbar buttons | 38×38px | 44×44px di `hover: none` |

---

## 7. Files yang Diubah

| File | Perubahan |
|---|---|
| `apps/web/index.html` | Tambah `interactive-widget=resizes-content` ke viewport meta |
| `apps/web/src/App.tsx` | Tambah `BottomNav` component, remove hamburger dari topbar di phone |
| `apps/web/src/App.css` | Topbar safe-area-inset, hide hamburger di phone |
| `apps/web/src/components/BottomNav.tsx` | Komponen baru |
| `apps/web/src/components/BottomNav.css` | Styles baru |
| `apps/web/src/components/AgentChat.css` | Composer safe-area + send btn tap target |
| `apps/web/src/components/AgentFilePanel.css` | Safe-area-inset |
| `apps/web/src/components/AgentView.css` | Send btn tap target |
| `apps/web/src/components/OutlineView.css` | Collapse toggle tap target |
| `apps/web/src/components/Sidebar.css` | Nav item + section-add tap target |
| `apps/web/src/components/TaskDetailModal.css` | Subtask checkbox tap target |
| `apps/web/src/components/MailView.css` | Toolbar button tap target |
| Semua view `.css` | `padding-bottom` untuk bottom bar |

---

## 8. Success Criteria

- [ ] Bottom nav muncul di ≤ 767px, menyembunyikan diri di ≥ 768px
- [ ] Tap Today → Today filter, tap Inbox → Inbox, tap Agent → AgentView
- [ ] Composer AgentChat tidak tertimpa keyboard di iPhone Safari + Chrome Android
- [ ] Topbar tidak terpotong notch di iPhone X/11/12/13/14/15
- [ ] Send button tappable tanpa presisi tinggi (≥44px)
- [ ] Subtask checkbox di TaskDetailModal tidak sering mis-tap
- [ ] Tidak ada regresi di ≥ 768px

---

## 9. Out of Scope

- PWA / Add to Home Screen
- Push notification
- Pull-to-refresh
- Swipe gesture (swipe-to-delete task, swipe-to-go-back)
- Native share sheet
