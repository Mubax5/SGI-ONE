# SGI One

Prototype internal single-tenant untuk Sandika Global Indonesia: customer → job order → penugasan → surat jalan/bukti privat → review → flexible billing → invoice → pembayaran → dashboard direktur. Implementasi mengikuti kebutuhan produk `PRD.md` dan aturan wajib `AGENTS.md`.

**Stack:** Next.js App Router + TypeScript, Cloudflare Kumo UI, Phosphor Icons, PostgreSQL lokal, Drizzle ORM, Better Auth dengan session database, dan Cloudflare R2 privat. Tidak ada Supabase, hosted auth, atau penyimpanan file publik.

## Setup lokal

Prasyarat: Node.js 24 LTS, npm, Docker Desktop dengan Linux containers dan virtualisasi aktif. PostgreSQL Docker menggunakan port host **54329**; Next.js **4310** karena port 3000 tidak tersedia pada mesin implementasi.

```powershell
npm ci
npm run setup
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev
```

Buka [SGI One lokal](http://localhost:4310). `npm run setup` membuat `.env` hanya jika belum ada, menghasilkan secret autentikasi acak, dan mengaktifkan seed simulasi. File `.env` tidak masuk version control. Untuk konfigurasi manual, salin `.env.example`, isi secret acak minimal 32 karakter, lalu set `DEMO_SEED_ENABLED=true` dan `DEMO_PASSWORD` minimal 12 karakter sebelum seed.

| Akun demo             | Role                                                   |
| --------------------- | ------------------------------------------------------ |
| `operations@sgi.demo` | Operations                                             |
| `field@sgi.demo`      | Field · Bima                                           |
| `field2@sgi.demo`     | Field · Dewi                                           |
| `finance@sgi.demo`    | Finance                                                |
| `director@sgi.demo`   | Direktur                                               |
| `sales@sgi.demo`      | Sales                                                  |
| `admin@sgi.demo`      | System admin + Operations + Finance + Direktur + Sales |

Kata sandi seed default dari `npm run setup`: **`SgiDemo2026!`**. Ini hanya akun simulasi; ganti `DEMO_PASSWORD` sebelum seed baru jika diperlukan. Seed idempotent mempertahankan akun, password, dan transaksi yang sudah ada; mengubah `.env` tidak mengubah password akun yang sudah tersimpan. Akun baru dapat dibuat administrator melalui **Pengguna & akses**. Pendaftaran publik ditutup. Role many-to-many dihitung ulang dari PostgreSQL pada setiap request; menonaktifkan akun juga mencabut session.

### Konfigurasi R2 wajib untuk bukti digital

1. Buat bucket **privat** pada Cloudflare R2; jangan aktifkan public development URL atau custom domain publik.
2. Buat kredensial S3 API dengan izin object read/write terbatas pada bucket tersebut.
3. Isi `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, dan `R2_BUCKET` dalam `.env`, lalu restart Next.js.
4. Uji upload dari job yang ditugaskan, review sebagai Operations, dan unduh dari akun berizin.

Pada mesin ini bucket privat **`sgi-one-demo`** dan kredensial backend sudah terpasang. Pengujian R2 nyata telah lolos, termasuk upload/reject/revisi/verify/download dan invoice reguler sampai pembayaran parsial. Token hanya mempunyai Object Read & Write pada bucket tersebut, aktif sampai **7 November 2026**. Perbarui token dan `.env` sebelum tanggal itu lalu restart aplikasi. Secret tidak disertakan dalam dokumentasi atau screenshot.

File dikirim browser → backend → R2. Backend memvalidasi tipe PDF/JPG/PNG, ekstensi/signature, nama, ukuran maksimal 10 MB, session, role dan assignment; seluruh stream request dibatasi. Key objek acak, metadata/versi di PostgreSQL, dan setiap download di-proxy backend sesudah pemeriksaan ulang izin. Tidak ada URL bucket yang dibagikan ke browser. Bucket CORS tidak diperlukan untuk upload backend. Kegagalan R2 menghasilkan error nyata; tidak menciptakan metadata sukses atau bukti terverifikasi.

**Lingkungan implementasi:** Docker Desktop sudah berjalan setelah aktivasi Windows Subsystem for Linux, Virtual Machine Platform, pembaruan WSL 3.0.1 dan restart Windows. Aplikasi sekarang memakai **PostgreSQL 17.11 dalam Docker Compose** pada loopback 54329. Migration, seed, 54 pengujian unit/integrasi, pengujian browser dan R2 nyata berhasil pada database Docker. Fallback PostgreSQL asli sebelumnya tetap tersedia sebagai alat development untuk mesin tanpa Docker:

```powershell
npm run db:local
# Biarkan terminal ini terbuka; pada terminal kedua:
npm run db:migrate
npm run db:seed
npm run dev
```

Fallback adalah alat development, menyimpan cluster di `artifacts/postgres-local`, dan hanya bind ke loopback. Jangan menjalankan fallback bersamaan dengan PostgreSQL Docker pada port yang sama. Compose tetap jalur utama development/demo. Perpindahan fallback → Docker memakai database/volume berbeda; jalankan migration dan seed di database target. Jangan menyalin folder cluster antarversi PostgreSQL.

Database Docker saat ini menggunakan seed baru. Cluster fallback beserta data simulasi/pengujian sebelumnya tetap tersimpan dan tidak dihapus; data itu tidak otomatis disalin ke volume Docker.

Untuk mesin Windows lain yang memerlukan prasyarat Docker, jalankan `scripts/enable-docker-windows.ps1` melalui PowerShell sebagai Administrator. Skrip mengaktifkan kedua optional features yang diperlukan, memperbarui WSL dari Microsoft, dan mencatat hasil di `artifacts/docker-windows-setup.json`. Skrip tidak me-restart komputer otomatis. Referensi: [Microsoft WSL](https://learn.microsoft.com/en-us/windows/wsl/install-manual) dan [Docker Windows](https://docs.docker.com/desktop/setup/install/windows-install/).

## Modul yang tersedia

| Modul                  | Fungsi                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Customer               | Buat, cari, ubah kontak/alamat, nonaktifkan tanpa menghapus relasi                                                        |
| Permintaan & penawaran | Sumber order, penawaran/kontrak, persetujuan Finance, revisi tanpa overwrite                                              |
| Job order              | Nomor unik, PIC Operations, layanan, rute, tenggat, edit draft, penugasan beberapa petugas                                |
| Lapangan               | Job assignment saja, progres, transisi status, surat jalan digital dan cetak/PDF browser                                  |
| Dokumen                | Upload R2 privat, metadata/versi, alasan reject, resubmit versi baru, checklist review, download berizin                  |
| Billing                | Nilai integer minor units, mata uang, pajak basis points, tarif dan approval, saldo, blocker penerbitan                   |
| Invoice                | Draft awal/gabungan, edit/hapus draft, termin parsial, penerbitan atomik, nomor final, snapshot customer                  |
| Koreksi                | Void tanpa pembayaran/kredit; credit note dibatasi saldo, tanpa overwrite detail invoice                                  |
| Pembayaran             | Penerimaan, tanggal/metode/referensi unik, multi-invoice allocation, partial payment, unapplied credit                    |
| Dashboard              | Kalender dan preset periode WIB, job/dokumen/ready-to-bill, invoice terbit, piutang/overdue per mata uang, CSV            |
| Akses & audit          | Akun/role, aktif/nonaktif, perlindungan admin terakhir, audit append-only; admin hanya audit akun, direktur lintas fungsi |
| Absensi                | Check-in/check-out waktu server, riwayat pribadi, cegah check-in ganda                                                    |

Tabel mempunyai pencarian/filter yang relevan, pagination, loading, empty, validation, error dan success states. Desktop menjadi dasar layout. Pada mobile, setiap tabel berubah menjadi baris data berlabel dengan semua nilai dan aksi tetap tersedia tanpa scroll ke samping; navigasi utama berada di bawah seperti aplikasi mobile. Invoice dan surat jalan memakai halaman cetak; pilih **Save as PDF** pada dialog browser.

Shell memakai Sidebar, Breadcrumbs, Tabs, DropdownMenu dan CommandPalette Kumo asli. Setiap menu mempunyai ikon Phosphor yang berbeda, baik pada sidebar maupun menu mobile. Sidebar dapat diringkas; Ctrl/Cmd+K mencari fitur dan data nyata (customer, job, dokumen, laporan, komponen tagihan, penawaran, invoice, pembayaran, dan pengguna) sesuai izin serta penugasan pengguna. Section memakai LayerCard dengan header/isi terpisah. Heading daftar/detail 20px dan laporan desktop 30px mengikuti template Cloudflare yang diperiksa; laporan mobile 24px. Filter laporan menggunakan DatePicker range dan Popover Kumo; tanggal diproses dalam WIB, divalidasi di server, dan CSV mencantumkan periode yang benar-benar dihitung. Form, tabel, pagination, dialog, status, loading, empty dan error menggunakan Kumo. Oranye #FF4D0A serta logo diambil dari situs resmi SGI. Halaman masuk memakai satu panel sederhana. Layout mengacu dashboard Cloudflare yang diperiksa langsung lewat Computer Use; lihat [referensi desain](docs/design-reference.md).

## Homepage, Analitik dan mobile

Semua pengguna masuk ke `/home`. **Ponsel di bawah 640 px** memakai homepage dengan susunan referensi mobile yang diberikan: brand dan tiga aksi, pencarian lebar, shortcut favorit, ringkasan perhatian, dua ringkasan, empat shortcut status, seluruh fitur, serta navigasi floating. Homepage ponsel tidak memakai sidebar/tabel; isi dapat digulir dalam area yang berakhir di atas navbar floating. **Tablet/desktop mulai 640 px** kembali memakai dashboard role, sidebar Kumo, header, tabs dan tabel operasional sebelumnya. Detail laporan berada di **Analitik** (`/analytics`), dengan grafik `Chart` Kumo/ECharts dan struktur tugas sesuai role. `/dashboard` juga merender tampilan responsif yang sama untuk kompatibilitas tautan lama. Tiap role memperoleh query server berbeda:

| Role             | Isi Analitik                                                         | Aksi tengah navbar mobile |
| ---------------- | -------------------------------------------------------------------- | ------------------------- |
| Direktur         | Rekonsiliasi per mata uang, pekerjaan, kesiapan tagihan, periode/CSV | Laporan: bagian penagihan |
| Operations       | Penugasan aktif, dokumen menunggu review, laporan lapangan           | Laporan: catatan/foto     |
| Petugas lapangan | Job assignment, tenggat, laporan pribadi, kehadiran                  | Laporan: catatan/foto     |
| Finance          | Piutang, draft/blocker, pembayaran belum dialokasi                   | Invoice: buat draft       |
| Sales            | Permintaan, draft penawaran, tarif disetujui, relasi customer        | Order: catat permintaan   |
| System admin     | Pengguna/role dan perubahan akses                                    | Pengguna: tambah akun     |

Mobile memakai navbar floating hitam, lima posisi, safe area, dan Button Kumo berbentuk lingkaran di tengah. Homepage mempunyai pencarian global dan ikon seluruh fitur role terpilih. Sidebar desktop hanya ada pada halaman modul; pada mobile tidak dirender. Favorit (maksimal lima) dan penutupan ringkasan disimpan lokal per pengguna dan role, dengan pengaturan untuk memulihkannya. Bell membuka ringkasan tugas nyata; bukan notifikasi push. Tombol penting menggunakan varian **primary** Kumo asli, termasuk ring, loading, dan lapisan visual bawaannya; token brand mengubah warnanya menjadi oranye SGI.

**Laporan pekerjaan** pada /reports menyimpan catatan dan foto opsional JPG/PNG/WebP maksimal 10 MB. Form mendukung pilihan kamera melalui capture pada perangkat yang mendukungnya, pratinjau dan penghapusan pilihan foto sebelum kirim. Foto masuk R2 privat dengan object key acak; metadata, progres dan audit masuk PostgreSQL dalam satu transaksi. Laporan tidak otomatis memenuhi checklist verifikasi dokumen. Foto dibuka lewat endpoint berizin setiap request; petugas lain tanpa assignment tidak bisa membacanya. Catatan tanpa foto dapat disimpan tanpa R2; upload foto gagal tidak menghasilkan laporan sukses palsu.

Pencarian minimal dua karakter, dibatasi 6 hasil per jenis / 40 hasil total. Hasil membuka job detail, invoice/payment detail, atau daftar terfilter. Query belum memakai PostgreSQL full-text index; optimasi volume besar termasuk pekerjaan pilot.

## Alur demo

Seed menyediakan invoice gabungan **Rp5.500.000**, pembayaran **Rp2.000.000**, saldo **Rp3.500.000**, serta satu draft reguler yang tertahan karena pekerjaan/bukti belum lengkap. Invoice seed diterbitkan sebagai **termin awal dengan kontrak disetujui**, bukan melalui dokumen fiktif. Tidak ada file atau status verified palsu saat R2 belum dikonfigurasi.

1. Operations membuat customer atau memilih yang aktif, lalu membuat job dan menetapkan petugas.
2. Field masuk dengan akun petugas tersebut, mulai pekerjaan, isi surat jalan digital dan catatan progres.
3. Unggah bukti sesuai checklist. Operations dapat reject dengan alasan; Field mengunggah versi perbaikan; Operations memverifikasi versi terbaru.
4. Field menyelesaikan job. Finance/Operations membuat komponen tarif dan mencatat persetujuan.
5. Finance menyiapkan draft, termasuk beberapa job customer yang sama. Mata uang, pajak dan termin harus sama.
6. Tunjukkan bahwa draft boleh dibuat awal; penerbitan ditolak jika tarif, status, atau bukti belum memenuhi syarat. Terbitkan setelah siap.
7. Catat pembayaran parsial dan alokasi. Direktur memeriksa piutang dan agregasi dashboard.

Aturan checklist dan kebijakan termin/pajak pada demo adalah asumsi MVP, bukan SOP resmi SGI. Lihat [keputusan implementasi](docs/decisions.md) dan [matriks penerimaan](docs/acceptance.md).

## Pemeriksaan

```powershell
npm run lint
npm run typecheck
npm run test:db
npm test
npx playwright install chromium
npm run test:e2e
npm run build
# Jalankan build lokal setelah menghentikan server development:
npm start
```

`TEST_DATABASE_URL` harus menunjuk ke database lokal dengan nama berakhiran `_test`; `npm run test:db` membuat database itu dan menerapkan migration. Integration test memakai PostgreSQL nyata dan mengganti **hanya transport eksternal R2** dengan fixture test; itu tidak digunakan oleh aplikasi. Unit test dapat dijalankan terpisah dengan `npm run test:unit`. E2E menggunakan akun seed dan aplikasi nyata, serta menambahkan data dengan nama/referensi test. Jalankan pada database demo, bukan data operasional asli. Screenshot dan trace tersimpan di `artifacts/screenshots` dan `test-results`.

**Verifikasi R2 nyata:** jalankan `npm run test:r2`. Skrip menolak berjalan bila konfigurasi belum lengkap dan memakai bucket asli saat tersedia. Browser E2E juga menguji form surat jalan, upload/revisi/review dan download nyata bila R2 dikonfigurasi. Skenario 503 tanpa konfigurasi hanya berjalan saat R2 kosong; skenario storage live hanya berjalan saat R2 tersedia. Hasil pemeriksaan dan keterbatasan terakhir dicatat di [verification.md](docs/verification.md).

## Struktur

`src/db/schema.ts` dan `drizzle/`: schema/migration versioned. `src/lib/`: auth, otorisasi, money/status, request limits, storage. `src/modules/`: validasi Zod, layanan transaksi, query scoped dan dokumen. `src/app/`: route handlers dan halaman terlindungi. `src/components/`: shell, Kumo forms, tabel, job workflow dan finance. `scripts/`: setup, migration, seed dan PostgreSQL development. `tests/`: unit, integration dan browser.

Migration tambahan melindungi invoice terbit, invoice items, corrections dan audit menggunakan trigger PostgreSQL. Jangan gunakan `drizzle-kit push` sebagai pengganti migration versioned: trigger dan constraint khusus berada pada file SQL custom. Lihat [diagram arsitektur dan workflow](docs/architecture.md).

## Batas prototype dan pekerjaan lanjutan

- Docker Compose sudah berjalan dengan PostgreSQL 17.11; migration, seed dan seluruh pengujian lokal tersedia telah lolos pada target Docker.
- Bucket R2 `sgi-one-demo` privat sudah aktif dan upload/download nyata telah lolos. Token backend kedaluwarsa **7 November 2026**; perbarui sebelum kedaluwarsa untuk menjaga fitur dokumen tetap berjalan.
- Legalitas bukti/tanda tangan, tarif pajak, termin, otorisasi koreksi, retensi dan format invoice resmi masih memerlukan SOP SGI. Pajak demo default 0; tidak ada perhitungan perpajakan hukum otomatis.
- Logo dan warna oranye telah diverifikasi dari situs resmi SGI; format dokumen dan SOP internal masih mengikuti asumsi prototype.
- Pemilih workspace hanya tersedia bagi akun yang benar-benar memegang beberapa role. Pemilih tidak mengubah role DB atau memberi izin baru; homepage dan Analitik mempersempit query ke role terpilih.
- Ekspor PDF menggunakan print-to-PDF browser, belum generator PDF otomatis atau tanda tangan kriptografis.
- Akuntansi penuh, payroll/HRIS, GPS, WMS, bank/customs API, multi-tenant dan biaya vendor/margin adalah P2 di luar scope prototype PRD.
- Backup terjadwal, restore drill, production monitoring, retention policy, pagination/query optimization untuk volume besar dan hardening deployment perlu sebelum pilot/production. Nominal individu dibatasi dan dihitung dengan integer; demo belum dirancang untuk agregasi melewati rentang safe integer JavaScript.

Berhentikan Next.js dengan Ctrl+C. `npm run db:down` menghentikan container tanpa menghapus volume. Cadangkan database sebelum tindakan terhadap volume; seed tidak menyediakan reset destruktif otomatis.

## Peta pekerjaan

Menu **Peta** (`/maps`) tersedia untuk Operations, Field, Finance dan Direktur sesuai izin job. Leaflet menampilkan tile OpenStreetMap, titik asal/tujuan, popup job dan garis penghubung. Pilih job untuk memfokuskan peta. Operations dapat menetapkan/mengubah empat koordinat melalui form Kumo; server memvalidasi batas latitude/longitude, mengunci job, menyimpan di PostgreSQL dan mencatat audit. Field hanya dapat membaca job yang masih ditugaskan kepadanya. Daftar tekstual koordinat tetap tersedia ketika jaringan tile gagal.

`npm run db:migrate` menambahkan `0004_grey_mach_iv.sql`. `npm run db:seed` menambahkan titik perkiraan kota pada empat job **simulasi** yang sudah dikenal, tanpa menimpa perubahan Operations. Data itu bukan lokasi GPS petugas atau alamat pelanggan nyata.

Peta memerlukan internet untuk tile. Default mengikuti [kebijakan tile OpenStreetMap](https://operations.osmfoundation.org/policies/tiles/): atribusi terlihat, caching browser normal, tanpa prefetch/download offline. `NEXT_PUBLIC_MAP_TILE_URL` dan `NEXT_PUBLIC_MAP_ATTRIBUTION` dapat diganti untuk penyedia tile lain. Job/customer/note tidak dikirim sebagai permintaan geocoding. Layanan map menerima permintaan tile viewport sebagaimana browser maps biasa. Tidak ada GPS live, perhitungan rute jalan/ETA, geocoding otomatis atau push notification dalam penambahan ini; GPS live tetap P2 menurut PRD.

Rincian penyesuaian referensi mobile: [catatan homepage](docs/mobile-homepage.md).
