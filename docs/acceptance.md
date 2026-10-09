# Pemetaan penerimaan PRD

| Requirement | Implementasi | Bukti pemeriksaan |
| --- | --- | --- |
| FR-01 / US-01 | Better Auth, session database, logout, public signup tertutup | Browser auth dan unauthenticated API |
| FR-02 / US-03 / US-10 / BR-12 | Server role/active profile, assignment scope, next-request refresh | Integration negatif + browser role revoke |
| FR-03 | Create/update/search/deactivate customer, FK job tetap | Browser form + integration soft deactivate |
| FR-04 | Job number sequence, PIC, due/source/route/service, state transition, audit | Browser create + integration transition |
| FR-05 | Multi-assignment, active field validation, progres/note | Browser assignment + unauthorized update test |
| FR-06 / US-02 / BR-11 | R2 backend private transfer, metadata/version, surat jalan, download recheck | Unit/integration + R2 live byte-exact download + mobile upload/download form; unassigned download 404 |
| FR-07 / US-04 / BR-04 | Operations review, checklist/reason, latest-version readiness, retain old revision | Integration + R2 nyata dan browser reject/resubmit/verify; versi lama tetap rejected |
| FR-08 | Tariff basis, amount/currency/tax/terms, explicit approval, balance | Integration approved/unapproved/ready billables |
| FR-09 / US-05 / BR-01 / BR-02 | Early draft, multi-job, compatible customer/currency/tax/terms | Integration combined/cross-customer/terms rejection |
| FR-10 / US-06 / US-07 / BR-03 / BR-06 | Row-lock transaction, final number, snapshot, approved advance exception | Real PostgreSQL concurrent issue and split installment tests |
| FR-11 / US-08 / BR-08 / BR-09 | Payment record/allocate, partial balance, unapplied credit, unique ref | Integration parallel allocation/overpayment/cross-customer |
| FR-12 / US-09 | Period report and current balance separated, per-currency, no draft revenue | Repeatable-read reconciliation + director browser screenshot |
| FR-13 | Transactional actor/action/time/before/after audit; immutable trigger | Integration tamper rejection, credential-redaction assertion |
| FR-14 | Quotation approval + append revision + compatible early term basis | Integration revision/approval + UI smoke |
| FR-15 | Server-time personal check-in/out, one-open constraint | Integration duplicate/parallel check-in |
| BR-05 | Digital form/proof does not assert physical/legal validity | Decisions and UI signature instruction |
| BR-07 | Draft edit/delete; issued immutable; controlled void/credit | Integration issued edits/DB mutation reject/corrections |
| BR-10 | Cancelled job retains transactions; correction before cancellation | Integration cancellation with existing issued invoice |

Transport eksternal R2 pada integration test adalah fixture yang hanya berjalan di tests. Konektivitas bucket nyata dibuktikan terpisah oleh `npm run test:r2` dan browser E2E dengan kredensial backend. Keduanya memakai PostgreSQL Docker dan bucket privat `sgi-one-demo`, tanpa mengganti storage aplikasi. Alur R2 reguler menerbitkan INV-2026-00003 untuk JOB-2026-00008: Rp5,5 juta, pembayaran Rp2 juta, saldo Rp3,5 juta pada dashboard. Seluruh US-01 sampai US-10 telah diuji pada data simulasi. Validasi SOP SGI tetap merupakan prasyarat pilot sebagaimana exit criteria PRD.
