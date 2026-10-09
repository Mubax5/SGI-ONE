"use client";
import { Banner, Tabs, Text } from "@cloudflare/kumo";
import { useState } from "react";
import { formatMoney } from "@/lib/domain";
import { DataTable, SectionPanel, dateText } from "./shared";
import { RecordFacts } from "./workspace-ui";
import type { AuditRow, Payment } from "./types";
export function PaymentView({ payment: p }: { payment: Payment }) {
  const methods: Record<string, string> = {
    bank_transfer: "Transfer bank",
    cash: "Tunai",
    other: "Lainnya",
  };
  return (
    <div className="detail-body detail-stack">
      <SectionPanel title={p.reference} description={p.customerName}>
        <RecordFacts
          items={[
            { label: "Penerimaan", value: formatMoney(p.amount, p.currency) },
            {
              label: "Teralokasi",
              value: formatMoney(p.allocated, p.currency),
            },
            {
              label: "Credit belum dialokasi",
              value: formatMoney(p.unapplied, p.currency),
            },
            { label: "Diterima", value: dateText(p.receivedAt, true) },
            { label: "Metode", value: methods[p.method] ?? p.method },
            { label: "Mata uang", value: p.currency },
          ]}
        />
      </SectionPanel>
      <SectionPanel
        title="Alokasi pembayaran"
        description="Nominal penerimaan yang sudah diterapkan ke masing-masing invoice."
      >
        <DataTable
          rows={p.allocations}
          empty="Belum ada alokasi. Gunakan Alokasikan dari daftar pembayaran untuk menerapkan credit ke invoice."
          columns={[
            { title: "Invoice", render: (r) => r.number ?? "—" },
            {
              title: "Nominal",
              render: (r) => formatMoney(r.amount, p.currency),
            },
            { title: "Dicatat", render: (r) => dateText(r.createdAt, true) },
          ]}
        />
      </SectionPanel>
    </div>
  );
}
function display(value: unknown): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}
export function AuditView({ audit: a }: { audit: AuditRow }) {
  const [tab, setTab] = useState("comparison");
  const before = (
    a.before && typeof a.before === "object" ? a.before : {}
  ) as Record<string, unknown>;
  const after = (
    a.after && typeof a.after === "object" ? a.after : {}
  ) as Record<string, unknown>;
  const rows = [
    ...new Set([...Object.keys(before), ...Object.keys(after)]),
  ].map((key) => ({ id: key, before: before[key], after: after[key] }));
  return (
    <div className="detail-body detail-stack">
      <RecordFacts
        items={[
          { label: "Pelaku", value: a.actorName },
          { label: "Waktu", value: dateText(a.createdAt, true) },
          { label: "Tindakan", value: a.action.replaceAll("_", " ") },
          { label: "Entitas", value: a.entity },
          { label: "ID catatan", value: a.entityId },
        ]}
      />
      <Banner
        variant="secondary"
        description="Riwayat ini tersimpan sebagai catatan audit dan tidak dapat diubah."
      />
      <Tabs
        value={tab}
        onValueChange={setTab}
        tabs={[
          { value: "comparison", label: "Perubahan data" },
          { value: "source", label: "Data lengkap" },
        ]}
      />
      {tab === "comparison" ? (
        <DataTable
          rows={rows}
          empty="Tindakan ini tidak mengubah rincian data."
          columns={[
            { title: "Field", render: (r) => r.id },
            {
              title: "Sebelum",
              render: (r) => (
                <pre className="audit-value">{display(r.before)}</pre>
              ),
            },
            {
              title: "Sesudah",
              render: (r) => (
                <pre className="audit-value">{display(r.after)}</pre>
              ),
            },
          ]}
        />
      ) : (
        <div className="audit-snapshots">
          <div>
            <Text as="h3" variant="heading">
              Sebelum
            </Text>
            <pre className="audit-json">
              {JSON.stringify(a.before, null, 2)}
            </pre>
          </div>
          <div>
            <Text as="h3" variant="heading">
              Sesudah
            </Text>
            <pre className="audit-json">{JSON.stringify(a.after, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
