# Arsitektur dan aturan workflow SGI One

```mermaid
flowchart TB
  Browser[Browser desktop / mobile] --> Next[Next.js lokal :4310]
  Next --> Auth[Better Auth / session PostgreSQL]
  Next --> Routes[SSR + Route handlers]
  Routes --> Guard[Role DB terbaru + assignment + same-origin + Zod]
  Guard --> Modules[Customers / jobs / documents / billing / payments / reports]
  Modules --> PG[(PostgreSQL lokal :54329 / Drizzle)]
  Modules --> R2[(Cloudflare R2 private bucket)]
  Modules --> Audit[Append-only audit]
  Audit --> PG
  PG --> Locks[Row locks + transactions + immutable-record triggers]
```

```mermaid
flowchart TD
  Customer[Customer aktif] --> Request[Permintaan order]
  Request --> Job[Job draft / PIC / rute / layanan]
  Job --> Assign[Assignment petugas aktif]
  Assign --> Running[Petugas mulai dan catat progres]
  Running --> Delivery[Surat jalan digital]
  Delivery --> Upload[Upload bukti privat / versi baru]
  Upload --> Review{Operations review}
  Review -->|reject + alasan| Upload
  Review -->|verify + checklist| Complete[Job selesai + bukti wajib verified]
  Job --> Billable[Komponen tarif + approval]
  Billable --> Draft[Invoice draft: satu customer / terms cocok]
  Complete --> Issue{Issue dalam transaksi}
  Draft --> Issue
  Contract[Kontrak approved + approval termin awal] -->|pengecualian eksplisit completion| Issue
  Issue -->|validasi gagal / saldo tidak cukup| Draft
  Issue -->|lock sukses| Invoice[Invoice final / snapshot customer]
  Invoice --> Payment[Payment + alokasi atomik]
  Payment --> AR[Outstanding / overdue / unapplied credit]
  AR --> Dashboard[Dashboard repeatable-read / per currency]
  Invoice --> Correction[Void tanpa payment atau credit note terbatas saldo]
  Correction --> AR
```

```mermaid
stateDiagram-v2
  state Job {
    [*] --> draft
    draft --> assigned: assignment minimal satu petugas
    assigned --> in_progress
    in_progress --> completed
    draft --> cancelled
    assigned --> cancelled: koreksi invoice terkait dahulu
  }
  state Dokumen {
    [*] --> submitted: upload sukses R2 + metadata DB
    submitted --> verified: checklist Operations
    submitted --> rejected: alasan wajib
    rejected --> submitted: versi baru / versi lama retained
  }
  state Invoice {
    [*] --> invoice_draft
    invoice_draft --> issued: approval / evidence / terms / saldo + row locks
    issued --> void: correction tanpa allocation/payment
  }
```

Paid, partially paid dan overdue merupakan proyeksi, bukan status manual. `outstanding = total issued - allocation - corrections`. `unapplied = payment - sum allocation`. Invoice draft/void tidak masuk penagihan issued. Credit notes tidak menghapus invoice atau payment.

```mermaid
erDiagram
  USERS ||--o{ SESSIONS : authenticates
  USERS ||--o{ ACCOUNTS : credentials
  USERS ||--o{ USER_ROLES : holds
  ROLES ||--o{ USER_ROLES : grants
  USERS ||--o{ AUDIT_LOGS : acts
  USERS ||--o{ ATTENDANCE : records
  CUSTOMERS ||--o{ ORDER_REQUESTS : requests
  CUSTOMERS ||--o{ QUOTATIONS : negotiates
  QUOTATIONS ||--o{ BILLABLE_ITEMS : supports
  CUSTOMERS ||--o{ JOBS : owns
  ORDER_REQUESTS ||--o{ JOBS : originates
  JOBS ||--o{ JOB_ASSIGNMENTS : assigns
  USERS ||--o{ JOB_ASSIGNMENTS : receives
  JOBS ||--o{ JOB_PROGRESS : records
  JOBS ||--o{ WORK_REPORTS : reports
  JOB_PROGRESS ||--o| WORK_REPORTS : links
  USERS ||--o{ WORK_REPORTS : submits
  JOBS ||--o{ DELIVERY_NOTES : generates
  JOBS ||--o{ DOCUMENTS : evidences
  JOBS ||--o{ BILLABLE_ITEMS : produces
  CUSTOMERS ||--o{ INVOICES : billed
  INVOICES ||--o{ INVOICE_ITEMS : contains
  BILLABLE_ITEMS ||--o{ INVOICE_ITEMS : allocates
  CUSTOMERS ||--o{ PAYMENTS : pays
  PAYMENTS ||--o{ PAYMENT_ALLOCATIONS : distributes
  INVOICES ||--o{ PAYMENT_ALLOCATIONS : receives
  INVOICES ||--o{ INVOICE_CORRECTIONS : corrects
```

Profile PRD digabung ke `users` Better Auth; `verification` dan `auth_rate_limits` melengkapi schema autentikasi. Uang memakai bigint minor units mode number dengan batas input, perhitungan subtotal/pajak memakai BigInt. Tanggal tersimpan timestamptz; tampilan Asia/Jakarta. Sequence PostgreSQL menjaga nomor unik; rollback boleh menghasilkan gap nomor.

`work_reports` menghubungkan catatan lapangan ke satu `job_progress`; foto opsional disimpan privat di R2. Constraint memastikan metadata foto lengkap atau seluruhnya null. Upload divalidasi lebih dulu, lalu job dikunci dan assignment/status diperiksa ulang sebelum progress, laporan dan audit di-commit. Jika transaksi gagal, object R2 dibersihkan. Pembukaan foto memeriksa assignment kembali dan tidak menggunakan cache publik. Foto laporan bukan dokumen checklist verified.

Dashboard memilih hanya role yang sudah dimiliki pengguna, lalu mempersempit actor ke role itu untuk query. Dashboard direktur memakai snapshot finansial; dashboard petugas hanya assignment dan aktivitas pribadi. Pencarian global memeriksa permission sebelum memanggil query scoped setiap jenis data; URL role tidak bisa menambah izin. Pencarian mengembalikan label, konteks singkat dan route, tanpa object key atau kredensial.

Penerbitan mengunci invoice lalu jobs/billables dalam urutan ID konsisten dan customer, menghitung ulang alokasi issued, memeriksa bukti versi terbaru, menyimpan snapshot dan audit dalam satu commit. Payment allocation mengunci payment (untuk alokasi susulan), lalu invoice dalam urutan ID. Concurrent requests tidak bergantung pada nilai saldo dari browser.
