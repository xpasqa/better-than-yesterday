# Plan: Drag untuk mengurutkan ulang

Ditulis setelah [fitur 22](../22.board/spec.md) blok C mendarat, per §5 spec
ini. Idiom yang direplikasi: HTML5 native drag (`draggable`, `dataTransfer`,
`onDragOver`/`onDrop`) — persis seperti `BoardCard.tsx`/`BoardView.tsx`, bukan
`@dnd-kit` (paket itu ada di `package.json` tapi tidak pernah diimpor di mana
pun — dependency mati, di luar scope kartu ini untuk dicabut).

Beda dari Board: Board menjatuhkan ke **kolom** (mengubah `parentId`). Kartu
ini menjatuhkan ke **posisi presisi** antar dua saudara (mengubah `rank`),
jadi butuh deteksi separuh-atas/separuh-bawah per baris, bukan per-kontainer.

---

## Blok A — `reorderSibling` di store

**File:** `apps/web/src/store/node-actions.ts`

```ts
export async function reorderSibling(itemId: string, beforeId: string | null, afterId: string | null): Promise<void>
```

Langkah:
1. Ambil semua node, cari `item`, filter saudara-sekandungnya (`parentId` +
   `kind` sama, `deletedAt === null`), urutkan by `rank` — **termasuk `item`
   sendiri**, supaya index-nya bisa dipakai untuk deteksi no-op.
2. **Penjaga no-op:** cari tetangga aktual `item` di posisi sekarang
   (`siblings[idx-1]`, `siblings[idx+1]`). Kalau id-nya persis sama dengan
   `beforeId`/`afterId` yang diminta → `return` tanpa menulis apa pun (spec
   §3: "menjatuhkan di tempat semula tidak boleh menulis apa pun").
3. Hitung `newRank = between(beforeNode?.rank ?? null, afterNode?.rank ?? null)`
   dari saudara **tanpa** `item` (siblings minus item, supaya bound tidak
   dihitung dari rank lamanya sendiri).
4. **Ambang rebalance:** kalau `newRank.length > 32`, jangan tulis satu rank
   itu — hitung ulang seluruh saudara (siblings minus item, dengan `item`
   disisipkan di posisi target) pakai `rebalance(n)`, tulis semua baris
   dalam satu transaksi Dexie (pola yang sama dengan `deleteSection`).
5. Kasus normal: satu `updateNode(itemId, { rank: newRank })`.

Tidak perlu `sanitizeNode` tambahan — `updateNode`/`enqueue` yang sudah ada
menanganinya.

## Blok B — Seret di `InboxReal` dan `ProjectReal`

**File yang disentuh:** `TaskRow.tsx` (props baru, opsional), `InboxReal.tsx`,
`ProjectReal.tsx`.

`TaskRow` dapat tiga prop baru, **opsional** — `Today`/`Upcoming` (terurut
tanggal, bukan rank, per spec §2 "Out") tidak memakainya sama sekali:

```ts
reorderable?: boolean
dropIndicator?: 'before' | 'after' | null
onReorderDragStart?: (id: string) => void
onReorderDragOver?: (id: string, position: 'before' | 'after') => void
onReorderDrop?: () => void
```

Saat `reorderable`, `<li>` root dapat `draggable`, `onDragStart` (panggil
`onReorderDragStart(node.id)` + `dataTransfer.setData('text/plain', node.id)`,
persis pola `BoardCard`), `onDragOver` (baca `e.clientY` relatif ke
`getBoundingClientRect()` sendiri — atas setengah → `'before'`, bawah → `'after'`,
lalu panggil `onReorderDragOver`), `onDrop` (panggil `onReorderDrop`). Garis
sisip: satu elemen `<div className="task-row__drop-line">` dirender di atas
atau di bawah `<li>` sesuai `dropIndicator`.

`InboxReal`/`ProjectReal` masing-masing pegang state:
```ts
const [draggedId, setDraggedId] = useState<string | null>(null)
const [dropTarget, setDropTarget] = useState<{ id: string; position: 'before' | 'after' } | null>(null)
```

Saat drop: dari `items` (array yang sudah dirender) + `dropTarget`, hitung
`beforeId`/`afterId` (tetangga item target di sisi yang sesuai, **melompati**
`draggedId` sendiri kalau ia kebetulan salah satu tetangga itu — supaya
menyeret pas di sebelah tetangganya sendiri tidak menghitung dirinya sebagai
bound), panggil `reorderSibling(draggedId, beforeId, afterId)`, reset kedua
state.

Duplikasi logic antara `InboxReal` dan `ProjectReal` **disengaja** — dipakai
di tepat dua tempat, di bawah ambang "abstraksi sebelum pemakaian ketiga"
([policy 1](../../policy/1-engineering-policy.md) §1), dan kedua file itu
sudah mengulang pola `addingTask` yang sama tanpa diekstrak.

---

## Verifikasi

- Unit test `reorderSibling` di `node-actions` **tidak dilakukan** — file itu
  bukan `packages/core` (murni), ia menyentuh Dexie langsung dan sengaja tidak
  diuji satu-satu per [policy 1](../../policy/1-engineering-policy.md) §7.
  `between`/`rebalance` sendiri sudah bertes penuh di `rank.test.ts`.
- Verifikasi nyata: klik-seret di browser sungguhan (Playwright), cek `rank`
  di Postgres langsung sebelum/sesudah, cek reload mempertahankan urutan, cek
  drop-di-tempat-semula tidak menulis (bandingkan `updatedAt`).
