# SGI One

Aplikasi operasi logistik internal Sandika Global Indonesia. Alur kerja: customer → job order → penugasan → surat jalan dan bukti → verifikasi → billing → invoice → pembayaran → dashboard direktur.

Kebutuhan produk: [PRD.md](PRD.md). Stack: Next.js, TypeScript, Cloudflare Kumo UI, PostgreSQL, Drizzle ORM, Better Auth dan Cloudflare R2 privat.

## Menjalankan aplikasi

Prasyarat: Node.js 24, npm, dan Docker Desktop dengan Linux containers.

```powershell
npm ci
npm run setup
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev
```

Buka [localhost:4310](http://localhost:4310). PostgreSQL memakai port host 54329. `setup` membuat `.env` dan secret autentikasi jika belum tersedia. Konfigurasi manual dapat menggunakan `.env.example`.

Untuk menjalankan build:

```powershell
npm run build
npm run start
```

Hentikan aplikasi dengan Ctrl+C. `npm run db:down` menghentikan PostgreSQL tanpa menghapus volume. Seed bersifat idempotent; tidak menghapus transaksi atau mengganti password akun yang sudah ada.

## Akun dan akses

| Akun contoh | Area kerja |
| --- | --- |
| operations@sgilogistic.com | Operations |
| field@sgilogistic.com | Petugas lapangan |
| field2@sgilogistic.com | Petugas lapangan |
| finance@sgilogistic.com | Finance |
| director@sgilogistic.com | Direktur |
| sales@sgilogistic.com | Sales |
| admin@sgilogistic.com | Pengelolaan pengguna; dapat memilih area kerja yang diberikan |

Password mengikuti `DEMO_PASSWORD` saat akun pertama kali dibuat melalui seed. Akun baru dikelola melalui Pengguna & akses; pendaftaran publik ditutup.

Role dan assignment diperiksa pada setiap pembacaan dan perubahan di server. Petugas hanya mengakses job yang ditugaskan. Role mengikuti akun; pemilih area kerja hanya tersedia untuk administrator dan terbatas pada role yang diberikan. Preferensi tersimpan dalam cookie HttpOnly terikat akun. URL halaman tidak memakai parameter role.

## Modul

- Customer, permintaan order, penawaran dan persetujuan tarif.
- Job order, penugasan, progres, surat jalan digital, laporan dan foto lapangan.
- Upload, revisi, penolakan, verifikasi dan preview dokumen privat.
- Komponen tagihan, invoice draft/gabungan, penerbitan, void dan credit note.
- Pembayaran parsial, alokasi multi-invoice dan saldo penerimaan.
- Dashboard sesuai role, analitik per periode/mata uang dan ekspor CSV.
- Peta job, lokasi asal/tujuan, rute jalan dan GPS perangkat.
- Absensi dengan GPS/foto, riwayat pribadi dan review.
- Pengguna, role, aktivasi akun dan audit logs.

Uang disimpan sebagai integer minor units. Penerbitan invoice dan alokasi pembayaran memakai transaksi serta locking PostgreSQL. Invoice terbit menyimpan snapshot; perubahan terkontrol tetap tercatat dalam audit. Draft boleh dibuat lebih awal, sedangkan penerbitan memeriksa status pekerjaan, bukti, tarif, saldo dan kesesuaian customer/termin.

Kumo digunakan untuk sidebar, navigasi, tabs, tabel, form, dialog, kalender, filter, autocomplete dan grafik. Tablet/desktop mempertahankan shell enterprise. Pada ponsel, susunan panel dan tabel menyesuaikan layar dengan navbar floating. Pencarian global tersedia melalui sidebar, tombol mobile dan Ctrl/Cmd+K.

## Penyimpanan dokumen

Isi `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` dan `R2_BUCKET` di `.env`. Bucket harus privat; credentials hanya dibaca backend.

Upload melalui backend memeriksa sesi, permission, assignment, tipe/signature, nama dan batas 10 MB. Object key acak, metadata dan versi tersimpan di PostgreSQL. Download/preview memeriksa ulang akses pada setiap request. Upload tidak otomatis dianggap terverifikasi. Kegagalan penyimpanan tidak menghasilkan laporan atau dokumen sukses palsu.

Invoice dan surat jalan menggunakan halaman cetak yang dapat disimpan sebagai PDF melalui browser. JPG/PNG/WebP/PDF dapat dipreview; aset PDF.js disiapkan oleh `predev` dan `prebuild`.

## Peta dan lokasi

Pada layar lebar, pilih job dari daftar di samping peta. Pada layar sempit gunakan selector Job pada peta. Rincian dan status rute berada di atas peta.

1. Pilih job dan tekan Tetapkan lokasi atau Ubah lokasi.
2. Pilih asal dari hasil pencarian atau pin peta, lalu Lanjut ke tujuan.
3. Pilih tujuan, periksa alamat dan tekan Simpan dan lihat rute.
4. Rute ditampilkan otomatis dengan jarak, estimasi waktu dan petunjuk perjalanan.

Pencarian lokasi memiliki debounce 500 ms, pembatalan respons lama, tiga saran awal dan Tampilkan semua. Hasil bernama sama dibedakan berdasarkan koordinat. Saran otomatis berasal dari lokasi job yang dapat diakses, hasil lookup yang sudah dicache, serta Photon berbasis OpenStreetMap. Tombol Cari menjalankan pencarian alamat manual. Pin dapat dipilih dengan klik/Enter dan digeser; map mendukung wheel, trackpad dan pinch zoom. Semua tampilan peta dan tautan koordinat/rute memakai OpenStreetMap.

Provider default:

- `NEXT_PUBLIC_MAP_TILE_URL`: tile OpenStreetMap dengan atribusi terlihat, tanpa download offline/prefetch.
- `GEOCODING_BASE_URL`: [Photon](https://github.com/komoot/photon), untuk saran otomatis.
- `NOMINATIM_BASE_URL`: lookup manual/reverse pin sesuai [kebijakan Nominatim](https://operations.osmfoundation.org/policies/nominatim/). Public Nominatim **tidak dipanggil untuk autocomplete**. Request hanya atas aksi pengguna, dicache satu jam, dideduplikasi dan diproses melalui satu antrean dengan jeda minimal 1,1 detik. Jangan masukkan data pribadi atau rahasia ke layanan publik; gunakan provider sendiri untuk kebutuhan tersebut atau volume besar.
- `ROUTING_BASE_URL`: OSRM di backend. Sistem membandingkan jarak dan waktu dari alternatif jalan yang tersedia; kegagalan provider ditampilkan sebagai error, tidak diganti garis lurus.

Provider dapat diganti melalui environment. Layanan Photon publik dapat timeout; lookup manual dan pin tetap tersedia. Semua koordinat divalidasi sebelum disimpan dan perubahan lokasi dicatat dalam audit. Estimasi rute berkendara tidak mencakup lalu lintas langsung, penutupan jalan atau batas dimensi/muatan truk.

GPS membutuhkan izin browser dan HTTPS atau localhost. Posisi perangkat dipakai untuk tampilan/rute saat aktif, tanpa penyimpanan riwayat pergerakan armada.

## Database

Migration berada di `drizzle/` dengan nama sesuai perubahan schema. Penamaan ulang migration mempertahankan hash SQL dan timestamp journal; migration yang sudah diterapkan tidak dijalankan ulang. Jalankan `npm run db:migrate` sebelum menggunakan schema terbaru.

Data seed memakai identitas simulasi. Tidak ada dokumen verified palsu atau upload sukses tanpa R2. PostgreSQL lokal via Docker adalah konfigurasi utama; `npm run db:local` tetap tersedia sebagai alat development alternatif untuk mesin tanpa Docker.

## Verifikasi

```powershell
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:e2e
npm run build
```

Berkas pengujian, konfigurasi test, screenshot, log, temp, agent tooling dan dokumentasi tambahan tetap tersedia lokal namun dikecualikan dari tracking Git. Markdown yang dilacak hanya README dan PRD. Perintah test memerlukan berkas verifikasi lokal tersebut; berkasnya tidak disertakan dalam clone baru.

Verifikasi lokasi/peta: 45 unit test dan lima skenario Playwright mencakup debounce, preview/tampilkan semua, keyboard, respons terlambat, pencarian alamat asli, simpan lokasi, rute, RBAC, wheel/trackpad dan pinch zoom. Screenshot diambil pada 320×700, 375×812, 390×844, 430×932, 768×1024 dan 1440×900.

- Sebelum: `artifacts/location-workflow/before/`.
- Sesudah: `artifacts/location-workflow/after/`.
- Skenario browser: `tests/e2e/location-workflow.spec.ts`.
- Uji situs publik: `artifacts/verify-public-map.mjs`.

## Deployment Azure App Service

Runtime Node.js 24 pada Linux App Service menggunakan output Next.js standalone. PostgreSQL berada pada Azure Database for PostgreSQL; dokumen tetap memakai bucket Cloudflare R2 privat.

```powershell
npm ci
npm run lint
npm run typecheck
npm run build
npm run package:azure
```

Paket aplikasi ada di `artifacts/azure/app`. Paket menyertakan aset publik, migration dan bootstrap database, serta mengecualikan seluruh `.env*`. Build untuk Azure harus dijalankan pada Linux agar dependency native sesuai runtime.

Atur startup command App Service ke `node start-azure.mjs`, matikan build saat deployment (`SCM_DO_BUILD_DURING_DEPLOYMENT=false`), dan gunakan `/api/health` sebagai health check. Migration berjalan sebelum server mulai dan dilindungi advisory lock PostgreSQL. Seed hanya berjalan jika `DEMO_SEED_ENABLED=true`; akun yang sudah ada tidak direset pada restart atau deployment berikutnya.

Application settings wajib: `DATABASE_URL` dengan TLS (`sslmode=verify-full`), `BETTER_AUTH_URL` berisi origin HTTPS Azure, `BETTER_AUTH_SECRET` acak minimal 32 karakter, dan seluruh konfigurasi R2 pada `.env.example`. Simpan secret hanya dalam Application settings, bukan Git atau workflow. Tambahkan `DEMO_PASSWORD` dan `DEMO_SEED_ENABLED=true` untuk inisialisasi akun simulasi, lalu nonaktifkan seed setelah deployment pertama.

Deployment otomatis menggunakan GitHub Actions pada push ke `main`, OIDC Azure, dan paket hasil build. Batasi federated credential ke repository/branch tersebut dan izin deployment ke aplikasi SGI. Akses firewall PostgreSQL dibatasi ke outbound IP App Service. Lingkungan pengembangan tetap menggunakan Docker Compose lokal.

## Publikasi Sites sebelumnya

[SGI One](https://sgi-one-logistics.frein-koch-3677.chatgpt.site) menggunakan gateway dari hosting Sites ke aplikasi lokal. Aplikasi, PostgreSQL, gateway dan tunnel harus berjalan agar URL tersebut tersedia. Database, Better Auth dan credentials R2 tetap berada di backend lokal.

## Batas cakupan

Akuntansi penuh, payroll, integrasi bank/customs, WMS, multi-tenant dan pelacakan armada terus-menerus berada di luar cakupan. Dokumen memakai print-to-PDF browser; tanda tangan kriptografis belum tersedia. SOP checklist, termin dan pajak mengikuti asumsi MVP dalam PRD dan perlu disesuaikan sebelum penggunaan operasional resmi.
