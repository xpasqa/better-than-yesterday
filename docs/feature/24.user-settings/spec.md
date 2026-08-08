# Spec: Halaman Settings — timezone

**Tanggal:** 2026-08-08
**Status:** disetujui, siap diimplementasi
**Menutup:** `1.todo/todo.md` blok J baris "Halaman Settings"

---

## 1. Konteks — dan koreksi atas catatan lama

[`todo.md`](../2.backend/1.todo/todo.md) blok J menulis:

> Halaman Settings — belum (timezone user memakai default `Asia/Jakarta`)

**Setengahnya keliru.** Timezone user sudah dipakai di sembilan tempat:

```
apps/web/src/components/TodayReal.tsx:23:  const timezone = user.timezone ?? 'Asia/Jakarta'
```

`'Asia/Jakarta'` di situ **fallback**, bukan hardcode. Kolomnya ada,
nilainya sampai ke klien lewat `AuthUser.timezone`, dan dipakai untuk
menentukan hari mana yang disebut "hari ini".

Yang benar-benar hilang cuma satu: **tidak ada cara mengubahnya.** Tidak ada
satupun route yang menulis ke `app_user` — `apps/api/src/modules/auth/routes.ts:82`
hanya membaca.

## 2. Temuan yang mengecilkan fitur ini

`app_user` punya empat kolom preferensi. Saya cek satu per satu apakah
nilainya benar-benar menyetir sesuatu:

| Kolom | Dibaca di luar definisi skema? |
|---|---|
| `timezone` | **ya** — 9 tempat |
| `language` | **tidak** |
| `week_start` | **tidak** |
| `default_remind_time` | **tidak** |

`language` yang paling menipu: ia **ada** di `ParseContext`
(`parse.ts:37`) dan dioper dari dua komponen sebagai `language: 'id'` — tapi
`grep -n "language" packages/core/src/parse.ts` cuma menemukan **baris
deklarasinya**. Tidak ada satupun pola yang membacanya. Parser mencocokkan
kata Indonesia dan Inggris sekaligus, tanpa syarat, apa pun isinya.

Jadi tiga dari empat kolom itu adalah **kenop yang tidak tersambung ke apa
pun**. Membuatkan UI untuknya berarti membangun kebohongan: orang menggeser
"Awal minggu" ke Minggu, tidak ada yang berubah, dan mereka menyimpulkan
aplikasinya rusak — bukan bahwa fiturnya memang belum ada.

**Karena itu fitur ini hanya menangani timezone.** Tiga kolom sisanya punya
kartu sendiri ([#74](https://github.com/xpasqa/better-than-yesterday/issues/74)) untuk memutuskan disambungkan atau dicabut — keputusan
yang wataknya beda dan tidak boleh diselundupkan lewat halaman Settings.

---

## 3. Scope

**In:**
- `PATCH /api/me` — menulis `timezone`
- Halaman `/settings` dengan pemilih timezone
- `AuthUser` di state aplikasi ikut diperbarui setelah simpan

**Out (dengan alasan):**
- **`language`, `week_start`, `default_remind_time`** — §2. Kenop tanpa kabel.
- **Ganti nama / email / password** — autentikasi punya wataknya sendiri
  (verifikasi email, sesi yang harus dicabut). Bukan "preferensi".
- **Preferensi per perangkat** (tema, list/board) — sudah di `localStorage`
  dan memang benar di sana. Halaman ini untuk yang mengikuti akun ke
  perangkat lain.

---

## 4. Keputusan desain

| Keputusan | Alasan |
|---|---|
| **`PATCH /api/me`, bukan lewat `/api/sync`** | Sync dibangun untuk entitas ber-`seq` dengan LWW dan cursor. `app_user` bukan salah satunya; menariknya ke sync berarti menambah tabel syncable demi satu baris per user. |
| **Route menerima objek preferensi, bukan hanya `timezone`** | Bentuknya sudah benar untuk kolom berikutnya kalau [#74](https://github.com/xpasqa/better-than-yesterday/issues/74) memutuskan menyambungkannya. Ini **bukan** spekulasi — ia tidak menambah kode, cuma memilih bentuk yang tidak perlu dibongkar. Skema Zod-nya hari ini tetap satu field. |
| **Zod menolak timezone yang tidak dikenal** | `Intl.supportedValuesOf('timeZone')` ada di Node 22 dan semua browser sasaran. Timezone ngawur membuat `localDate` mengembalikan tanggal salah **diam-diam** — bug yang baru ketahuan berminggu-minggu kemudian. |
| **Simpan saat diubah, tanpa tombol Save** | Satu field. Tombol Save memaksa orang mengingat menekannya. |

---

## 5. Blok A — backend

**File:** `apps/api/src/modules/user/routes.ts` (baru), didaftarkan di app utama

```ts
const prefsSchema = z.object({
  timezone: z
    .string()
    .refine((tz) => Intl.supportedValuesOf('timeZone').includes(tz), 'unknown timezone')
    .optional(),
})
```

`PATCH /api/me` — sesi wajib; menulis hanya field yang dikirim; mengembalikan
user dalam **bentuk yang persis sama** dengan `GET /api/me`
(`auth/routes.ts:82`), supaya klien bisa memakai satu penangan untuk keduanya.

> **Kontrak frontend berlaku** (CLAUDE.md): respons dibentuk mengikuti
> `AuthUser`, bukan mengikuti nama kolom DB.

Body kosong `{}` → 200 tanpa menulis apa-apa. Ia bukan kesalahan, dan
menolaknya cuma menambah cabang yang harus diuji.

## 6. Blok B — halaman Settings

**File:** `apps/web/src/components/SettingsView.tsx` · `auth-api.ts` ·
`routes.ts` · `App.tsx` · `Sidebar.tsx`

```ts
export async function updateMe(prefs: { timezone?: string }): Promise<AuthUser>
```

Isi halaman: pemilih timezone (`<select>` dari `Intl.supportedValuesOf`),
plus baris baca-saja nama dan email supaya halamannya tidak terasa kosong.

**Setelah simpan berhasil, `AuthUser` di state `App` wajib diperbarui.**
Kalau tidak, mengubah timezone tidak memindahkan apa pun sampai reload — dan
itu terbaca sebagai "tombolnya rusak", bukan "perlu reload". Ini satu-satunya
bagian fitur ini yang gampang salah.

Tautan masuk lewat menu profil yang sudah ada, tempat orang mencarinya.

---

## 7. Success Criteria

- [ ] `/settings` menampilkan timezone yang sekarang berlaku
- [ ] Mengubahnya memindahkan task di Today **tanpa reload**
- [ ] Pilihannya bertahan setelah reload dan ikut ke perangkat lain
- [ ] Timezone tidak sah ditolak 400, bukan disimpan diam-diam
- [ ] `PATCH /api/me` menolak permintaan tanpa sesi
- [ ] Tidak ada kontrol untuk preferensi yang belum menyetir apa pun
- [ ] `npm run verify` hijau
