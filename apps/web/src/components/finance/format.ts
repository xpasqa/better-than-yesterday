/** Rupiah bulat, tanpa desimal (spec §10.3). Negatif tetap ditampilkan. */
export function formatRupiah(amount: number): string {
  const sign = amount < 0 ? '−' : ''
  return `${sign}Rp ${Math.abs(amount).toLocaleString('id-ID')}`
}

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

/** '2026-08' → 'Agustus 2026' */
export function formatMonth(month: string): string {
  const [year, m] = month.split('-')
  return `${MONTHS[Number(m) - 1]} ${year}`
}
