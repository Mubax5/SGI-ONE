"use client";
import {
  Badge,
  Banner,
  Empty as KumoEmpty,
  InputArea,
  Text,
  Button,
  Dialog,
  Input,
  LayerCard,
  Select,
} from "@cloudflare/kumo";
import { XIcon, ArrowClockwiseIcon } from "@phosphor-icons/react";
import { ReactNode, useId } from "react";
import { statuses } from "@/lib/domain";
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
export function Empty({
  text = "Belum ada data. Tambahkan data untuk memulai alur kerja.",
}: {
  text?: string;
}) {
  return (
    <KumoEmpty className="empty" title="Belum ada data" description={text} />
  );
}
export function Feedback({
  error,
  success,
}: {
  error?: string;
  success?: string;
}) {
  return error ? (
    <div className="feedback" role="alert">
      <Banner variant="error" description={error} />
    </div>
  ) : success ? (
    <div className="feedback" role="status">
      <Banner variant="secondary" description={success} />
    </div>
  ) : null;
}
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <Dialog size="xl" className="modal">
        <div className="modal-header">
          <div>
            <Dialog.Title className="text-xl font-semibold">
              {title}
            </Dialog.Title>
            <Dialog.Description className="mt-1.5 text-sm text-kumo-subtle">
              {description}
            </Dialog.Description>
          </div>
          <Button
            variant="ghost"
            shape="square"
            icon={<XIcon size={18} />}
            aria-label="Tutup dialog"
            onClick={onClose}
          />
        </div>
        {children}
      </Dialog>
    </Dialog.Root>
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
export function Refresh({
  onClick,
  loading,
}: {
  onClick: () => void;
  loading: boolean;
}) {
  return (
    <Button
      aria-label="Muat ulang data"
      variant="secondary"
      size="sm"
      icon={<ArrowClockwiseIcon size={16} />}
      loading={loading}
      onClick={onClick}
    >
      Muat ulang
    </Button>
  );
}
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const isForm = body instanceof FormData;
  const response = await fetch(`/api/${path}`, {
    method: body === undefined ? "GET" : "POST",
    ...(body === undefined
      ? {}
      : {
          body: isForm ? body : JSON.stringify(body),
          headers: isForm ? {} : { "Content-Type": "application/json" },
        }),
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error ?? "Operasi gagal. Coba lagi.");
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
