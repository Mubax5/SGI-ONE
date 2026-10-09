# Hasil verifikasi implementasi

Tanggal pemeriksaan: **9 Oktober 2026**, Asia/Jakarta.

| Pemeriksaan                              | Hasil                                                                                                                                                                   |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PostgreSQL lokal                         | Docker Compose, PostgreSQL 17.11, container healthy, loopback 54329                                                                                                     |
| Migration versioned                      | Lolos; schema awal, integrity guards, work_reports (0002) dan constraint metadata foto (0003), serta job_locations (0004) diterapkan                                    |
| Seed                                     | Idempotent; akun dan transaksi demo tetap dipertahankan                                                                                                                 |
| Lint                                     | Lolos tanpa error/warning setelah perubahan akhir                                                                                                                       |
| Typecheck                                | Lolos TypeScript strict; pemeriksaan terpisah dan pemeriksaan build                                                                                                     |
| Unit + integration                       | **54 lolos** pada 5 file, PostgreSQL test terisolasi; termasuk concurrent issue/payment dan failure handling storage                                                    |
| Browser full suite sebelum revisi filter | **10 lolos, 1 skip bersyarat** dari 11 skenario, **3,4 menit**, pada build produksi                                                                                     |
| Pengujian browser pembaruan mobile       | Cakupan 13 lolos / 1 skip dari 14 skenario setelah retest; detail run dan assertion terdapat di bagian berikut                                                          |
| Production build                         | Lolos Next.js optimized build; runtime akhir menggunakan `npm start`, loopback 4310                                                                                     |
| R2 nyata                                 | Browser membuktikan surat jalan, PDF, upload/reject/revisi/verify/download byte-exact dan penolakan field tanpa assignment; acceptance finance R2 sebelumnya juga lolos |

Skip hanya skenario R2 tanpa konfigurasi karena bucket privat nyata telah aktif. Pengujian failure handling 503 tetap tercakup pada unit/integration dan pemeriksaan terdahulu. Tidak ada mock storage dalam runtime aplikasi.

## Homepage, Analitik dan peta — pemeriksaan terbaru

- Migration 0004 dan seed lokasi demonstrasi telah dijalankan pada PostgreSQL Docker. Seed tidak mengganti koordinat yang sudah ditetapkan Operations.
- **54 pengujian unit/integration lolos** pada lima file. Dua pengujian baru membuktikan penyimpanan/audit lokasi, assignment scope, penolakan Field/Admin, serta input koordinat invalid tanpa merusak nilai tersimpan.
- **Full suite browser: 14 lolos, 1 skip, 5,9 menit**. Skip khusus keadaan R2 tidak dikonfigurasi; R2 nyata aktif. Run ini meliputi workflow finance dan R2, enam homepage role pada 320/390/768/1440 px, seluruh modul, pencarian, central action yang dapat dibuka kembali, favorit setelah reload, dismissal/restoration perhatian, filter status yang benar, chart canvas Kumo, dan koordinat melalui form/backend nyata.
- Setelah penyesuaian referrer tile dan focus outline, lint, typecheck dan optimized build diulang dan lolos. Skenario homepage/favorit/filter/chart/map lolos pada pengulangan pertama. Setelah penyempurnaan enam kolom menu dan Badge jumlah, pengujian enam role serta kontrol homepage diulang: **2 lolos**. Perubahan terakhir hanya memendekkan label shortcut menjadi “Job”; optimized build lolos dan tampilan 390 px diperiksa lagi melalui Computer Use.
- Computer Use membuktikan basemap OpenStreetMap kini tampil normal, lengkap titik job, garis penghubung dan atribusi. Screenshot: `artifacts/screenshots/sgi-map-reviewed.png` dan `artifacts/screenshots/sgi-homepage-reviewed.png`.
- Suite browser sengaja memblokir request tile OSM agar tidak mengunduh peta secara otomatis. Tile internet diperiksa melalui Computer Use pada viewport mobile; temuan referrer yang hilang diperbaiki dengan policy khusus image tile. Kebijakan same-origin aplikasi untuk request lain tetap dipertahankan.
- Homepage tidak merender sidebar pada ukuran apa pun; modul mobile juga tidak merender sidebar. Detail workspace lama dipindahkan ke Analitik. Grafik berasal dari data yang sama dengan tabel.
- Referensi mobile memakai layout gambar pengguna dengan SGI palette, data logistik asli, serta navbar floating yang diminta sebelumnya. Ini bukan klaim pixel-identik dengan Klarna. Lihat [ukurannya dan adaptasi](mobile-homepage.md).

## Riwayat verifikasi pembaruan mobile dan workspace

Build akhir, lint, typecheck, migration serta **52 unit/integration test** lolos. Suite browser 14 skenario berjalan: 11 lolos, 1 skip bersyarat dan 2 kegagalan assertion lama (landing Field berubah ke Dashboard; pemilihan gambar terlalu luas). Assertion diperbarui dan ketiga skenario terkait dijalankan ulang: Field scope **1 lolos**, workspace/foto **2 lolos** pada build akhir. Cakupan akhir **13 skenario lolos, 1 skip**; bukan klaim satu full run terakhir seluruhnya hijau.

- Enam payload/struktur dashboard berbeda diperiksa pada 320, 390, 768 dan desktop 1440 px. Dashboard selain Direktur tidak memperoleh agregat currencies/receipts; workspace Field multi-role tetap mempersempit query ke assignment.
- Navbar floating berjarak dari tepi/safe area. Tombol tengah terangkat, berlabel dan menggunakan LinkButton circle primary Kumo. Form per role dibuka, ditutup dengan Escape dan dibuka kembali; tidak berhenti berfungsi saat URL create masih sama.
- Global search membuka job nyata melalui hasil pencarian. Backend menolak resource/role yang tidak berizin dan menjaga assignment; billing juga dapat dicari. Fitur selalu bisa dicari dari Ctrl/Cmd+K atau tombol Cari.
- Form laporan mengunggah PNG nyata ke R2, menampilkan pratinjau, menyimpan laporan/progres, membuka foto dan membandingkan byte download dengan upload. Field2 tanpa assignment mendapat 404 untuk foto serta hasil search kosong; mencoba dashboard Finance mendapat 403.
- Unit/integration memeriksa signature JPEG/PNG/WebP, RIFF non-WebP, file kosong/spoofed, metadata, audit, R2 failure, job ditutup, unauthorized read/write dan finance concurrency. Runtime aplikasi tidak memakai mock storage.
- Computer Use memeriksa navbar 320 px, command palette berisi job nyata, pemilih workspace dan form laporan Kumo. Screenshot role lengkap tersedia di artifacts/screenshots/role-_-mobile.png dan role-_-desktop.png, serta mobile-report-photo.png. Bukti Computer Use akhir: sgi-floating-mobile-reviewed.png.
- Keyboard Escape/focus, semantic labels dan reflow diperiksa. Kamera perangkat fisik, screen reader manual, RTL dan zoom browser 200% **belum diverifikasi**; upload file dan capture attribute tersedia. Tidak mengklaim audit WCAG penuh.

## Cakupan UI

Seluruh 13 modul diperiksa pada desktop 1440×1000 serta mobile **320, 390, dan 768 piksel**. Pengujian memeriksa overflow halaman, container tabel, isi sel, aksi, dan dialog; seluruh nilai dan aksi tetap tersedia tanpa scroll ke samping. Satu DOM tabel diubah menjadi baris berlabel pada layar kecil.

Detail invoice, pembayaran, audit, form customer, empat tab detail job dan halaman cetak invoice ikut diperiksa. Render cetak mobile tanpa JavaScript juga lolos; CSS menyembunyikan sidebar desktop sejak HTML awal, sebelum media query Kumo selesai hydration. Surat jalan cetak pada viewport mobile diperiksa dalam skenario R2 nyata sebelum menghasilkan PDF. Menu mobile diuji untuk ukuran tombol seragam, 13 ikon berbeda, navigasi route, Escape dan pemulihan fokus. Akun Sales mendapat Dashboard, Customer, Permintaan, Penawaran dan Absensi; navbar tengah membuka form Order. Menu finance tetap tidak tersedia.

Sidebar dan seluruh menu memakai komponen Kumo dengan ikon Phosphor berbeda. Pengujian tambahan mencakup lebar 260/57px, header 58px, collapsible, Ctrl/Cmd+K, Enter, tab route, drawer mobile, fokus, serta scope field. Login sederhana diuji bersama warna tombol resmi #FF4D0A dan teks ink yang terbaca.

Bukti setiap modul: `artifacts/screenshots/ui-*-desktop.png` dan `ui-*-mobile.png`. Bukti Computer Use hasil akhir: `sgi-ui-reviewed-desktop.png`, `sgi-ui-reviewed-mobile.png`, `sgi-ui-reviewed-mobile-menu.png`, `sgi-calendar-reviewed-desktop.png`, `sgi-calendar-reviewed-mobile.png`, `sgi-auth-final.png`, `sgi-collection-reviewed-desktop.png`, dan `sgi-collection-reviewed-mobile.png`. Referensi Cloudflare dan sumber warna resmi terdapat di [design-reference.md](design-reference.md). Pemeriksaan ini tidak mengklaim kecocokan piksel 100% seluruh produk Cloudflare.

## Workflow dan integritas

Login/logout, signup publik ditutup, CSRF/session, customer/job/assignment melalui form, scope field, penolakan job orang lain dan finance, semua modul admin, role berlaku pada request berikutnya, dan deaktivasi mencabut session telah diuji.

Finance melalui form membuktikan approval, draft gabungan, penerbitan, pembayaran parsial, credit note, audit dan PDF. PostgreSQL transactions/locking serta trigger immutable tetap diuji. Transport eksternal R2 diganti hanya di integration test untuk skenario gagal; database dan layanan domain tetap nyata.

E2E menambah nama dan transaksi test pada database demo. Transaksi finance test ditutup dengan credit note setelah membuktikan saldo parsial. Audit dan dokumen dipertahankan. Saldo seed INV-2026-00001 tetap Rp3,5 juta; total job/invoice/penerimaan periode dapat bertambah akibat pengujian. Tidak ada data operasional asli.

## Pemeliharaan dan batas prototype

R2 `sgi-one-demo` tetap privat. Token backend mempunyai Object Read & Write hanya untuk bucket tersebut sampai **7 November 2026**. Kredensial hanya ada di `.env`; perbarui sebelum kedaluwarsa dan restart aplikasi.

SOP checklist, bukti sah, tarif pajak, termin, koreksi, format dokumen, backup/restore, retensi dan monitoring masih perlu validasi SGI sebelum pilot. P2 tetap di luar prototype, sebagaimana README/PRD. Bukan klaim production-ready.

Fallback PostgreSQL development tetap tersimpan untuk mesin tanpa Docker dan tidak sedang dijalankan. Database Docker dan test memakai cluster terpisah; tidak ada penyalinan folder cluster antarversi.

Helper login E2E menunggu loader data selesai sebelum mengirim pintasan keyboard. Ini memperbaiki kegagalan timing ketika URL/server HTML sudah tampil tetapi listener React belum terpasang; skenario navigasi kemudian lolos kembali.

## Pemeriksaan tambahan filter periode (FR-12)

DatePicker range, Popover, Input, Banner dan Button Kumo membentuk filter periode laporan. Browser membuktikan klik kalender mengisi tanggal, preset 7/30 hari dan bulan ini, rentang terbalik tidak mengirim request, server menolak 31 Februari, periode Januari mengembalikan agregasi nyata sesuai sumber, dan CSV memakai periode yang sama. Kalender serta tombol akhir muat pada 320/390/768px; Escape/Batal mengembalikan fokus.

Empat unit test tambahan memeriksa batas pergantian tanggal/tahun WIB, midnight WIB tanpa bergantung zona waktu mesin, leap day, penolakan tanggal yang dinormalisasi JavaScript, serta jumlah hari preset lintas bulan. Default periode backend dan UI kini konsisten dalam WIB.

Pemeriksaan visual menemukan popup mobile melebihi tinggi tersedia. Popup sekarang memakai batas `--available-height`, isi dengan scroll vertikal dan footer aksi yang tetap terlihat. Pemeriksaan browser menguji batas bawah popup dan kedua tombol terhadap tinggi viewport.

Harness login browser menunggu response aktual dan menghormati `Retry-After` ketika menerima 429. Rate limit autentikasi tetap aktif. Hasil akhir empat skenario di atas lolos sesudah perbaikan; kegagalan sementara beserta penyebabnya diperiksa sebelum pengulangan.

## Penyesuaian hierarki heading dari pemeriksaan tambahan

Inspeksi Computer Use D1, KV, Queues, Durable Objects, Containers dan Analytics Engine membuktikan heading halaman standar 20px/600/25px. Halaman laporan R2 Metrics menggunakan 30px/600/36px, sedangkan Browser Run overview mempunyai variasi 24px/600/32px. PageHeader SGI sekarang memakai template standar untuk daftar/detail dan template laporan untuk dashboard. Heading laporan mobile 24px/600/32px; heading daftar/detail tetap 20px/600/25px.

Lint, TypeScript strict dan build produksi lolos kembali setelah perubahan. Empat skenario browser di tabel atas dijalankan ulang pada build tersebut dan lolos dalam 2,8 menit. Skenario responsif memeriksa computed font size, line height dan weight untuk seluruh 12 halaman desktop, serta ukuran heading dan overflow pada 320/390/768px. Screenshot daftar Customer desktop/mobile berasal dari Computer Use setelah build terakhir; filter Maju Jaya memperlihatkan seed realistis dan tombol Ubah yang nyata.

Tidak ada perubahan database atau aturan domain pada penyesuaian ini; hasil 47 pengujian unit/integrasi di atas berasal dari pemeriksaan sebelumnya pada implementasi domain yang sama. Referensi kini mencakup 19 tampilan Cloudflare. Inventaris 83 route menu bukan bukti seluruh halaman telah diperiksa; Members tetap tertahan oleh pemeriksaan izin otomatis. Landing layanan belum aktif atau membutuhkan plan berbayar tidak dinyatakan mewakili keadaan operasional setelah aktivasi.
