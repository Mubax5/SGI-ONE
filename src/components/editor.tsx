"use client";
import { Button, Checkbox, Input, Banner, Text } from "@cloudflare/kumo";
import { FormEvent, useState } from "react";
import {
  documentTypes,
  formatMoney,
  roleKeys,
  roleLabels,
  services,
} from "@/lib/domain";
import { Choice, Feedback, TextField, api } from "./shared";
import type {
  Billable,
  Customer,
  FormDataSources,
  Invoice,
  Job,
  UserRow,
} from "./types";
export type EditorMode =
  | "customer"
  | "job"
  | "request"
  | "quotation"
  | "billable"
  | "draft"
  | "payment"
  | "allocation"
  | "assign"
  | "status"
  | "progress"
  | "upload"
  | "review"
  | "approval"
  | "issue"
  | "delete"
  | "correction"
  | "user"
  | "roles"
  | "delivery"
  | "attendance";
type Field = {
  key: string;
  label: string;
  type?: string;
  optional?: boolean;
  description?: string;
  choices?: Record<string, string>;
};
const currencyItems = {
  IDR: "IDR · Rupiah",
  USD: "USD · US dollar",
  SGD: "SGD · Singapore dollar",
};
const termsFields: Field[] = [
  { key: "currency", label: "Mata uang", choices: currencyItems },
  {
    key: "taxBps",
    label: "Pajak (basis points)",
    type: "number",
    description:
      "0 = tanpa pajak; 100 = 1%. Tarif harus sesuai persetujuan Finance.",
  },
  { key: "termsDays", label: "Jatuh tempo (hari)", type: "number" },
];
const asItems = <T extends { id: string }>(
  rows: T[] | undefined,
  label: (r: T) => string,
) => Object.fromEntries((rows ?? []).map((r) => [r.id, label(r)]));
const localNow = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
export function Editor({
  mode,
  endpoint,
  sources = {},
  initial = {},
  onSaved,
  onCancel,
}: {
  mode: EditorMode;
  endpoint: string;
  sources?: FormDataSources;
  initial?: Record<string, unknown>;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const fields: Record<string, string> = {
      currency: "IDR",
      taxBps: "0",
      termsDays: "30",
      source: "direct",
      serviceType: "trucking",
      eligibility: "completion",
      receivedAt: localNow(),
      deliveredAt: localNow(),
      dueAt: localNow(),
      method: "bank_transfer",
      active: "true",
      quantity: "1",
      kind:
        mode === "attendance" ? String(initial.kind ?? "in") : "credit_note",
      type: "delivery_note",
      status: "in_progress",
    };
    for (const [k, value] of Object.entries(initial)) {
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      )
        fields[k] = String(value);
    }
    if (typeof initial.approvedAmount === "number")
      fields.amount = String(initial.approvedAmount / 100);
    if (typeof initial.amount === "number")
      fields.amount = String(initial.amount / 100);
    if (typeof initial.dueAt === "string")
      fields.dueAt = new Date(
        new Date(initial.dueAt).getTime() -
          new Date(initial.dueAt).getTimezoneOffset() * 60000,
      )
        .toISOString()
        .slice(0, 16);
    return fields;
  });
  const [selected, setSelected] = useState<Record<string, string>>(() => {
    const rows = initial.items as
      { billableId: string; amount: number }[] | undefined;
    return Object.fromEntries(
      (rows ?? []).map((i) => [i.billableId, String(i.amount / 100)]),
    );
  });
  const [checks, setChecks] = useState<Record<string, boolean>>(() => {
    const roles = (initial.roles as string[] | undefined) ?? [];
    const assignees =
      (initial.assignees as { userId: string }[] | undefined) ?? [];
    return Object.fromEntries(
      [...roles, ...assignees.map((a) => a.userId)].map((x) => [x, true]),
    );
  });
  const [file, setFile] = useState<File>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (key: string) => (value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (key === "customerId" && ["draft", "payment"].includes(mode))
      setSelected({});
  };
  const customerItems = asItems(
    sources.customers?.filter((c) => c.active || c.id === values.customerId),
    (c: Customer) => c.name,
  );
  const jobItems = asItems(
    sources.jobs?.filter((j) => j.status !== "cancelled"),
    (j: Job) => `${j.number} · ${j.customerName}`,
  );
  const quoteItems = {
    "": "Tanpa penawaran",
    ...asItems(
      sources.quotations?.filter(
        (q) =>
          q.status === "approved" &&
          (!values.customerId || q.customerId === values.customerId),
      ),
      (q) => `${q.title} · revisi ${q.revision}`,
    ),
  };
  const customerField: Field = {
    key: "customerId",
    label: "Customer",
    choices: customerItems,
  };
  let fields: Field[] = [];
  switch (mode) {
    case "customer":
      fields = [
        { key: "name", label: "Nama perusahaan" },
        { key: "contactName", label: "Nama kontak" },
        { key: "email", label: "Email kontak", type: "email" },
        { key: "phone", label: "Telepon" },
        { key: "address", type: "textarea", label: "Alamat penagihan" },
        { key: "taxId", label: "NPWP / ID pajak", optional: true },
        {
          key: "active",
          label: "Status customer",
          choices: { true: "Aktif", false: "Nonaktif" },
        },
      ];
      break;
    case "job":
      fields = [
        customerField,
        { key: "serviceType", label: "Layanan", choices: services },
        {
          key: "source",
          label: "Sumber order",
          choices: { direct: "Langsung", sales: "Sales", contract: "Kontrak" },
        },
        {
          key: "requestId",
          label: "Permintaan terkait",
          optional: true,
          choices: {
            "": "Tanpa permintaan",
            ...asItems(
              sources.requests?.filter(
                (r) => r.customerId === values.customerId,
              ),
              (r) => r.description,
            ),
          },
        },
        { key: "description", type: "textarea", label: "Deskripsi pekerjaan" },
        { key: "origin", label: "Lokasi asal" },
        { key: "destination", label: "Lokasi tujuan" },
        {
          key: "picId",
          label: "PIC Operations",
          choices: asItems(
            sources.people?.filter((p) => p.role === "operations"),
            (p) => p.name,
          ),
        },
        { key: "dueAt", label: "Tenggat pekerjaan", type: "datetime-local" },
      ];
      break;
    case "request":
      fields = [
        customerField,
        {
          key: "source",
          label: "Sumber permintaan",
          choices: { direct: "Langsung", sales: "Sales", contract: "Kontrak" },
        },
        { key: "description", type: "textarea", label: "Kebutuhan pelanggan" },
        {
          key: "quotationId",
          label: "Penawaran disetujui",
          choices: quoteItems,
          optional: true,
        },
      ];
      break;
    case "quotation":
      fields = [
        customerField,
        { key: "title", label: "Nama penawaran / kontrak" },
        {
          key: "description",
          type: "textarea",
          label: "Rincian layanan dan termin",
        },
        {
          key: "amount",
          label: "Nilai penawaran",
          description:
            "Nominal dalam mata uang utama, contoh 2500000 atau 125.50.",
        },
        ...termsFields,
      ];
      break;
    case "billable":
      fields = [
        { key: "jobId", label: "Job order", choices: jobItems },
        { key: "description", type: "textarea", label: "Komponen tagihan" },
        { key: "amount", label: "Nominal komponen" },
        ...termsFields,
        { key: "basis", type: "textarea", label: "Dasar tarif / persetujuan" },
        {
          key: "eligibility",
          label: "Kelayakan penerbitan",
          choices: {
            completion: "Setelah selesai dan bukti diverifikasi",
            advance: "Termin awal dengan kontrak disetujui",
          },
        },
        {
          key: "quotationId",
          label: "Kontrak / penawaran disetujui",
          choices: quoteItems,
          optional: values.eligibility !== "advance",
        },
      ];
      break;
    case "draft":
      fields = [customerField];
      break;
    case "payment":
      fields = [
        customerField,
        { key: "amount", label: "Nilai penerimaan" },
        { key: "currency", label: "Mata uang", choices: currencyItems },
        {
          key: "receivedAt",
          label: "Tanggal diterima",
          type: "datetime-local",
        },
        {
          key: "method",
          label: "Metode",
          choices: {
            bank_transfer: "Transfer bank",
            cash: "Tunai",
            other: "Lainnya",
          },
        },
        { key: "reference", label: "Referensi pembayaran unik" },
      ];
      break;
    case "status":
      fields = [
        {
          key: "status",
          label: "Status berikutnya",
          choices: (initial.statusOptions as Record<string, string>) ?? {
            in_progress: "Dalam proses",
            completed: "Selesai",
            cancelled: "Dibatalkan",
          },
        },
        { key: "note", type: "textarea", label: "Catatan perubahan" },
      ];
      break;
    case "progress":
      fields = [{ key: "note", type: "textarea", label: "Catatan pekerjaan" }];
      break;
    case "upload":
      fields = [
        { key: "type", label: "Jenis dokumen", choices: documentTypes },
      ];
      break;
    case "review":
      fields = [
        {
          key: "status",
          label: "Keputusan",
          choices: {
            verified: "Verifikasi",
            rejected: "Tolak dan minta perbaikan",
          },
        },
        {
          key: "note",
          type: "textarea",
          label: "Catatan review / alasan penolakan",
        },
      ];
      break;
    case "approval":
      fields = [
        {
          key: "note",
          type: "textarea",
          label: "Dasar dan catatan persetujuan",
        },
      ];
      break;
    case "correction":
      fields = [
        {
          key: "kind",
          label: "Jenis koreksi",
          choices: {
            credit_note: "Credit note (saldo tersisa)",
            void: "Void (tanpa pembayaran / kredit)",
          },
        },
        ...(values.kind === "credit_note"
          ? [{ key: "amount", label: "Nilai credit note" }]
          : []),
        { key: "reason", type: "textarea", label: "Alasan koreksi" },
      ];
      break;
    case "user":
      fields = [
        { key: "name", label: "Nama pengguna" },
        { key: "email", label: "Email internal", type: "email" },
        {
          key: "password",
          label: "Kata sandi awal (minimal 12 karakter)",
          type: "password",
        },
      ];
      break;
    case "roles":
      fields = [
        {
          key: "active",
          label: "Status akun",
          choices: { true: "Aktif", false: "Nonaktif dan cabut sesi" },
        },
      ];
      break;
    case "delivery":
      fields = [
        { key: "recipient", label: "Nama penerima" },
        { key: "vehicle", label: "Nomor kendaraan / referensi angkutan" },
        { key: "cargo", label: "Deskripsi barang" },
        { key: "quantity", label: "Jumlah unit", type: "number" },
        {
          key: "deliveredAt",
          label: "Waktu serah terima",
          type: "datetime-local",
        },
        {
          key: "note",
          type: "textarea",
          label: "Catatan kondisi barang",
          optional: true,
        },
      ];
      break;
    case "attendance":
      fields = [
        {
          key: "note",
          type: "textarea",
          label: "Catatan absensi",
          optional: true,
        },
      ];
      break;
  }
  const checkedKeys = () => Object.keys(checks).filter((k) => checks[k]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      let body: unknown;
      const raw = { ...values };
      for (const key of ["taxBps", "termsDays", "quantity"])
        if (raw[key] !== undefined)
          (raw as Record<string, unknown>)[key] = Number(raw[key]);
      for (const key of ["dueAt", "receivedAt", "deliveredAt"])
        if (raw[key]) raw[key] = new Date(raw[key]).toISOString();
      for (const key of ["requestId", "quotationId", "supersedesId"])
        if (!raw[key]) delete raw[key];
      body = { ...raw, active: values.active === "true" };
      if (mode === "draft")
        body = {
          customerId: values.customerId,
          items: Object.entries(selected).map(([billableId, amount]) => ({
            billableId,
            amount,
          })),
        };
      if (mode === "payment")
        body = {
          ...raw,
          allocations: Object.entries(selected).map(([invoiceId, amount]) => ({
            invoiceId,
            amount,
          })),
        };
      if (mode === "allocation")
        body = {
          allocations: Object.entries(selected).map(([invoiceId, amount]) => ({
            invoiceId,
            amount,
          })),
        };
      if (mode === "assign") body = { userIds: checkedKeys() };
      if (["user", "roles"].includes(mode))
        body = { ...(body as object), roles: checkedKeys() };
      if (mode === "review")
        body = {
          status: values.status,
          note: values.note,
          checklist: checkedKeys().length ? checkedKeys() : ["reviewed"],
        };
      if (mode === "upload") {
        if (!file)
          throw new Error("Pilih file PDF, JPG, atau PNG terlebih dahulu.");
        const form = new FormData();
        form.set("type", values.type);
        form.set("file", file);
        body = form;
      }
      if (mode === "issue" || mode === "delete") body = {};
      await api(endpoint, body);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Penyimpanan gagal.");
    } finally {
      setBusy(false);
    }
  }
  const lineRows: (Billable | Invoice)[] =
    mode === "draft"
      ? (sources.billables ?? []).filter(
          (b) => b.customerId === values.customerId,
        )
      : (sources.invoices ?? []).filter(
          (i) =>
            i.customerId === values.customerId &&
            i.currency === values.currency &&
            i.status === "issued" &&
            i.outstanding > 0,
        );
  return (
    <form onSubmit={submit} className="editor">
      <Feedback error={error} />
      {[
        {
          title: "Data utama",
          keys: fields.filter(
            (f) =>
              ![
                "origin",
                "destination",
                "picId",
                "dueAt",
                "serviceType",
                "vehicle",
                "recipient",
                "cargo",
                "quantity",
                "deliveredAt",
                "amount",
                "currency",
                "taxBps",
                "termsDays",
                "eligibility",
                "quotationId",
                "basis",
                "method",
                "receivedAt",
                "reference",
                "kind",
              ].includes(f.key),
          ),
        },
        {
          title: "Rute & pelaksanaan",
          keys: fields.filter((f) =>
            [
              "origin",
              "destination",
              "picId",
              "dueAt",
              "serviceType",
              "vehicle",
              "recipient",
              "cargo",
              "quantity",
              "deliveredAt",
            ].includes(f.key),
          ),
        },
        {
          title: "Nilai & ketentuan",
          keys: fields.filter((f) =>
            [
              "amount",
              "currency",
              "taxBps",
              "termsDays",
              "eligibility",
              "quotationId",
              "basis",
              "method",
              "receivedAt",
              "reference",
              "kind",
            ].includes(f.key),
          ),
        },
      ]
        .filter((group) => group.keys.length)
        .map((group) => (
          <fieldset key={group.title} className="form-section">
            <Text as="legend" variant="heading">
              {group.title}
            </Text>
            <div className="form-grid">
              {group.keys.map((f) => (
                <div
                  key={f.key}
                  className={
                    f.type === "textarea" ? "form-field-wide" : undefined
                  }
                >
                  {f.choices ? (
                    <Choice
                      label={f.label}
                      value={values[f.key] ?? ""}
                      onChange={set(f.key)}
                      items={f.choices}
                      required={!f.optional}
                    />
                  ) : (
                    <TextField
                      label={f.label}
                      value={values[f.key] ?? ""}
                      onChange={set(f.key)}
                      type={f.type}
                      required={!f.optional}
                      description={f.description}
                    />
                  )}
                </div>
              ))}
            </div>
          </fieldset>
        ))}
      {mode === "assign" && (
        <div className="selection-list">
          <h3>Petugas lapangan</h3>
          {(sources.people ?? [])
            .filter((p) => p.role === "field")
            .map((p) => (
              <Checkbox
                key={p.id}
                label={p.name}
                checked={checks[p.id] ?? false}
                onCheckedChange={(c) =>
                  setChecks((prev) => ({ ...prev, [p.id]: c }))
                }
              />
            ))}
        </div>
      )}
      {["user", "roles"].includes(mode) && (
        <div className="selection-list">
          <h3>Hak akses (dapat lebih dari satu)</h3>
          {roleKeys.map((r) => (
            <Checkbox
              key={r}
              label={roleLabels[r]}
              checked={checks[r] ?? false}
              onCheckedChange={(c) =>
                setChecks((prev) => ({ ...prev, [r]: c }))
              }
            />
          ))}
        </div>
      )}
      {mode === "review" && (
        <div className="selection-list">
          <h3>Checklist verifikasi</h3>
          {Object.entries({
            readable: "Dokumen terbaca dan lengkap",
            matches_job: "Customer, muatan, dan rute sesuai job",
            signed: "Tanda tangan / bukti penerima lengkap",
          }).map(([key, label]) => (
            <Checkbox
              key={key}
              label={label}
              checked={checks[key] ?? false}
              onCheckedChange={(c) =>
                setChecks((prev) => ({ ...prev, [key]: c }))
              }
            />
          ))}
        </div>
      )}
      {mode === "upload" && (
        <div className="upload-field">
          <Input
            label="File dokumen privat"
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            required
            onChange={(e) => setFile(e.target.files?.[0])}
          />
          <p>
            PDF, JPG, atau PNG · maksimal 10 MB. Versi lama tetap tersimpan;
            unggahan baru menunggu review Operations.
          </p>
        </div>
      )}
      {["draft", "payment", "allocation"].includes(mode) && (
        <div className="selection-list">
          <h3>
            {mode === "draft"
              ? "Pilih komponen dan nilai termin"
              : "Alokasi ke invoice (opsional)"}
          </h3>
          <p className="text-kumo-subtle">
            {mode === "draft"
              ? "Draft boleh disiapkan sebelum pekerjaan selesai. Penerbitan tetap memerlukan persetujuan dan bukti."
              : "Saldo penerimaan yang belum dialokasikan tersimpan sebagai unapplied credit."}
          </p>
          {lineRows.length ? (
            lineRows.map((row) => {
              const billable = row as Billable;
              const invoice = row as Invoice;
              const available =
                mode === "draft" ? billable.available : invoice.outstanding;
              const label =
                mode === "draft"
                  ? `${billable.jobNumber} · ${billable.description}`
                  : `${invoice.number}`;
              return (
                <div className="allocation-row" key={row.id}>
                  <div>
                    <Checkbox
                      label={label}
                      checked={selected[row.id] !== undefined}
                      onCheckedChange={(checked) =>
                        setSelected((prev) => {
                          const next = { ...prev };
                          if (checked) next[row.id] = String(available / 100);
                          else delete next[row.id];
                          return next;
                        })
                      }
                    />
                    <p className="text-kumo-subtle">
                      Saldo {formatMoney(available, row.currency)}
                      {mode === "draft" && billable.blockers.length
                        ? ` · ${billable.blockers.join("; ")}`
                        : ""}
                    </p>
                  </div>
                  {selected[row.id] !== undefined && (
                    <TextField
                      label="Nominal alokasi"
                      value={selected[row.id]}
                      onChange={(val) =>
                        setSelected((prev) => ({ ...prev, [row.id]: val }))
                      }
                    />
                  )}
                </div>
              );
            })
          ) : (
            <Banner variant="secondary" className="form-notice">
              Pilih customer; pastikan ada komponen atau invoice dengan saldo
              tersedia.
            </Banner>
          )}
        </div>
      )}
      {mode === "issue" && (
        <Banner variant="secondary" className="form-notice">
          Penerbitan mengunci alokasi tagihan dan mengambil snapshot customer.
          Detail invoice terbit tidak dapat diedit. Jika validasi gagal, invoice
          tetap draft.
        </Banner>
      )}
      {mode === "delete" && (
        <Banner variant="secondary" className="form-notice">
          Draft beserta komponennya akan dihapus. Riwayat penghapusan tetap
          tersedia di audit.
        </Banner>
      )}
      <div className="form-actions">
        <Button onClick={onCancel} type="button" disabled={busy}>
          Batal
        </Button>
        <Button
          variant={mode === "delete" ? "destructive" : "primary"}
          type="submit"
          loading={busy}
        >
          {mode === "issue"
            ? "Terbitkan invoice"
            : mode === "delete"
              ? "Hapus draft"
              : "Simpan"}
        </Button>
      </div>
    </form>
  );
}
export type EditRecord = Partial<
  Customer | Job | Invoice | Billable | UserRow
> &
  Record<string, unknown>;
