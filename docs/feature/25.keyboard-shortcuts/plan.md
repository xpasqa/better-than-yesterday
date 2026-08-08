# Keyboard Shortcuts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enam shortcut global supaya tangan tidak perlu pindah ke mouse untuk hal yang paling sering dilakukan.

**Architecture:** Satu `useEffect` dengan satu listener `keydown` di `App.tsx` — tempat yang sudah tahu view aktif dan modal yang terbuka. Ditambah satu modal daftar shortcut yang meniru bentuk modal yang sudah ada.

**Tech Stack:** React, TypeScript. Tanpa dependensi baru.

## Global Constraints

- **Tanpa library hotkey.** Enam shortcut, satu listener ([policy 1](../../policy/1-engineering-policy.md)).
- Handler **wajib** keluar lebih dulu pada tiga kondisi: fokus di field teks · ada modal terbuka · ada modifier (`Ctrl`/`Meta`/`Alt`) ditekan. Ketiganya membuat app *terasa rusak* kalau meleset, bukan sekadar kurang fitur.
- Listener didaftarkan sekali dan dibersihkan di cleanup — jangan tinggalkan listener menumpuk tiap render.
- `npm run verify` hijau.

---

### Task 1: Listener global & lima shortcut

**Files:**
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: state view aktif dan state modal yang sudah ada di `App`
- Produces: state `showShortcuts: boolean` — dipakai Task 2

- [ ] **Step 1: Tulis penjaganya lebih dulu**

Sebelum satupun shortcut, tulis fungsi yang menentukan kapan handler **tidak**
boleh jalan. Ini bagian yang paling penting di seluruh fitur.

```tsx
/**
 * Single-letter shortcuts must never fire while someone is typing, while a
 * modal owns the screen, or when a modifier makes the key belong to the
 * browser or the OS. Getting any of these wrong makes the app feel broken
 * rather than merely incomplete.
 */
function shouldIgnore(e: KeyboardEvent, modalOpen: boolean): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return true
  if (modalOpen) return true
  const el = document.activeElement
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  )
}
```

- [ ] **Step 2: Pasang listener**

`modalOpen` disusun dari state modal yang **sudah ada** di `App` (mis.
`openNodeId`, modal buat project, modal label). Cek dulu apa saja yang ada di
sana dan gabungkan semuanya — melewatkan satu berarti shortcut menembus modal
itu.

```tsx
const [showShortcuts, setShowShortcuts] = useState(false)
const pendingG = useRef<number | null>(null)

useEffect(() => {
  const modalOpen = Boolean(openNodeId) || showShortcuts /* + modal lain di App */

  function onKeyDown(e: KeyboardEvent) {
    if (shouldIgnore(e, modalOpen)) return

    // "g" is a prefix: g→i, g→t, g→u. It expires after 1.5s so a stray "g"
    // cannot turn some later keystroke into navigation.
    if (pendingG.current !== null) {
      window.clearTimeout(pendingG.current)
      pendingG.current = null
      if (e.key === 'i') { e.preventDefault(); onViewChange('inbox'); return }
      if (e.key === 't') { e.preventDefault(); onViewChange('today'); return }
      if (e.key === 'u') { e.preventDefault(); onViewChange('upcoming'); return }
      return
    }

    switch (e.key) {
      case 'g':
        e.preventDefault()
        pendingG.current = window.setTimeout(() => { pendingG.current = null }, 1500)
        break
      case 'q':
      case 'a':
        e.preventDefault()
        focusQuickAdd()
        break
      case '/':
        e.preventDefault()
        onViewChange('search')
        break
      case '?':
        e.preventDefault()
        setShowShortcuts(true)
        break
    }
  }

  document.addEventListener('keydown', onKeyDown)
  return () => {
    document.removeEventListener('keydown', onKeyDown)
    if (pendingG.current !== null) window.clearTimeout(pendingG.current)
  }
}, [openNodeId, showShortcuts /* + modal lain */])
```

> `q` dan `a` sengaja melakukan hal yang sama untuk sekarang: memberi fokus ke
> quick-add di view yang terbuka. Spec membedakan keduanya karena `a`
> nantinya menambah di konteks yang lebih sempit (kolom board, section), tapi
> **hari ini konteks itu belum ada** — dan membuat dua jalur berbeda yang
> hasilnya sama adalah kerumitan tanpa manfaat.

- [ ] **Step 3: `focusQuickAdd`**

`QuickAddBar` merender `<input aria-label="Quick add a task">`. Cara paling
sedikit kodenya, tanpa mengoper ref lintas komponen:

```tsx
function focusQuickAdd() {
  const input = document.querySelector<HTMLInputElement>('input[aria-label="Quick add a task"]')
  input?.focus()
}
```

> Ini memakai DOM langsung, yang biasanya dihindari di React. Diterima di sini
> karena alternatifnya adalah mengoper ref melalui tiga lapis komponen demi
> satu pemanggilan `focus()`. Kalau `aria-label`-nya berubah, shortcut-nya
> diam-diam mati — jadi **tambahkan komentar di `QuickAddBar` yang menyebut
> ketergantungan ini**, di sisi yang mudah dilihat orang yang mengubahnya.

- [ ] **Step 4: `/` butuh Search**

Shortcut `/` mengarah ke view `'search'` yang dibangun
[fitur 12](../12.search/spec.md). Kalau fitur itu belum mendarat saat task ini
dikerjakan, **hilangkan cabang `/`** dan catat di deskripsi issue — jangan
menavigasi ke view yang belum ada.

- [ ] **Step 5: Verifikasi**

Run: `npm run verify`

Di browser, uji ketiga penjaga secara eksplisit:
1. Klik quick-add, ketik `qa/g?` — semuanya muncul sebagai teks, tidak ada
   yang memicu shortcut
2. Buka task detail, tekan `q` — tidak terjadi apa-apa
3. Tekan `⌘A`/`Ctrl+A` — memilih semua teks seperti biasa
4. Tekan `g`, tunggu 2 detik, tekan `t` — **tidak** berpindah

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/components/QuickAddBar.tsx
git commit -m "feat(web): global keyboard shortcuts (q, a, /, g-prefix nav)"
```

---

### Task 2: Modal daftar shortcut

**Files:**
- Create: `apps/web/src/components/ShortcutsModal.tsx`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: `showShortcuts` dari Task 1

- [ ] **Step 1: Tulis modalnya**

Tiru bentuk `CreateLabelModal.tsx` — pembungkus overlay, Escape yang menutup
lewat `document.addEventListener('keydown')`, dan kelas CSS yang sama. Jangan
bikin bentuk modal keempat.

```tsx
const SHORTCUTS: [string, string][] = [
  ['q', 'Buka quick add'],
  ['a', 'Tambah task di view ini'],
  ['/', 'Buka Search'],
  ['g lalu i', 'Ke Inbox'],
  ['g lalu t', 'Ke Today'],
  ['g lalu u', 'Ke Upcoming'],
  ['?', 'Tampilkan daftar ini'],
  ['Esc', 'Tutup'],
]
```

Daftarnya **satu sumber**: kalau Task 1 mengubah sebuah tombol, daftar ini
ikut diubah di commit yang sama. Daftar shortcut yang berbohong lebih buruk
daripada tidak ada daftar.

- [ ] **Step 2: Verifikasi**

Run: `npm run verify`

Di browser: `?` membuka daftar, Escape menutupnya, dan menekan `q` saat
daftar terbuka tidak melakukan apa-apa (ia modal — penjaga §2 berlaku).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ShortcutsModal.tsx apps/web/src/App.tsx
git commit -m "feat(web): shortcuts help modal on ?"
```
