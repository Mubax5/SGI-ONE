import { notFound } from "next/navigation";
import { getActor } from "@/lib/security";
import { jobDetail } from "@/modules/queries";
import { DomainError } from "@/lib/domain";
import { PrintButton } from "@/components/print-button";
import {
  scopedWorkspaceActor,
  redirectLegacyWorkspace,
} from "@/lib/workspace-server";
import type { PageQuery } from "@/lib/workspace-url";
import { z } from "zod";
export default async function DeliveryPrint({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; noteId: string }>;
  searchParams: Promise<PageQuery>;
}) {
  const { id, noteId } = await params;
  redirectLegacyWorkspace(`/jobs/${id}/delivery/${noteId}`, await searchParams);
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(noteId).success)
    notFound();
  const actor = await scopedWorkspaceActor(await getActor());
  let job;
  try {
    job = await jobDetail(actor, id);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
  const note = job.deliveries.find((n) => n.id === noteId);
  if (!note) notFound();
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
      <h1>Surat jalan digital</h1>
      <p>
        Job {job.number} · ref {note.id.slice(0, 8)}
      </p>
      <div className="print-parties">
        <div>
          <h2>Customer & rute</h2>
          <p>{job.customer.name}</p>
          <p>
            {job.origin} → {job.destination}
          </p>
          <p>Kendaraan: {note.vehicle}</p>
        </div>
        <div>
          <h2>Serah terima</h2>
          <p>Penerima: {note.recipient}</p>
          <p>
            {note.deliveredAt.toLocaleString("id-ID", {
              timeZone: "Asia/Jakarta",
            })}
          </p>
        </div>
      </div>
      <table className="print-table">
        <thead>
          <tr>
            <th>Barang</th>
            <th>Jumlah</th>
            <th>Catatan</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td data-label="Barang">{note.cargo}</td>
            <td data-label="Jumlah">{note.quantity} unit</td>
            <td data-label="Catatan">{note.note || "—"}</td>
          </tr>
        </tbody>
      </table>
      <div className="signature-area">
        <div>
          Petugas SGI
          <br />
          <br />
          <br />
          _____________________
        </div>
        <div>
          Penerima barang
          <br />
          <br />
          <br />
          {note.recipient}
        </div>
      </div>
      <p className="text-kumo-subtle">
        Formulir ini belum merupakan bukti terverifikasi. Unggah salinan
        bertanda tangan untuk review Operations.
      </p>
    </article>
  );
}
