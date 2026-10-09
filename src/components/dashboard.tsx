"use client";
import Link from "next/link";
import { Badge, LinkButton, Text } from "@cloudflare/kumo";
import {
  FilesIcon,
  CoinsIcon,
  ReceiptIcon,
  ArrowRightIcon,
} from "@phosphor-icons/react";
import { RecordFacts } from "./workspace-ui";
import { formatMoney } from "@/lib/domain";
import { DataTable, SectionPanel, Status, dateText } from "./shared";
import type { Dashboard } from "./types";
export function DashboardView({ data: d }: { data: Dashboard }) {
  return (
    <>
      <SectionPanel
        id="penagihan"
        title="Penagihan & piutang"
        description="Penagihan dan penerimaan mengikuti periode laporan. Saldo piutang dan credit menunjukkan posisi sekarang."
        action={
          <span className="text-kumo-subtle">
            {d.draftCount} draft tidak termasuk penagihan
          </span>
        }
        className="financial-summary"
      >
        <DataTable
          rows={d.currencies
            .filter(
              (c) =>
                c.currency === "IDR" ||
                c.billed ||
                c.receipts ||
                c.outstanding ||
                c.unapplied,
            )
            .map((c) => ({ ...c, id: c.currency }))}
          columns={[
            { title: "Mata uang", render: (r) => r.currency },
            {
              title: "Invoice terbit",
              render: (r) => formatMoney(r.billed, r.currency),
            },
            {
              title: "Penerimaan",
              render: (r) => formatMoney(r.receipts, r.currency),
            },
            {
              title: "Piutang",
              render: (r) => (
                <strong>{formatMoney(r.outstanding, r.currency)}</strong>
              ),
            },
            {
              title: "Lewat jatuh tempo",
              render: (r) => formatMoney(r.overdue, r.currency),
            },
            {
              title: "Credit belum dialokasi",
              render: (r) => formatMoney(r.unapplied, r.currency),
            },
          ]}
        />
      </SectionPanel>
      <div className="dashboard-workspace">
        <SectionPanel
          id="prioritas"
          title="Prioritas operasional"
          description={`Pekerjaan terbuka diurutkan berdasarkan tenggat. ${d.rejectedDocuments} dokumen perlu perbaikan.`}
          action={
            <LinkButton
              variant="ghost"
              size="sm"
              href="/jobs"
              icon={<ArrowRightIcon size={16} />}
            >
              Semua job
            </LinkButton>
          }
          className="priority-summary"
        >
          <DataTable
            rows={d.attention}
            perPage={5}
            empty="Seluruh pekerjaan sudah ditutup. Buat job baru untuk order berikutnya."
            columns={[
              {
                title: "Job / customer",
                render: (r) => (
                  <div>
                    <Link className="record-link" href={`/jobs/${r.id}`}>
                      {r.number}
                    </Link>
                    <p>{r.customerName}</p>
                  </div>
                ),
              },
              {
                title: "Rute",
                render: (r) => `${r.origin} → ${r.destination}`,
              },
              { title: "Status", render: (r) => <Status value={r.status} /> },
              { title: "Tenggat", render: (r) => dateText(r.dueAt) },
              {
                title: "Dokumen",
                render: (r) => `${r.pending} perlu tindak lanjut`,
              },
            ]}
          />
        </SectionPanel>
        <SectionPanel
          title="Tindak lanjut"
          description="Kesiapan pekerjaan dan tagihan saat ini."
          className="operations-summary"
        >
          <RecordFacts
            items={[
              { label: "Pekerjaan aktif", value: d.activeJobs },
              { label: "Job dibuat dalam periode", value: d.jobsCreated },
            ]}
          />
          <div className="operational-links">
            <LinkButton
              variant="ghost"
              href="/documents"
              icon={<FilesIcon size={18} />}
            >
              <Text>Dokumen menunggu review</Text>
              <Badge className="sgi-badge" variant="secondary">
                {d.pendingDocuments}
              </Badge>
            </LinkButton>
            <LinkButton
              variant="ghost"
              href="/billing"
              icon={<CoinsIcon size={18} />}
            >
              <Text>Komponen siap ditagih</Text>
              <Badge className="sgi-badge" variant="secondary">
                {d.readyBillables}
              </Badge>
            </LinkButton>
            <LinkButton
              variant="ghost"
              href="/invoices"
              icon={<ReceiptIcon size={18} />}
            >
              <Text>Invoice terbit dalam periode</Text>
              <Badge className="sgi-badge" variant="secondary">
                {d.issuedCount}
              </Badge>
            </LinkButton>
          </div>
        </SectionPanel>
      </div>
      <SectionPanel
        id="piutang"
        title="Piutang pelanggan"
        description="Saldo invoice terbit setelah alokasi pembayaran dan koreksi sah."
        action={
          <LinkButton
            variant="ghost"
            size="sm"
            href="/payments"
            icon={<ArrowRightIcon size={16} />}
          >
            Pembayaran
          </LinkButton>
        }
        className="dashboard-section"
      >
        <DataTable
          rows={d.receivables}
          perPage={5}
          empty="Tidak ada saldo piutang untuk ditindaklanjuti."
          columns={[
            { title: "Invoice", render: (r) => r.number },
            { title: "Customer", render: (r) => r.customerName },
            { title: "Jatuh tempo", render: (r) => dateText(r.dueAt) },
            {
              title: "Saldo piutang",
              render: (r) => formatMoney(r.outstanding, r.currency),
            },
          ]}
        />
      </SectionPanel>
    </>
  );
}
