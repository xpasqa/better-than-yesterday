import { test, expect } from './fixtures.ts'

// Bukan menguji ulang perhitungan §9 — itu sudah dikunci tes integrasi.
// Yang dibuktikan di sini: rantai UI → @better/core → API → agregasi
// benar-benar tersambung (spec §12).
test('catat pengeluaran lewat daftar situasi, angka beranda ikut berubah', async ({ page, userEmail: _userEmail }) => {
  await page.goto('/finance')

  // Lewati setup: user baru hanya punya Dompet + Piutang hasil seed. Kondisional
  // karena kalau user e2e dipakai ulang antar run, akunnya sudah ada dan
  // localStorage bersih tapi wizard tidak akan muncul lagi (lihat brief langkah 2).
  // isVisible() sendiri tidak menunggu — dipanggil sesaat setelah goto() ia
  // bisa balik false cuma karena render belum selesai, bukan karena wizard
  // memang tidak ada. Tunggu dulu salah satu (wizard atau beranda) benar-benar
  // muncul sebelum memutuskan.
  const wizardButton = page.getByRole('button', { name: 'Lanjut' })
  const headlineLabel = page.getByText('Uang kamu')
  await expect(wizardButton.or(headlineLabel)).toBeVisible()
  if (await wizardButton.isVisible()) {
    await wizardButton.click()
    await page.getByRole('button', { name: 'Tidak' }).click()
    await page.getByRole('button', { name: 'Selesai' }).click()
  }

  // Headline dipilih lewat kelasnya, bukan lewat teks: "Rp 25.000" muncul di
  // dua tempat sekaligus (headline dan daftar transaksi terakhir), dan
  // getByText yang ambigu akan gagal karena strict mode Playwright.
  const headline = page.locator('.finance-headline__value')
  await expect(headlineLabel).toBeVisible()
  await expect(headline).toHaveText('Rp 0')

  await page.getByRole('button', { name: 'Catat transaksi' }).click()
  await page.getByRole('button', { name: /Pengeluaran/ }).click()
  await page.getByLabel('Jumlah').fill('25000')
  await page.getByLabel('Kategori').selectOption({ label: 'Makan' })
  await page.getByRole('button', { name: 'Simpan' }).click()

  // Headline turun jadi negatif — Dompet mulai dari nol (§11.4: negatif
  // ditampilkan, tidak diblokir) — dan transaksinya muncul di daftar terakhir.
  await expect(headline).toHaveText('−Rp 25.000')
  await expect(page.getByText('Makan')).toBeVisible()

  // Reload membuktikan ia benar-benar sampai ke Postgres, bukan cuma state React.
  await page.reload()
  await expect(headline).toHaveText('−Rp 25.000')
})

test('tab punya alamat sendiri dan bertahan setelah reload', async ({ page, userEmail: _userEmail }) => {
  await page.goto('/finance/akun')
  await expect(page.getByText('Dompet')).toBeVisible()
  await expect(page.getByText('Piutang')).toBeVisible()

  await page.reload()
  await expect(page).toHaveURL(/\/finance\/akun$/)
  await expect(page.getByText('Dompet')).toBeVisible()
})
