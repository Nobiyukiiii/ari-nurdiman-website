# Ari Nurdiman: website + admin panel (terhubung lewat Supabase)

Dua aplikasi terpisah yang berbagi satu sumber data:

```
┌──────────────┐  edit / unggah foto   ┌─────────────────────────┐   build (pull)   ┌────────────────┐
│ ADMIN PANEL  │ ────────────────────▶ │ SUPABASE                │ ◀─────────────── │ WEBSITE        │
│ admin/       │                       │ Postgres + Storage+Auth │   anon key,      │ site/ (HTML    │
│ (HTML statis)│ ◀── cek versi ──────  │ supabase/schema.sql     │   hanya "published" statis)      │
└──────┬───────┘                       └─────────────────────────┘                  └───────▲────────┘
       │ tombol Publish = panggil Deploy Hook host                                          │
       └────────────────────────────────────────────────────────────────────────────────────┘
                              host membangun ulang website → dist/ + version.json
```

- **Website** tetap HTML statis (cepat, aman, SEO). Saat build, ia menarik data yang berstatus *published* dari Supabase dan **mengunduh semua foto ke `public/assets/`**, jadi tidak ada hotlink ke Supabase.
- **Admin panel** adalah aplikasi statis lain (`admin/`) dengan login Supabase. Semua perubahan (rilisan single/EP/album, foto galeri, video, berita, foto artis, teks, akun sosial) tersimpan di Supabase.
- **Sinkron:** badge di admin membandingkan "versi data" di database dengan `version.json` di website. Tombol **Publish** memicu build ulang; admin memantau sampai website ikut sinkron.

## Isi repo

| Folder | Isi |
|---|---|
| `site/` | Website statis (generator `build.mjs`, `content/`, `scripts/pull-supabase.mjs`, `scripts/seed-supabase.mjs`) |
| `admin/` | Panel admin (HTML/CSS/JS murni, tanpa build) |
| `supabase/schema.sql` | Tabel (termasuk `ui_text` untuk label/tombol), Row Level Security, bucket foto `media` |
| `tools/` | `mock-supabase.mjs` (tiruan Supabase lokal untuk uji), `serve-static.mjs` |

## Pemasangan (sekali saja)

### 1. Supabase
1. Buat proyek di supabase.com.
2. **SQL Editor** → tempel isi `supabase/schema.sql` → Run (aman dijalankan ulang).
3. **Authentication → Users → Add user** (email + kata sandi, centang *Auto Confirm*). Lalu di SQL Editor:
   ```sql
   insert into public.admins (user_id, email)
   select id, email from auth.users where email = 'EMAIL-ANDA@example.com'
   on conflict (user_id) do nothing;
   ```
4. **Authentication → Providers → Email**: matikan *Allow new users to sign up* (hanya Anda yang boleh masuk).
5. **Project Settings → API**: catat `Project URL`, `anon public key`, dan `service_role key` (rahasia).

### 2. Isi data awal (menyalin isi website saat ini ke Supabase)
```bash
cd site
cp .env.example .env         # isi SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
npm run assets               # unduh foto asli ke public/assets (butuh internet)
npm run seed                 # unggah foto + data ke Supabase
```
Bila belum punya file foto, lewati `assets`; unggah nanti langsung dari admin.

### 3. Admin panel
```bash
cd admin
cp config.example.js config.js     # isi SUPABASE_URL dan SUPABASE_ANON_KEY (anon key memang publik)
node ../tools/serve-static.mjs . 8090   # uji lokal: http://localhost:8090
```
Deploy folder `admin/` ke host statis mana pun (mis. Cloudflare Pages: root directory `admin`, tanpa build command, output `.`), sebaiknya di subdomain seperti `admin.domain.com`.

### 4. Website + tombol Publish
Cloudflare Pages (atau Netlify/Vercel):
- Root directory: `site` · Build command: `npm run build:remote` · Output: `dist`
- Environment variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (anon saja, **jangan** service role), `NODE_VERSION=20`
- Buat **Deploy Hook** di pengaturan proyek, lalu tempel URL-nya di admin → **Pengaturan → Integrasi publish**.
- Di admin → **Pengaturan**, isi **Alamat website** (URL live) agar badge sinkron bekerja.

## Pemakaian sehari-hari
1. Masuk ke admin → ubah data / ganti foto / tambah single, EP, atau album, atau ubah label & teks tombol di menu **Teks Website**.
2. Klik **Publish**. Website dibangun ulang (1–2 menit); badge berubah menjadi **Website sinkron**.

## Yang bisa diubah dari admin (lengkap)
- **Musik**: tambah/ubah/hapus single, EP, album; cover, tanggal, durasi, deskripsi, daftar lagu, kredit, tautan Spotify/YouTube/lirik, urutan, status draf/tampil.
- **Galeri, Video, Berita**: unggah/ubah/hapus, urutan, status.
- **Pengaturan**: foto artis, teks hero, biografi & data diri, teks tiap bagian (Rilis Terbaru, Dengarkan), akun sosial resmi, email kontak, aktif/nonaktifnya bagian Video/Galeri/Berita/Final Corners, deploy hook.
- **Teks Website** (baru): semua label menu, teks tombol ("Dengarkan di Spotify", "Kembali ke Musik", dst.), judul-judul kecil di halaman lagu/musik/tentang, dan halaman 404 — sekitar 49 teks, dikelompokkan per bagian. Kosongkan kolom untuk memakai teks bawaan.
- Satu-satunya hal yang **tidak** diedit dari admin: kode/desain (warna, tata letak, animasi) dan struktur JSON-LD/SEO teknis.

Detail penting:
- **Draf vs Tampil**: item berstatus *Draf* tidak pernah masuk website.
- **Ganti foto**: pilih atau seret file; otomatis dikecilkan ke JPEG, dan file lama dihapus setelah disimpan.
- **Album/EP**: pilih jenis Album/EP, isi daftar lagu; halaman rilisan menampilkan daftar lagu dan data terstruktur `MusicAlbum`.
- **Bagian opsional** (Video, Galeri, Berita, Final Corners) muncul di website hanya bila diaktifkan di Pengaturan dan datanya terisi.
- Tanpa Supabase, website tetap bisa dibangun dari `site/content/*.json` (`npm run build`).

## Keamanan
- Anon key publik; yang bisa dilakukan pengunjung dibatasi RLS: hanya membaca data *published*.
- Menulis data, melihat draf, deploy hook, dan mengunggah foto hanya untuk akun di tabel `public.admins`.
- Service role key hanya untuk `npm run seed` di komputer Anda. Jangan taruh di admin, build server, atau repo.
- Isi hanya informasi yang terverifikasi (akun sosial, kredit, tanggal). Admin memvalidasi domain akun sosial dan format tautan.

## Pengujian yang sudah dilakukan
- `schema.sql` dijalankan dua kali di PostgreSQL 16 (idempoten) dan kebijakan RLS diuji untuk anon, pengguna non-admin, dan admin.
- Alur lengkap diuji di browser headless terhadap `tools/mock-supabase.mjs` (tiruan API Supabase): login, tambah/ubah/hapus rilisan, unggah + ganti cover, album dengan daftar lagu, unggah massal galeri, validasi, Publish → build ulang → badge sinkron, dan website hasil build memuat perubahan.
- **Belum diuji terhadap proyek Supabase sungguhan** (sandbox tidak bisa menjangkau internet). Uji pertama di proyek Anda: masuk → tambah rilisan draf → Publish.
