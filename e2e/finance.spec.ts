import type { Locator, Page } from '@playwright/test'
import { test, expect } from './fixtures.ts'

// Bukan menguji ulang perhitungan §9 — itu sudah dikunci tes integrasi.
// Yang dibuktikan di sini: rantai UI → @better/core → API → agregasi
// benar-benar tersambung (spec §12).

/**
 * Melewati wizard setup (§10.4) supaya tab yang sebenarnya benar-benar
 * ter-render. Tanpa ini FinanceView menampilkan <FinanceSetup>, bukan tab —
 * dan assert terhadap teks yang kebetulan juga ada di wizard/nav akan lolos
 * tanpa pernah memuat komponen yang diklaim diuji.
 *
 * Kondisional karena user e2e dipakai ulang antar run: kalau akunnya sudah
 * lebih dari hasil seed, wizard-nya tidak muncul lagi. isVisible() sendiri
 * tidak menunggu — dipanggil sesaat setelah goto() ia bisa balik false cuma
 * karena render belum selesai. Tunggu dulu salah satu (wizard atau isi tab)
 * benar-benar muncul sebelum memutuskan.
 */
async function skipSetup(page: Page, settled: Locator) {
  const wizardButton = page.getByRole('button', { name: 'Lanjut' })
  await expect(wizardButton.or(settled).first()).toBeVisible()
  if (await wizardButton.isVisible()) {
    await wizardButton.click()
    await page.getByRole('button', { name: 'Tidak' }).click()
    await page.getByRole('button', { name: 'Selesai' }).click()
  }
}

/** '−Rp 25.000' → -25000. Kebalikan formatRupiah (§10.3). */
async function rupiah(locator: Locator): Promise<number> {
  const text = (await locator.textContent()) ?? ''
  const value = Number(text.replace(/\D/g, ''))
  return text.trimStart().startsWith('−') ? -value : value
}

const asRupiah = (value: number) => `${value < 0 ? '−' : ''}Rp ${Math.abs(value).toLocaleString('id-ID')}`

test('catat pengeluaran lewat daftar situasi, angka beranda ikut berubah', async ({ page, userEmail: _userEmail }) => {
  await page.goto('/finance')

  const headlineLabel = page.getByText('Uang kamu')
  await skipSetup(page, headlineLabel)

  // Headline dipilih lewat kelasnya, bukan lewat teks: "Rp 25.000" muncul di
  // dua tempat sekaligus (headline dan daftar transaksi terakhir), dan
  // getByText yang ambigu akan gagal karena strict mode Playwright.
  const headline = page.locator('.finance-headline__value')
  await expect(headlineLabel).toBeVisible()
  // Diukur sebagai selisih, bukan angka mutlak: user e2e dipakai ulang antar
  // run (lihat e2e/fixtures.ts), jadi saldo awal tidak dijamin nol.
  const before = await rupiah(headline)

  await page.getByRole('button', { name: 'Catat transaksi' }).click()
  await page.getByRole('button', { name: /Pengeluaran/ }).click()
  await page.getByLabel('Jumlah').fill('25000')
  await page.getByLabel('Kategori').selectOption({ label: 'Makan' })
  await page.getByRole('button', { name: 'Simpan' }).click()

  // Headline turun sebesar pengeluarannya — kalau Dompet mulai dari nol, ia
  // jadi negatif, dan itu memang ditampilkan apa adanya (§11.4).
  await expect(headline).toHaveText(asRupiah(before - 25_000))
  // .first(): daftar transaksi terakhir bisa berisi lebih dari satu "Makan"
  // kalau user e2e-nya dipakai ulang antar run.
  await expect(page.getByText('Makan').first()).toBeVisible()

  // Reload membuktikan ia benar-benar sampai ke Postgres, bukan cuma state React.
  await page.reload()
  await expect(headline).toHaveText(asRupiah(before - 25_000))
})

test('tab punya alamat sendiri dan bertahan setelah reload', async ({ page, userEmail: _userEmail }) => {
  await page.goto('/finance/akun')

  // Baris akun beserta saldonya hanya bisa datang dari AccountsTab — beda dari
  // teks "Dompet"/"Piutang" yang juga muncul di hint wizard dan label nav.
  const dompet = page.locator('.finance-account').filter({ hasText: 'Dompet' })
  await skipSetup(page, dompet)

  await expect(dompet.locator('.finance-account__balance')).toBeVisible()
  // Piutang hasil seed juga muncul sebagai baris akun, tanpa tombol Arsipkan
  // karena ia akun sistem (§5.1/§11.6).
  const piutang = page.locator('.finance-account').filter({ hasText: 'Piutang' })
  await expect(piutang.locator('.finance-account__balance')).toBeVisible()
  await expect(piutang.getByRole('button', { name: 'Arsipkan' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Tambah akun' })).toBeVisible()

  await page.reload()
  await expect(page).toHaveURL(/\/finance\/akun$/)
  await expect(dompet.locator('.finance-account__balance')).toBeVisible()
})

test('akun bisa diarsipkan dan diaktifkan lagi dari tab Akun', async ({ page, userEmail: _userEmail }) => {
  await page.goto('/finance/akun')
  const dompet = page.locator('.finance-account').filter({ hasText: 'Dompet' })
  await skipSetup(page, dompet)

  // Nama unik per run: user e2e dipakai ulang, dan akun tidak pernah benar-benar
  // dihapus (§11.6) — jadi nama tetap akan menumpuk antar run.
  const nama = `BCA ${Date.now()}`
  await page.getByRole('button', { name: 'Tambah akun' }).click()
  await page.getByLabel('Nama', { exact: true }).fill(nama)
  await page.getByRole('button', { name: 'Simpan' }).click()

  const bca = page.locator('.finance-account').filter({ hasText: nama })
  await expect(bca).toHaveCount(1)

  await bca.getByRole('button', { name: 'Arsipkan' }).click()
  await expect(bca).toHaveCount(0)

  // Tanpa jalan kembali, akun yang terlanjur diarsipkan hilang selamanya
  // padahal saldonya masih ikut kekayaan bersih.
  await page.getByRole('button', { name: /Lihat akun yang diarsipkan/ }).click()
  await expect(bca).toHaveCount(1)
  await bca.getByRole('button', { name: 'Aktifkan lagi' }).click()

  // Kembali ke daftar utama — dan bertahan setelah reload, jadi ini benar-benar
  // sampai ke Postgres.
  await page.reload()
  await expect(bca.getByRole('button', { name: 'Arsipkan' })).toBeVisible()

  // Dirapikan lagi supaya run berikutnya tidak menumpuk akun aktif.
  await bca.getByRole('button', { name: 'Arsipkan' }).click()
  await expect(bca).toHaveCount(0)
})

test('piutang: ngutangin, dicicil, hapus dengan konfirmasi §11.2, lalu sisa cicilan ikut bisa dihapus', async ({ page, userEmail: _userEmail }) => {
  await page.goto('/finance')
  await skipSetup(page, page.getByText('Uang kamu'))
  // FAB baru ada setelah /finance/overview membalas — tunggu berandanya
  // benar-benar terisi supaya kegagalan muncul di sini, bukan sebagai klik
  // yang menggantung tanpa penjelasan.
  await expect(page.locator('.finance-headline__value')).toBeVisible()

  const record = async (situasi: RegExp, jumlah: string) => {
    await page.getByRole('button', { name: 'Catat transaksi' }).click()
    await page.getByRole('button', { name: situasi }).click()
    await page.getByLabel('Jumlah').fill(jumlah)
    await page.getByLabel('Nama', { exact: true }).fill('Budi')
    await page.getByRole('button', { name: 'Simpan' }).click()
    await expect(page.getByRole('dialog')).toBeHidden()
  }

  await record(/Ngutangin/, '500000')
  await record(/Utang dibayar/, '200000')

  // Lewat alamatnya langsung: di beranda nama "Budi" juga muncul di daftar
  // transaksi terakhir, jadi selektor yang sama akan ambigu kalau tabnya
  // belum benar-benar berganti.
  await page.goto('/finance/piutang')
  const budi = page.locator('.finance-tx').filter({ hasText: 'Budi' })
  await expect(budi.locator('.finance-tx__amount')).toHaveText('Rp 300.000')

  // Hapus catatan pinjamannya: cicilan Budi masih ada, jadi server balas 409
  // dan client memunculkan konfirmasi §11.2 dengan jumlah + nilai catatan lain.
  await budi.getByRole('button', { name: 'Hapus' }).click()
  const konfirmasi = page.getByRole('dialog')
  await expect(konfirmasi).toContainText('Hapus catatan Budi?')
  await expect(konfirmasi).toContainText('1 catatan lain senilai Rp 200.000')
  await konfirmasi.getByRole('button', { name: 'Hapus satu saja' }).click()
  await expect(konfirmasi).toBeHidden()

  // Yang tersisa cuma cicilan — sisanya negatif, ditampilkan apa adanya (§11.4).
  await expect(budi.locator('.finance-tx__amount')).toHaveText('−Rp 200.000')

  // Dan catatan yatim itu tetap bisa dihapus lewat tombol yang sama: tanpa
  // fallback ke baris cicilan, angka merah itu jadi jalan buntu tanpa UI
  // mana pun yang bisa membereskannya.
  await budi.getByRole('button', { name: 'Hapus' }).click()
  await expect(budi).toHaveCount(0)

  await page.reload()
  await expect(page.locator('.finance-tx').filter({ hasText: 'Budi' })).toHaveCount(0)
})
