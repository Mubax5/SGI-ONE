import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  bigint,
  jsonb,
  uniqueIndex,
  index,
  pgEnum,
  pgSequence,
  check,
  doublePrecision,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const at = (name: string) =>
  timestamp(name, { withTimezone: true }).notNull().defaultNow();
const money = (name: string) => bigint(name, { mode: "number" }).notNull();
export const roleEnum = pgEnum("role_key", [
  "director",
  "operations",
  "field",
  "finance",
  "sales",
  "admin",
]);
export const jobStatus = pgEnum("job_status", [
  "draft",
  "assigned",
  "in_progress",
  "completed",
  "cancelled",
]);
export const docStatus = pgEnum("document_status", [
  "submitted",
  "verified",
  "rejected",
]);
export const invoiceStatus = pgEnum("invoice_status", [
  "draft",
  "issued",
  "void",
]);
export const jobNumber = pgSequence("job_number_seq");
export const invoiceNumber = pgSequence("invoice_number_seq");
export const user = pgTable("users", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  active: boolean("active").notNull().default(true),
  createdAt: at("created_at"),
  updatedAt: at("updated_at"),
});
export const session = pgTable(
  "sessions",
  {
    id: id(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: at("created_at"),
    updatedAt: at("updated_at"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);
export const account = pgTable(
  "accounts",
  {
    id: id(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: at("created_at"),
    updatedAt: at("updated_at"),
  },
  (t) => [uniqueIndex("account_provider_unique").on(t.providerId, t.accountId)],
);
export const verification = pgTable("verifications", {
  id: id(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: at("created_at"),
  updatedAt: at("updated_at"),
});
export const rateLimit = pgTable("auth_rate_limits", {
  id: id(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});
export const roles = pgTable("roles", {
  key: roleEnum("key").primaryKey(),
  label: text("label").notNull(),
});
export const userRoles = pgTable(
  "user_roles",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    role: roleEnum("role")
      .notNull()
      .references(() => roles.key),
  },
  (t) => [uniqueIndex("user_role_unique").on(t.userId, t.role)],
);
export const customers = pgTable("customers", {
  id: id(),
  name: text("name").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  taxId: text("tax_id"),
  active: boolean("active").notNull().default(true),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id),
  createdAt: at("created_at"),
  updatedAt: at("updated_at"),
});
export const quotations = pgTable(
  "quotations",
  {
    id: id(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id),
    title: text("title").notNull(),
    description: text("description").notNull(),
    amount: money("amount"),
    currency: text("currency").notNull().default("IDR"),
    taxBps: integer("tax_bps").notNull().default(0),
    termsDays: integer("terms_days").notNull().default(30),
    revision: integer("revision").notNull().default(1),
    supersedesId: text("supersedes_id"),
    status: text("status").notNull().default("draft"),
    approvalNote: text("approval_note"),
    approvedBy: text("approved_by").references(() => user.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    createdAt: at("created_at"),
  },
  (t) => [check("quote_amount_positive", sql`${t.amount} > 0`)],
);
export const requests = pgTable("order_requests", {
  id: id(),
  customerId: text("customer_id")
    .notNull()
    .references(() => customers.id),
  source: text("source").notNull(),
  description: text("description").notNull(),
  quotationId: text("quotation_id").references(() => quotations.id),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id),
  createdAt: at("created_at"),
});
export const jobs = pgTable(
  "jobs",
  {
    id: id(),
    number: text("number").notNull().unique(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id),
    requestId: text("request_id").references(() => requests.id),
    serviceType: text("service_type").notNull(),
    source: text("source").notNull(),
    description: text("description").notNull(),
    origin: text("origin").notNull(),
    destination: text("destination").notNull(),
    picId: text("pic_id")
      .notNull()
      .references(() => user.id),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    status: jobStatus("status").notNull().default("draft"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    createdAt: at("created_at"),
    updatedAt: at("updated_at"),
  },
  (t) => [
    index("jobs_customer_idx").on(t.customerId),
    index("jobs_status_due_idx").on(t.status, t.dueAt),
  ],
);
export const jobLocations = pgTable(
  "job_locations",
  {
    jobId: text("job_id")
      .primaryKey()
      .references(() => jobs.id),
    originLat: doublePrecision("origin_lat").notNull(),
    originLng: doublePrecision("origin_lng").notNull(),
    destinationLat: doublePrecision("destination_lat").notNull(),
    destinationLng: doublePrecision("destination_lng").notNull(),
    updatedBy: text("updated_by")
      .notNull()
      .references(() => user.id),
    updatedAt: at("updated_at"),
  },
  (t) => [
    check(
      "job_locations_bounds",
      sql`${t.originLat} BETWEEN -90 AND 90 AND ${t.destinationLat} BETWEEN -90 AND 90 AND ${t.originLng} BETWEEN -180 AND 180 AND ${t.destinationLng} BETWEEN -180 AND 180`,
    ),
  ],
);
export const assignments = pgTable(
  "job_assignments",
  {
    id: id(),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    assignedBy: text("assigned_by")
      .notNull()
      .references(() => user.id),
    assignedAt: at("assigned_at"),
  },
  (t) => [
    uniqueIndex("assignment_unique").on(t.jobId, t.userId),
    index("assignment_user_idx").on(t.userId),
  ],
);
export const progress = pgTable("job_progress", {
  id: id(),
  jobId: text("job_id")
    .notNull()
    .references(() => jobs.id),
  actorId: text("actor_id")
    .notNull()
    .references(() => user.id),
  note: text("note").notNull(),
  createdAt: at("created_at"),
});
export const workReports = pgTable(
  "work_reports",
  {
    id: id(),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id),
    progressId: text("progress_id")
      .notNull()
      .unique()
      .references(() => progress.id),
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id),
    note: text("note").notNull(),
    storageKey: text("storage_key").unique(),
    filename: text("filename"),
    mimeType: text("mime_type"),
    size: integer("size"),
    createdAt: at("created_at"),
  },
  (t) => [
    index("work_report_job_idx").on(t.jobId, t.createdAt),
    check(
      "work_report_photo_metadata",
      sql`(${t.storageKey} IS NULL AND ${t.filename} IS NULL AND ${t.mimeType} IS NULL AND ${t.size} IS NULL) OR (${t.storageKey} IS NOT NULL AND ${t.filename} IS NOT NULL AND ${t.mimeType} IS NOT NULL AND ${t.size} IS NOT NULL AND ${t.mimeType} IN ('image/jpeg','image/png','image/webp') AND ${t.size} > 0 AND ${t.size} <= 10485760)`,
    ),
  ],
);
export const documents = pgTable(
  "documents",
  {
    id: id(),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id),
    storageKey: text("storage_key").notNull().unique(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    type: text("type").notNull(),
    version: integer("version").notNull(),
    supersedesId: text("supersedes_id"),
    status: docStatus("status").notNull().default("submitted"),
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => user.id),
    reviewerId: text("reviewer_id").references(() => user.id),
    reviewNote: text("review_note"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: at("created_at"),
  },
  (t) => [
    uniqueIndex("document_version_unique").on(t.jobId, t.type, t.version),
    index("document_job_idx").on(t.jobId),
  ],
);
export const deliveryNotes = pgTable(
  "delivery_notes",
  {
    id: id(),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id),
    recipient: text("recipient").notNull(),
    vehicle: text("vehicle").notNull(),
    cargo: text("cargo").notNull(),
    quantity: integer("quantity").notNull(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }).notNull(),
    note: text("note").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    createdAt: at("created_at"),
  },
  (t) => [check("delivery_quantity_positive", sql`${t.quantity} > 0`)],
);
export const billables = pgTable(
  "billable_items",
  {
    id: id(),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id),
    description: text("description").notNull(),
    approvedAmount: money("approved_amount"),
    currency: text("currency").notNull(),
    taxBps: integer("tax_bps").notNull().default(0),
    termsDays: integer("terms_days").notNull().default(30),
    basis: text("basis").notNull(),
    eligibility: text("eligibility").notNull().default("completion"),
    quotationId: text("quotation_id").references(() => quotations.id),
    approvedBy: text("approved_by").references(() => user.id),
    approvalNote: text("approval_note"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    createdAt: at("created_at"),
  },
  (t) => [
    check("billable_positive", sql`${t.approvedAmount} > 0`),
    check("billable_tax_range", sql`${t.taxBps} BETWEEN 0 AND 10000`),
    index("billable_job_idx").on(t.jobId),
  ],
);
export const invoices = pgTable(
  "invoices",
  {
    id: id(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id),
    number: text("number").unique(),
    status: invoiceStatus("status").notNull().default("draft"),
    currency: text("currency").notNull(),
    taxBps: integer("tax_bps").notNull(),
    termsDays: integer("terms_days").notNull(),
    subtotal: money("subtotal"),
    tax: money("tax"),
    total: money("total"),
    customerSnapshot: jsonb("customer_snapshot"),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    createdAt: at("created_at"),
  },
  (t) => [
    check("invoice_total_valid", sql`${t.total} = ${t.subtotal} + ${t.tax}`),
    index("invoice_status_due_idx").on(t.status, t.dueAt),
  ],
);
export const invoiceItems = pgTable(
  "invoice_items",
  {
    id: id(),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoices.id),
    billableId: text("billable_id")
      .notNull()
      .references(() => billables.id),
    amount: money("amount"),
    description: text("description").notNull(),
  },
  (t) => [
    uniqueIndex("invoice_item_unique").on(t.invoiceId, t.billableId),
    check("invoice_item_positive", sql`${t.amount} > 0`),
    index("invoice_item_billable_idx").on(t.billableId),
  ],
);
export const payments = pgTable(
  "payments",
  {
    id: id(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id),
    amount: money("amount"),
    currency: text("currency").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    method: text("method").notNull(),
    reference: text("reference").notNull().unique(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    createdAt: at("created_at"),
  },
  (t) => [check("payment_positive", sql`${t.amount} > 0`)],
);
export const allocations = pgTable(
  "payment_allocations",
  {
    id: id(),
    paymentId: text("payment_id")
      .notNull()
      .references(() => payments.id),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoices.id),
    amount: money("amount"),
    createdAt: at("created_at"),
  },
  (t) => [
    check("allocation_positive", sql`${t.amount} > 0`),
    uniqueIndex("payment_invoice_unique").on(t.paymentId, t.invoiceId),
    index("allocation_invoice_idx").on(t.invoiceId),
  ],
);
export const corrections = pgTable(
  "invoice_corrections",
  {
    id: id(),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoices.id),
    kind: text("kind").notNull(),
    amount: money("amount"),
    reason: text("reason").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    createdAt: at("created_at"),
  },
  (t) => [check("correction_positive", sql`${t.amount} > 0`)],
);
export const attendance = pgTable(
  "attendance",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    checkIn: at("check_in"),
    checkOut: timestamp("check_out", { withTimezone: true }),
    note: text("note").notNull(),
  },
  (t) => [
    uniqueIndex("one_open_attendance")
      .on(t.userId)
      .where(sql`${t.checkOut} IS NULL`),
  ],
);
export const audit = pgTable(
  "audit_logs",
  {
    id: id(),
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id),
    entity: text("entity").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    createdAt: at("created_at"),
  },
  (t) => [
    index("audit_entity_idx").on(t.entity, t.entityId),
    index("audit_created_idx").on(t.createdAt),
  ],
);
