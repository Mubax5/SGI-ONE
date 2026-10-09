# Keputusan implementasi

## Prioritas sumber

PRD.md menjadi sumber kebutuhan FR/BR/US. Pilihan Supabase Auth/Storage, shadcn/ui dan hosted deployment di PRD lama ditimpa oleh instruksi pengguna dan AGENTS.md: Better Auth, Kumo, PostgreSQL lokal, R2 privat, modular monolith lokal. PRD dan AGENTS dipertahankan sebagai dokumen sumber; diagram implementasi yang diperbarui ada pada architecture.md.

## Asumsi operasional MVP

| Topik                 | Keputusan                                                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Layanan               | Trucking, forwarding, warehousing; perlu validasi layanan nyata SGI                                                                                                |
| Checklist trucking    | Surat jalan bertanda tangan dan bukti serah terima                                                                                                                 |
| Checklist forwarding  | Surat jalan dan manifest muatan                                                                                                                                    |
| Checklist warehousing | Bukti penerimaan gudang dan bukti serah terima                                                                                                                     |
| Surat jalan digital   | Formulir append-only; dokumen cetak belum otomatis verified atau bukti legal                                                                                       |
| Review                | Operations; checklist keterbacaan, kesesuaian job, bukti penerima lengkap; keputusan disertai catatan                                                              |
| Versi                 | Upload jenis sama menambah versi; hanya versi terakhir memenuhi kesiapan billing; bukti lama tetap tersimpan                                                       |
| Status job            | Draft → assigned → in progress → completed; cancellation dari draft/assigned; job in-progress perlu penyelesaian/koreksi sesuai state PRD                          |
| Edit job              | Detail hanya saat draft; assignment dapat diperbarui sampai pekerjaan ditutup                                                                                      |
| Status invoice        | Draft/issued/void tersimpan; unpaid/partial/paid/overdue diturunkan dari saldo dan jatuh tempo                                                                     |
| Mata uang             | IDR, USD, SGD; seluruhnya 2 minor units; tidak ada konversi valuta atau penjumlahan lintas currency                                                                |
| Pajak                 | Exclusive; tarif basis points; total pajak dibulatkan half-up atas subtotal memakai BigInt; default demo 0                                                         |
| Termin                | Sama di seluruh komponen invoice; due date dihitung saat issue dalam jumlah hari 24 jam                                                                            |
| Tarif                 | Komponen dibuat belum approved; Operations/Finance merekam approval; hanya Finance menyetujui quotation                                                            |
| Termin awal           | Wajib quotation/kontrak approved, customer/currency/tax/terms cocok dan approval komponen; completion proof dikecualikan secara eksplisit                          |
| Saldo billable        | Draft bukan reservasi; issue menghitung alokasi invoice issued dalam row lock; void melepaskan alokasi                                                             |
| Credit note           | Mengurangi saldo piutang, tidak otomatis membuka ulang komponen untuk penagihan ulang                                                                              |
| Void                  | Hanya invoice tanpa pembayaran atau credit note; dokumen lama dan audit dipertahankan                                                                              |
| Overpayment           | Dapat dicatat sebagai unapplied credit, tetapi alokasi tidak boleh melebihi saldo payment/invoice                                                                  |
| Customer nonaktif     | Tidak bisa dipakai untuk job/draft/issue baru; pembayaran invoice lama tetap dapat dicatat                                                                         |
| Koreksi pembayaran    | Pembayaran/allocation tidak mempunyai edit/delete UI; reversal/refund memerlukan prosedur Finance tambahan di tahap lanjut                                         |
| Sales                 | Customer, request, quotation; tidak memperoleh jobs/documents/finance melalui role Sales saja                                                                      |
| Field                 | Scope assignment untuk job dan dokumen; mutasi progres/upload tetap membutuhkan assignment meski pengguna juga memegang role read lainnya                          |
| Director              | Read lintas fungsi dan dashboard; tidak memperoleh mutasi operasional/keuangan dari role Director saja                                                             |
| Finance read          | Invoice dan pembayaran hanya Finance/Direktur; Operations mengelola komponen tarif, tanpa membaca payment ledger atau dashboard finansial direktur                 |
| System admin          | User/role dan audit entitas user saja; tidak otomatis memperoleh akses finance/jobs/audit transaksi; akun demo admin secara eksplisit multi-role termasuk Director |
| Role cache            | Cookie auth tidak menyimpan role; DB role dan status aktif dibaca setiap request                                                                                   |
| Dashboard             | Agregasi finance dalam repeatable-read snapshot; laporan periode berbeda dari saldo saat ini dan ditandai di UI                                                    |
| File download         | Proxy backend berizin per request, tidak mengekspos object key/signed URL; cache no-store dan attachment                                                           |
| Akun                  | Provisioning admin; no public signup/password reset otomatis tanpa layanan email                                                                                   |
| Secret                | Backend environment; setup mengacak secret auth, tidak menimpa .env yang sudah ada                                                                                 |
| Local port            | Next 4310 dan PostgreSQL 54329, loopback saja                                                                                                                      |

Pembatasan RBAC berada di layanan/API dan SSR; menu hanya memudahkan navigasi. Audit tidak menyimpan password, token, atau isi file. Koreksi dan detail invoice terbit dilindungi trigger database; aplikasi tidak menggunakan delete untuk customer yang telah ditransaksikan.

## Konfigurasi dan sumber resmi

Skill Kumo resmi sudah terpasang pada `.agents/skills/kumo-design/SKILL.md` (tercatat dalam skills-lock.json). Dokumentasi CLI Button/Input/Select/Dialog/Table/Badge/Checkbox/InputArea diperiksa sebelum implementasi. Komponen menggunakan mode terang dan token semantic; satu theme override memetakan identitas SGI.

- [Kumo installation](https://kumo-ui.com/installation/)
- [Kumo semantic colors](https://kumo-ui.com/colors/)
- [Better Auth Next.js](https://better-auth.com/docs/integrations/next)
- [Better Auth Drizzle adapter](https://better-auth.com/docs/adapters/drizzle)
- [R2 AWS SDK v3](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/)

Fallback PostgreSQL merupakan alat development, bukan penggantian arsitektur target Docker. Tidak ada alternatif storage lokal atau mock transport yang dipasang pada aplikasi untuk menghindari requirement R2.

## Workspace role, laporan dan pencarian

- Dashboard bukan lagi eksklusif Direktur. Enam dashboard mempunyai payload dan struktur tugas berbeda; agregat finance lama tetap hanya Direktur. Default akun multi-role mengikuti urutan Admin, Direktur, Operations, Finance, Sales, Field. Pemilih hanya memilih role yang sudah tercatat di DB.
- Ikon fitur mobile dan navigasi mengikuti seluruh permission akun; pemilih workspace mengubah dashboard dan aksi utama, tidak memberi atau mencabut role akun. Akun tunggal digunakan untuk uji keenam workspace.
- Aksi tengah: Operations/Field membuat laporan; Finance membuat draft invoice; Sales mencatat permintaan; Admin menambah pengguna; Direktur menuju bagian laporan penagihan.
- Laporan catatan/foto adalah tambahan aktivitas job yang diminta pengguna. Catatan minimum 5 karakter, maksimum 2000; foto opsional maksimum 10 MB JPG/PNG/WebP dengan signature/file-name validation. Job completed/cancelled menolak laporan baru. Tidak ada status verified otomatis atau edit/hapus laporan pada MVP.
- Tidak ada GPS/EXIF wajib. Kamera memakai capture environment pada file input dan bergantung browser/perangkat; upload/pratinjau telah diuji, kamera perangkat fisik belum diuji.
- Search berupa pencarian substring case-insensitive atas data berizin, minimal 2 dan maksimum 100 karakter. Maksimum 6 hasil per jenis dan 40 total. Index full-text dan pagination pencarian lintas resource belum dibutuhkan untuk volume demo.
- Kumo Button primary dipertahankan dengan ring dan lapisan bawaan; satu theme SGI mengubah brand orange. Panel mobile menggunakan ink solid. Referensi gambar pengguna dipakai untuk posisi navbar dan menu fitur, bukan isi perbankan.

## Homepage and map extension (latest user correction)

The latest supplied Klarna image supersedes the earlier mobile dashboard hero. `/home` is the landing page. Following the user correction, the reference applies only to phones below 640 px; tablet/desktop retain the existing enterprise sidebar, header and role dashboard tables. `/dashboard` renders the same responsive landing rather than redirecting. `/analytics` retains the six genuinely scoped detailed workspaces and adds the official Kumo Chart. A solid warm SGI top replaces the reference gradient; device/retail content is not copied. The previously requested five-position floating role-action navigation remains.

Favorites and banner dismissal are per-device preferences, namespaced by user and role. They never authorize backend reads. Status shortcuts use the actual status filter rather than a text search; invoices distinguish issued records from positive outstanding balances. Existing module filters remain changeable.

The user requested maps explicitly despite continuous GPS being P2 in PRD. The narrow extension stores origin/destination coordinates, permits Operations to update them transactionally with audit, and applies job scope on map reads. It uses Leaflet/OSM, visible attribution, normal cache behavior and no prefetch. Tile image requests send only the app origin via strict-origin-when-cross-origin, fulfilling OSM policy without transmitting job paths/IDs. Continuous GPS, routing/ETA, automatic geocoding and push notifications are not part of this extension.
