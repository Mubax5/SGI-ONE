import { notFound } from "next/navigation";
import { getActor } from "@/lib/security";
import { invoices } from "@/modules/queries";
import { formatMoney, DomainError } from "@/lib/domain";
import { PrintButton } from "@/components/print-button";
import {
  scopedWorkspaceActor,
  redirectLegacyWorkspace,
} from "@/lib/workspace-server";
import type { PageQuery } from "@/lib/workspace-url";
import { z } from "zod";
export default async function InvoicePrint({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<PageQuery>;
}) {
  const { id } = await params;
  redirectLegacyWorkspace(`/invoices/${id}/print`, await searchParams);
  if (!z.uuid().safeParse(id).success) notFound();
  const actor = await scopedWorkspaceActor(await getActor());
  let row;
  try {
    row = (await invoices(actor)).find(
      (i) => i.id === id && i.status !== "draft",
    );
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
  if (!row) notFound();
  const customer = row.customerSnapshot as {
    name: string;
    address: string;
    email: string;
    taxId: string | null;
  };
  return (
    <article className="print-document">
      <div className="print-heading">
        <div className="brand">
          <span className="brand-name">
            SGI<span>One</span>
          </span>
          <span>Sandika Global Indonesia</span>
        </div>
        <PrintButton />
      </div>
      <h1>Invoice {row.number}</h1>
      <p>Status: {row.status === "void" ? "VOID / DIBATALKAN" : "Terbit"}</p>
      <div className="print-parties">
        <div>
          <h2>Ditagihkan kepada</h2>
          <p>{customer.name}</p>
          <p>{customer.address}</p>
          <p>{customer.email}</p>
          <p>NPWP: {customer.taxId ?? "—"}</p>
        </div>
        <div>
          <p>
            Terbit:{" "}
            {row.issuedAt?.toLocaleDateString("id-ID", {
              timeZone: "Asia/Jakarta",
            })}
          </p>
          <p>
            Jatuh tempo:{" "}
            {row.dueAt?.toLocaleDateString("id-ID", {
              timeZone: "Asia/Jakarta",
            })}
          </p>
          <p>Mata uang: {row.currency}</p>
        </div>
      </div>
      <table className="print-table">
        <thead>
          <tr>
            <th>Job</th>
            <th>Komponen</th>
            <th>Nominal</th>
          </tr>
        </thead>
        <tbody>
          {row.items.map((item) => (
            <tr key={item.id}>
              <td data-label="Job">{item.jobNumber}</td>
              <td data-label="Komponen">{item.description}</td>
              <td data-label="Nominal">
                {formatMoney(item.amount, row.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="invoice-totals">
        <div>
          <dt>Subtotal</dt>
          <dd>{formatMoney(row.subtotal, row.currency)}</dd>
        </div>
        <div>
          <dt>Pajak {row.taxBps / 100}%</dt>
          <dd>{formatMoney(row.tax, row.currency)}</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd>{formatMoney(row.total, row.currency)}</dd>
        </div>
        <div>
          <dt>Pembayaran</dt>
          <dd>{formatMoney(row.paid, row.currency)}</dd>
        </div>
        <div>
          <dt>Koreksi</dt>
          <dd>{formatMoney(row.credited, row.currency)}</dd>
        </div>
        <div>
          <dt>Saldo</dt>
          <dd>{formatMoney(row.outstanding, row.currency)}</dd>
        </div>
      </dl>
    </article>
  );
}
