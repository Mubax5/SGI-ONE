"use client";
import {
  Badge,
  Banner,
  InputArea,
  Text,
  Input,
  LayerCard,
  Select,
} from "@cloudflare/kumo";
import { AdaptiveDialog } from "./adaptive-dialog";
import { ReactNode, useId, useEffect, useState } from "react";
import { statuses } from "@/lib/domain";
import { announceChange, workspaceHeaders } from "@/lib/live-data";
export function SectionPanel({
  title,
  description,
  action,
  children,
  id,
  className = "",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  const headingId = useId();
  return (
    <LayerCard
      render={<section aria-labelledby={headingId} />}
      id={id}
      className={`section-panel ${className}`}
    >
      <LayerCard.Secondary className="section-panel-heading">
        <div>
          <Text as="h2" variant="heading" id={headingId}>
            {title}
          </Text>
          {description && <Text variant="secondary">{description}</Text>}
        </div>
        {action && <div className="section-panel-action">{action}</div>}
      </LayerCard.Secondary>
      <LayerCard.Primary className="section-panel-body">
        {children}
      </LayerCard.Primary>
    </LayerCard>
  );
}
export function Status({ value }: { value: string }) {
  const variant = [
    "verified",
    "completed",
    "paid",
    "approved",
    "active",
  ].includes(value)
    ? "success"
    : ["rejected", "cancelled", "void", "overdue"].includes(value)
      ? "error"
      : ["submitted", "partially_paid"].includes(value)
        ? "warning"
        : ["assigned", "in_progress", "issued"].includes(value)
          ? "info"
          : "secondary";
  return (
    <Badge className="sgi-badge" variant={variant}>
      {statuses[value] ?? value}
    </Badge>
  );
}
export const dateText = (s: string | null | undefined, time = false) =>
  s
    ? new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        ...(time ? { timeStyle: "short" } : {}),
        timeZone: "Asia/Jakarta",
      }).format(new Date(s))
    : "—";
export function Feedback({
  error,
  success,
}: {
  error?: string;
  success?: string;
}) {
  const [visible, setVisible] = useState(success);
  useEffect(() => {
    const start = window.setTimeout(() => setVisible(success), 0);
    const expiry = window.setTimeout(() => setVisible(undefined), 5000);
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(expiry);
    };
  }, [success]);
  return error ? (
    <div className="feedback" role="alert">
      <Banner variant="error" description={error} />
    </div>
  ) : visible ? (
    <div className="feedback" role="status">
      <Banner variant="secondary" description={visible} />
    </div>
  ) : null;
}
export function Modal({
  open,
  onClose,
  title,
  description,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <AdaptiveDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={title}
      description={description}
      className={className}
    >
      {children}
    </AdaptiveDialog>
  );
}
export function Choice({
  label,
  value,
  onChange,
  items,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  items: Record<string, string>;
  required?: boolean;
}) {
  return (
    <Select<string>
      label={label}
      value={value || null}
      onValueChange={(v) => onChange(v ?? "")}
      items={items}
      placeholder="Pilih…"
      required={required}
      className="w-full"
    />
  );
}
export function TextField({
  label,
  value,
  onChange,
  type = "text",
  required = true,
  description,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  type?: string;
  required?: boolean;
  description?: string;
}) {
  if (type === "textarea")
    return (
      <InputArea
        label={label}
        value={value}
        onValueChange={onChange}
        required={required}
        description={description}
        rows={3}
        className="w-full"
      />
    );
  return (
    <Input
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      type={type}
      required={required}
      description={description}
      className="w-full"
    />
  );
}
export { DataTable } from "./data-table";
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const isForm = body instanceof FormData;
  const response = await fetch(`/api/${path}`, {
    method: body === undefined ? "GET" : "POST",
    ...(body === undefined
      ? {}
      : {
          body: isForm ? body : JSON.stringify(body),
        }),
    headers: {
      ...workspaceHeaders(),
      ...(!isForm && body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
    },
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error ?? "Operasi gagal. Coba lagi.");
  if (body !== undefined) announceChange();
  return result as T;
}
export function filterRows<T>(
  rows: T[],
  search: string,
  stringify: (row: T) => string,
) {
  const query = search.trim().toLocaleLowerCase("id-ID");
  return rows.filter((r) =>
    stringify(r).toLocaleLowerCase("id-ID").includes(query),
  );
}
