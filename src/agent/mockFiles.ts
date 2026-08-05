export interface AgentFile {
  id: string
  path: string
  content: string
}

export const MOCK_FILES: AgentFile[] = [
  {
    id: 'file-riset-pasar',
    path: 'docs/riset-pasar.md',
    content: `# Riset Pasar

Ringkasan cepat dari tiga kompetitor utama sebelum kita masuk ke spek fitur.

## Kompetitor

| Produk | Harga/bulan | Kekuatan | Kelemahan |
| --- | --- | --- | --- |
| Nimbus | $12 | Onboarding cepat | Tidak ada mode offline |
| Ledger | $19 | Laporan detail | UI berat |
| Fenwick | $9 | Murah | Fitur terbatas |

## Temuan utama

- Semua kompetitor menagih per kursi, bukan per workspace.
- Tidak ada satu pun yang punya panel file di dalam chat.
- Harga median pasar ada di kisaran $12–15/bulan.

## Rekomendasi

Mulai di titik harga $12, dan jadikan panel file sebagai pembeda utama.
`,
  },
  {
    id: 'file-spec-fitur',
    path: 'docs/spec-fitur.md',
    content: `# Spek Fitur: Panel File

## Masalah

Pengguna tidak bisa melihat apa yang dihasilkan agent tanpa berpindah tab.

## Solusi

Tambahkan panel di kanan chat yang menampilkan struktur folder dan isi file
yang dibuat selama percakapan.

## Kriteria selesai

1. File baru langsung muncul di tree begitu dibuat.
2. Markdown dirender, bukan teks mentah.
3. Bisa disalin dan diunduh tanpa backend.

\`\`\`ts
interface AgentFile {
  path: string
  content: string
}
\`\`\`
`,
  },
  {
    id: 'file-rapat-senin',
    path: 'notes/rapat-senin.md',
    content: `# Catatan Rapat — Senin

## Hadir

- Tim produk
- Tim desain

## Poin pembahasan

- Panel kanan disepakati lebar 420px.
- Tree di atas, viewer di bawah, bukan sebaliknya.
- Semua orang setuju: jangan tambah dependency berat untuk markdown.

## Tindak lanjut

- [ ] Konfirmasi ikon folder/file final
- [ ] Review salinan copy tombol Download
`,
  },
  {
    id: 'file-pertanyaan-terbuka',
    path: 'notes/pertanyaan-terbuka.md',
    content: `# Pertanyaan Terbuka

Hal-hal yang belum diputuskan, dicatat supaya tidak hilang.

## Daftar

1. Apakah file lama perlu bisa diedit dari panel? — **Tidak, untuk versi ini.**
2. Apakah perlu search di dalam tree? — **Belum.**
3. Apakah state panel perlu bertahan lintas sesi? — **Tidak, reset di "New task".**

> Catatan: semua jawaban di atas diambil dari spec, bukan asumsi baru.
`,
  },
  {
    id: 'file-readme',
    path: 'README.md',
    content: `# Ringkasan

Dokumen ini merangkum seluruh file yang dibuat selama sesi ini.

## Isi sesi

- Riset pasar singkat
- Spek fitur panel file
- Catatan rapat Senin
- Daftar pertanyaan terbuka yang sudah dijawab

## Cara pakai

Klik file mana pun di panel kanan untuk membukanya. Gunakan tombol
**Copy** atau **Download** di toolbar viewer untuk menyalin atau
mengunduh isinya.
`,
  },
]

// Keyed by 1-based agent-reply index; value is the MOCK_FILES index to create.
export const FILE_CREATION_SCHEDULE: Record<number, number> = {
  1: 0,
  2: 1,
  4: 2,
  5: 3,
  7: 4,
}
