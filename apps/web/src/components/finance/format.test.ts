import { describe, expect, it } from 'vitest'
import { formatMonth, formatRupiah } from './format.ts'

describe('formatRupiah', () => {
  it('memakai pemisah ribuan id-ID tanpa desimal', () => {
    expect(formatRupiah(4_250_000)).toBe('Rp 4.250.000')
    expect(formatRupiah(0)).toBe('Rp 0')
  })

  it('menampilkan negatif dengan tanda minus di depan', () => {
    expect(formatRupiah(-200_000)).toBe('−Rp 200.000')
  })
})

describe('formatMonth', () => {
  it('menerjemahkan YYYY-MM ke nama bulan Indonesia', () => {
    expect(formatMonth('2026-08')).toBe('Agustus 2026')
  })
})
