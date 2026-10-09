"use client";
import Link from "next/link";
import { Banner, Button, LinkButton, Text } from "@cloudflare/kumo";
import { CheckCircleIcon, PrinterIcon } from "@phosphor-icons/react";
import { Actor, can, formatMoney } from "@/lib/domain";
import { DataTable, SectionPanel, Status, dateText } from "./shared";
import { RecordFacts } from "./workspace-ui";
import type { EditorMode } from "./editor";
import type { Invoice } from "./types";

export function InvoiceView({
  invoice: i,
  actor,
  onEdit,
}: {
  invoice: Invoice;
  actor: Actor;
  onEdit: (
    mode: EditorMode,
    action: string,
    initial?: Record<string, unknown>,
  ) => void;
}) {
  return (
    <div className="detail-body detail-stack">
      <div className="invoice-top">
        <div className="page-title-group">
          <Text as="h2" variant="heading" size="lg">
            {i.number ?? `Draft ${i.id.slice(0, 8)}`}
          </Text>
          <Text>{i.customerName}</Text>
          <Text variant="secondary">
            Dibuat {dateText(i.createdAt)} · jatuh tempo {dateText(i.dueAt)}
          </Text>
        </div>
        <div className="row-actions">
          <Status value={i.status} />
          <Status value={i.paymentStatus} />
        </div>
      </div>
      {i.status === "draft" && (
        <Banner variant={i.blockers.length ? "alert" : "secondary"}>
          {i.blockers.length ? (
            <>
              <Text as="strong" bold>
                Belum dapat diterbitkan
              </Text>
              <ul>
                {i.blockers.map((b, index) => (
                  <li key={index}>{b}</li>
                ))}
              </ul>
            </>
          ) : (
            <span className="nav-tab-label">
              <CheckCircleIcon size={16} />
              Semua syarat penerbitan telah terpenuhi.
            </span>
          )}
        </Banner>
      )}
      <SectionPanel
        title="Item tagihan"
        description="Komponen biaya yang dialokasikan dari job pelanggan ini."
      >
        <DataTable
          rows={i.items}
          columns={[
            {
              title: "Job",
              render: (r) => (
                <Link className="record-link" href={`/jobs/${r.jobId}`}>
                  {r.jobNumber}
                </Link>
              ),
            },
            { title: "Komponen", render: (r) => r.description },
            {
              title: "Nominal",
              render: (r) => formatMoney(r.amount, i.currency),
            },
          ]}
        />
      </SectionPanel>
      <SectionPanel title="Nilai & saldo invoice">
        <RecordFacts
          items={[
            { label: "Subtotal", value: formatMoney(i.subtotal, i.currency) },
            {
              label: `Pajak ${i.taxBps / 100}%`,
              value: formatMoney(i.tax, i.currency),
            },
            { label: "Total invoice", value: formatMoney(i.total, i.currency) },
            {
              label: "Pembayaran teralokasi",
              value: formatMoney(i.paid, i.currency),
            },
            {
              label: "Koreksi sah",
              value: formatMoney(i.credited, i.currency),
            },
            {
              label: "Saldo piutang",
              value: formatMoney(i.outstanding, i.currency),
            },
          ]}
        />
      </SectionPanel>
      <SectionPanel title="Riwayat pembayaran">
        <DataTable
          rows={i.allocations}
          empty="Belum ada pembayaran teralokasi ke invoice ini."
          columns={[
            { title: "Referensi", render: (r) => r.reference },
            { title: "Diterima", render: (r) => dateText(r.receivedAt) },
            {
              title: "Alokasi",
              render: (r) => formatMoney(r.amount, i.currency),
            },
          ]}
        />
      </SectionPanel>
      {i.corrections.length > 0 && (
        <SectionPanel title="Koreksi">
          <DataTable
            rows={i.corrections}
            columns={[
              { title: "Jenis", render: (r) => r.kind },
              { title: "Alasan", render: (r) => r.reason },
              {
                title: "Nominal",
                render: (r) => formatMoney(r.amount, i.currency),
              },
            ]}
          />
        </SectionPanel>
      )}
      <SectionPanel title="Audit invoice">
        <DataTable
          rows={i.auditTrail}
          columns={[
            { title: "Waktu", render: (r) => dateText(r.createdAt, true) },
            { title: "Pelaku", render: (r) => r.actorName },
            { title: "Aksi", render: (r) => r.action.replaceAll("_", " ") },
          ]}
        />
      </SectionPanel>
      <div className="form-actions">
        {i.status === "issued" && (
          <LinkButton
            variant="secondary"
            icon={<PrinterIcon size={16} />}
            href={`/invoices/${i.id}/print`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Cetak / simpan PDF
          </LinkButton>
        )}
        {can(actor, "invoicesWrite") &&
          (i.status === "draft" ? (
            <>
              <Button onClick={() => onEdit("draft", "", { ...i })}>
                Ubah draft
              </Button>
              <Button
                variant="secondary-destructive"
                onClick={() => onEdit("delete", "delete")}
              >
                Hapus draft
              </Button>
            </>
          ) : (
            i.status === "issued" && (
              <Button onClick={() => onEdit("correction", "correct")}>
                Void / credit note
              </Button>
            )
          ))}
      </div>
    </div>
  );
}
