import type * as schema from "@/db/schema";
import type {
  JobsData,
  JobData,
  BillablesData,
  InvoicesData,
  PaymentsData,
  DashboardData,
} from "@/modules/queries";
export type Serialized<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Serialized<U>[]
    : T extends object
      ? { [K in keyof T]: Serialized<T[K]> }
      : T;
export type Customer = Serialized<typeof schema.customers.$inferSelect>;
export type Job = Serialized<JobsData[number]>;
export type JobDetail = Serialized<JobData>;
export type Billable = Serialized<BillablesData[number]>;
export type Invoice = Serialized<InvoicesData[number]>;
export type Payment = Serialized<PaymentsData[number]>;
export type Quotation = Serialized<typeof schema.quotations.$inferSelect> & {
  customerName?: string;
};
export type OrderRequest = Serialized<typeof schema.requests.$inferSelect> & {
  customerName?: string;
};
export type Document = Job["documents"][number] & {
  jobNumber: string;
  customerName: string;
};
export type Person = { id: string; name: string; role: string };
export type UserRow = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  roles: import("@/lib/domain").Role[];
};
export type AuditRow = Serialized<typeof schema.audit.$inferSelect> & {
  actorName: string;
};
export type Attendance = Serialized<typeof schema.attendance.$inferSelect>;
export type Dashboard = Serialized<DashboardData>;
export type ModuleKey =
  | "dashboard"
  | "customers"
  | "requests"
  | "quotations"
  | "jobs"
  | "documents"
  | "billing"
  | "invoices"
  | "payments"
  | "attendance"
  | "users"
  | "audit";
export type FormDataSources = {
  customers?: Customer[];
  jobs?: Job[];
  people?: Person[];
  requests?: OrderRequest[];
  quotations?: Quotation[];
  billables?: Billable[];
  invoices?: Invoice[];
};
