import { z } from "zod";
import { moneyFromInput, roleKeys } from "@/lib/domain";
const id = z.string().uuid();
const text = z.string().trim().min(1, "Wajib diisi.").max(1000);
const note = z
  .string()
  .trim()
  .min(5, "Berikan alasan minimal lima karakter.")
  .max(2000);
const amount = z.string().transform(moneyFromInput);
const currency = z.enum(["IDR", "USD", "SGD"]);
const date = z
  .string()
  .datetime({ offset: true })
  .transform((s) => new Date(s));
const terms = {
  currency,
  taxBps: z.number().int().min(0).max(10000),
  termsDays: z.number().int().min(0).max(365),
};
export const customerInput = z.object({
  name: text,
  contactName: text,
  email: z.email(),
  phone: z.string().trim().min(6).max(30),
  address: text,
  taxId: z.string().trim().max(50).nullish(),
  active: z.boolean().default(true),
});
export const requestInput = z.object({
  customerId: id,
  source: z.enum(["sales", "direct", "contract"]),
  description: note,
  quotationId: id.optional(),
});
export const jobInput = z.object({
  customerId: id,
  requestId: id.optional(),
  serviceType: z.enum(["trucking", "forwarding", "warehousing"]),
  source: z.enum(["sales", "direct", "contract"]),
  description: note,
  origin: text,
  destination: text,
  picId: id,
  dueAt: date,
});
export const assignmentInput = z
  .object({ userIds: z.array(id).min(1).max(20) })
  .refine(
    (x) => new Set(x.userIds).size === x.userIds.length,
    "Petugas tidak boleh berulang.",
  );
export const statusInput = z.object({
  status: z.enum([
    "draft",
    "assigned",
    "in_progress",
    "completed",
    "cancelled",
  ]),
  note,
});
export const progressInput = z.object({ note });
export const reviewInput = z.object({
  status: z.enum(["verified", "rejected"]),
  note,
  checklist: z.array(z.string()).min(1),
});
export const billableInput = z.object({
  jobId: id,
  description: text,
  amount,
  ...terms,
  basis: note,
  eligibility: z.enum(["completion", "advance"]),
  quotationId: id.optional(),
});
export const approvalInput = z.object({ note });
export const draftInput = z
  .object({
    customerId: id,
    items: z
      .array(z.object({ billableId: id, amount }))
      .min(1)
      .max(100),
  })
  .refine(
    (x) => new Set(x.items.map((i) => i.billableId)).size === x.items.length,
    "Komponen tidak boleh berulang.",
  );
export const paymentInput = z
  .object({
    customerId: id,
    amount,
    currency,
    receivedAt: date,
    method: z.enum(["bank_transfer", "cash", "other"]),
    reference: z.string().trim().min(3).max(100),
    allocations: z.array(z.object({ invoiceId: id, amount })).max(100),
  })
  .refine(
    (x) =>
      new Set(x.allocations.map((i) => i.invoiceId)).size ===
      x.allocations.length,
    "Invoice tidak boleh berulang.",
  );
export const allocationInput = z
  .object({ allocations: paymentInput.shape.allocations })
  .refine(
    (x) =>
      new Set(x.allocations.map((i) => i.invoiceId)).size ===
      x.allocations.length,
    "Invoice tidak boleh berulang.",
  );
export const correctionInput = z.object({
  kind: z.enum(["void", "credit_note"]),
  amount: amount.optional(),
  reason: note,
});
export const userInput = z.object({
  name: text,
  email: z.email(),
  password: z.string().min(12).max(128),
  roles: z.array(z.enum(roleKeys)).min(1).max(6),
});
export const roleInput = z.object({
  roles: z.array(z.enum(roleKeys)).min(1).max(6),
  active: z.boolean(),
});
export const quotationInput = z.object({
  customerId: id,
  title: text,
  description: note,
  amount,
  ...terms,
  supersedesId: id.optional(),
});
export const deliveryInput = z.object({
  recipient: text,
  vehicle: text,
  cargo: text,
  quantity: z.number().int().positive().max(1000000),
  deliveredAt: date,
  note: z.string().trim().max(2000).default(""),
});
export const attendanceInput = z.object({
  note: z.string().trim().max(500).default(""),
});
export const identifier = id;
