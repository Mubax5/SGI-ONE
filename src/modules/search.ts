import { z } from "zod";
import { Actor, can, Permission } from "@/lib/domain";
import { workspaceRole } from "@/lib/workspace";
import { readModule } from "./queries";
import { reports } from "./reports";
export type SearchResult = {
  id: string;
  type: string;
  label: string;
  detail: string;
  href: string;
};
export async function globalSearch(
  actor: Actor,
  raw: string | null,
  role?: string | null,
) {
  if (role) workspaceRole(actor, role);
  const q = z
    .string()
    .trim()
    .min(2, "Ketik minimal dua karakter.")
    .max(100)
    .parse(raw);
  const match = (value: string) =>
    value.toLocaleLowerCase("id-ID").includes(q.toLocaleLowerCase("id-ID"));
  const resources: [string, Permission][] = [
    ["customers", "customersRead"],
    ["jobs", "jobsRead"],
    ["documents", "documentsRead"],
    ["reports", "reportsRead"],
    ["billing", "billingRead"],
    ["invoices", "invoicesRead"],
    ["payments", "paymentsRead"],
    ["requests", "quotationsRead"],
    ["quotations", "quotationsRead"],
    ["users", "users"],
  ];
  const groups = await Promise.all(
    resources
      .filter(([, permission]) => can(actor, permission))
      .map(async ([type]) => {
        const data =
          type === "reports"
            ? await reports(actor)
            : await readModule(actor, type, new URLSearchParams());
        if (!("rows" in data)) return [];
        const results: SearchResult[] = [];
        for (const entry of data.rows) {
          const row = entry as unknown as Record<string, unknown>;
          const id = String(row.id);
          const label = String(
            row.number ??
              row.name ??
              row.filename ??
              row.jobNumber ??
              row.reference ??
              row.title ??
              row.description ??
              row.customerName ??
              "Data SGI",
          );
          const detail = [
            row.customerName,
            row.title,
            row.contactName,
            row.phone,
            row.description,
            row.origin,
            row.destination,
            row.email,
            row.note,
            row.reference,
            row.status,
          ]
            .filter(Boolean)
            .join(" · ");
          if (!match(`${label} ${detail}`)) continue;
          const href =
            type === "jobs"
              ? `/jobs/${id}`
              : ["invoices", "payments"].includes(type)
                ? `/${type}?record=${encodeURIComponent(id)}`
                : `/${type}?q=${encodeURIComponent(type === "reports" ? String(row.note) : label)}`;
          results.push({
            id: `${type}-${id}`,
            type,
            label,
            detail: detail.slice(0, 180),
            href,
          });
          if (results.length === 6) break;
        }
        return results;
      }),
  );
  return { query: q, results: groups.flat().slice(0, 40) };
}
