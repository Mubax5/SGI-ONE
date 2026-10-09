# Referensi layout dan identitas SGI

Pemeriksaan langsung lewat Computer Use mencakup 19 tampilan Cloudflare: Account home, Domains overview, R2 overview, bucket Objects, bucket Settings, Workers & Pages, Workflows, Create a bucket, R2 Metrics, R2 Data migration, D1 Database, Workers KV, dialog Create a KV namespace, Queues, Create Queue, Durable Objects, Containers, Browser Run overview, dan Analytics Engine. Quick search serta dropdown akun juga diperiksa. Struktur DOM, ukuran, computed styles, dan screenshot menjadi referensi shell, daftar data, panel samping, tab, serta halaman detail. Implementasi menggunakan skill resmi `kumo-design` dan dokumentasi/source komponen Kumo 2.14 yang terpasang.

| Bagian          | Implementasi                                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Sidebar desktop | Sidebar Kumo lengkap, menu/submenu/collapsible, lebar 260px dan ringkas 57px, setiap halaman mempunyai ikon Phosphor berbeda               |
| Header          | 58px, Breadcrumbs Kumo, DropdownMenu akun, pemisah sticky                                                                                  |
| Bar bagian      | 58px, Tabs Kumo berikon, navigasi ke halaman nyata                                                                                         |
| Heading         | Daftar/detail 20px/600/25px; laporan desktop 30px/600/36px dan mobile 24px/600/32px, menurut template yang diperiksa                       |
| Konten          | Maksimum isi 1320px; padding desktop 32px; Inter Variable lokal                                                                            |
| Daftar          | LayerCard Secondary sebagai judul, Primary sebagai isi, filter, Table dan Pagination Kumo                                                  |
| Dashboard       | Penagihan per mata uang, prioritas pekerjaan dengan paginasi, panel tindak lanjut, piutang pelanggan                                       |
| Detail          | Panel terpisah untuk identitas, item, nominal, alokasi pembayaran, koreksi, dan audit                                                      |
| Form            | Input, InputArea, Select, Checkbox Kumo; fieldset per kelompok kebutuhan                                                                   |
| Mobile          | Navbar bawah tetap, tiga menu utama sesuai izin dan dialog seluruh menu; drawer tambahan tetap tersedia                                    |
| Tabel mobile    | Satu DOM tabel berubah menjadi baris data berlabel. Seluruh nilai dan aksi dipertahankan, tanpa scroll ke samping, termasuk tampilan cetak |
| Auth            | Logo SGI resmi, satu panel masuk, dua field dan satu aksi utama                                                                            |
| Status          | Badge semantik dengan teks, Banner untuk error/validasi, Empty dan Loader Kumo                                                             |
| Keyboard        | Ctrl/Cmd+K melalui CommandPalette, Escape dan pemulihan fokus dialog                                                                       |

## Pemetaan pemeriksaan tambahan

| Referensi Cloudflare  | Temuan yang diperiksa                                                                                                        | Penerapan SGI                                                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Workers & Pages       | Daftar aplikasi nyata, search, filter, sort, refresh, pagination, panel usage di kanan                                       | Daftar modul dengan filter relevan; dashboard memakai daftar prioritas dan panel tindak lanjut                                        |
| Workflows             | Heading 20px/600/25px, search, refresh, empty state dengan instruksi, panel usage dan retention                              | Empty state memberi tindakan berikutnya; bagian laporan dipisahkan melalui LayerCard                                                  |
| Create a bucket       | Heading 20px/600/25px, form dengan pemisah kelompok, deskripsi field, radio, Cancel/Create                                   | Form dikelompokkan menurut data utama, rute dan nilai; validasi serta tindakan akhir menggunakan Kumo                                 |
| R2 Metrics            | Heading 30px/600/36px, pilihan bucket, tab, time-range popover, kalender, tanggal dan Apply                                  | Heading laporan desktop SGI 30px/36px; DatePicker range + Popover Kumo, Input tanggal, preset 7/30 hari dan bulan ini, Terapkan/Batal |
| R2 Data migration     | Heading 30px/600/36px, dokumentasi/tindakan di kanan, empty state dengan tindakan                                            | Hierarki page header, tindakan dan konten dipisah; empty state mengikuti kebutuhan workflow                                           |
| Quick search          | Dialog 672px dengan input, grouped results, petunjuk keyboard, Escape                                                        | CommandPalette Kumo dengan menu sesuai izin, keyboard dan pemulihan fokus                                                             |
| User menu             | Dropdown bersekat dan informasi akun                                                                                         | DropdownMenu Kumo berisi identitas, role, absensi dan logout nyata                                                                    |
| D1 Database           | Heading 20px/600/25px; search, refresh, empty state, pagination; panel Usage limits dengan Daily/This month                  | Heading daftar SGI 20px/25px; filter, empty state dan pagination Kumo                                                                 |
| Workers KV            | Heading 20px; search/refresh, empty state dan panel Usage                                                                    | Hierarki daftar dan panel tindak lanjut                                                                                               |
| Create a KV namespace | Dialog 560px; satu input, kelompok radio lokasi, Cancel/Create; Create disabled sebelum data diisi. Heading 15px/500/18.75px | Dialog SGI tetap controlled; field, validasi, aksi dan fokus mengikuti Kumo. Ukuran heading SGI mengikuti aturan AGENTS 600           |
| Queues                | Heading 20px/600/25px; search, tindakan Create Queue/Subscribe to events, empty state dan Usage                              | Ukuran heading daftar, toolbar dan aksi                                                                                               |
| Create Queue          | Heading 20px/600/25px; Name, Jurisdiction, Cancel/Create; Create disabled ketika kosong                                      | Ukuran heading dan struktur form ringkas                                                                                              |
| Durable Objects       | Heading 20px/600/25px; search, filter, refresh; empty state; panel Usage/Examples                                            | Filter relevan dan empty state yang memberi tindakan berikutnya                                                                       |
| Containers            | Heading 20px/600/25px; landing Enable Containers dengan Purchase Workers Paid                                                | Hanya landing diperiksa; tidak membeli plan dan tidak mengklaim memeriksa keadaan setelah aktivasi                                    |
| Browser Run overview  | Heading 24px/600/32px; tabs Overview/Runs/Live Sessions/Playground; metrik dan periode                                       | Mencatat variasi heading Cloudflare; tabs dan filter laporan SGI memakai Kumo                                                         |
| Analytics Engine      | Heading 20px/600/25px; Enable, search/refresh disabled, empty setup dan panel What's new                                     | Hanya keadaan belum aktif diperiksa; tidak mengaktifkan layanan                                                                       |

Form Cloudflare hanya diperiksa; tidak ada nama bucket/namespace/queue diisi, sumber daya dibuat, layanan diaktifkan, plan dibeli, migrasi dimulai, atau pengaturan akun diubah. Metrics dan dropdown dibuka untuk memeriksa struktur kontrol. Sidebar search SGI mempertahankan outline bawaan Kumo.

Filter laporan menggunakan tanggal kalender WIB (UTC+7), sama pada UI dan backend. Rentang baru baru dimuat setelah Terapkan; rentang terbalik dan tanggal yang tidak ada ditolak. Export memakai periode dari hasil server. Popup dibatasi oleh tinggi yang tersedia; isi dapat digulir vertikal dan tombol akhir tetap terlihat pada mobile.

## Identitas resmi

Oranye diverifikasi dari stylesheet situs SGI: [style.css](https://sandikaglobalindonesia.com/css/style.css?v=1.2), `--primary-orange: #FF4D0A` dan `--secondary-orange: #FF8A1F`. Logo berasal dari [aset resmi SGI](https://sandikaglobalindonesia.com/assets/img/logo.png), disimpan sebagai `public/sgi-logo.png` dengan rasio aslinya.

Tema SGI dipetakan sekali pada semantic tokens Kumo dalam `globals.css`. Tombol utama memakai oranye solid #FF4D0A dan teks ink agar terbaca; tidak memakai gradient bawaan. Ukuran teks data dan kontrol 14px mengikuti skill. Nama, data, status dan aksi mengikuti workflow SGI.

## Bukti dan batas cakupan

Inventaris sidebar berisi **83 route menu unik** dalam [cloudflare-menu-inventory.json](../artifacts/cloudflare-menu-inventory.json); account ID dihilangkan. Inventaris ini mencatat tautan yang ada pada DOM navigasi, termasuk kelompok tertutup, dan bukan bukti bahwa 83 halaman telah dibuka. Halaman detail, tab, dialog dan keadaan setelah aktivasi menambah cakupan di luar route menu.

Referensi visual tambahan: `cloudflare-d1-reference.png`, `cloudflare-kv-reference.png`, `cloudflare-kv-dialog-reference.png`, `cloudflare-queues-reference.png`, `cloudflare-create-queue-reference.png`, `cloudflare-durable-objects-reference.png`, `cloudflare-containers-reference.png`, `cloudflare-browser-run-reference.png`, dan `cloudflare-analytics-engine-reference.png`.

Referensi visual: `cloudflare-account-home.jpg`, `cloudflare-domains.jpg`, `cloudflare-layout-reference.jpg`, `cloudflare-workers-reference.png`, `cloudflare-workflows-reference.png`, `cloudflare-create-bucket-reference.png`, `cloudflare-r2-metrics-reference.png`, `cloudflare-r2-migration-reference.png`, `cloudflare-search-reference.png`, dan `sgi-brand-reference.jpg` dalam `artifacts/screenshots`. Hasil setiap modul desktop/mobile disimpan sebagai `ui-*.png`; screenshot Computer Use aplikasi disimpan terpisah.

Halaman Cloudflare Members tidak dibuka: pemeriksaan izin otomatis menolak pembacaan data anggota dan hak akses akun. Tidak ada pengambilan data lewat jalur lain. Pola administrasi SGI memakai komponen Kumo dan pola daftar/detail yang telah diperiksa. Permintaan inspeksi seluruh halaman Cloudflare dan kesamaan 100% belum terpenuhi. Cakupan ini tidak merupakan klaim inspeksi setiap produk/halaman Cloudflare atau perbandingan piksel seluruh dashboard. Cloudflare sendiri menampilkan beberapa template dan ukuran heading antarproduk; perbedaan itu dicatat di atas, bukan dinyatakan sudah identik. Identitas SGI dan navbar bawah mobile merupakan penyesuaian yang diminta pengguna.
