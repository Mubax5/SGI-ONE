"use client";
import { Badge, LayerCard, Loader, Text } from "@cloudflare/kumo";
import { ReactNode } from "react";
export function PageHeader({
  title,
  description,
  context,
  template = "standard",
  status,
  actions,
}: {
  title: string;
  description?: string;
  context?: string;
  template?: "standard" | "report";
  status?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-heading" data-template={template}>
      <div className="page-title-group">
        {context && (
          <Text variant="secondary" DANGEROUS_className="eyebrow">
            {context}
          </Text>
        )}
        <div className="page-title-line">
          <Text as="h1" variant="heading" size="lg">
            {title}
          </Text>
          {status}
        </div>
        {description && <Text variant="secondary">{description}</Text>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
export function CollectionPanel({
  title,
  description,
  count,
  toolbar,
  children,
}: {
  title: string;
  description?: string;
  count?: number;
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  return (
    <LayerCard className="module-panel">
      <LayerCard.Secondary className="collection-heading">
        <div className="collection-title">
          <Text as="h2" variant="heading">
            {title}
          </Text>
          {count !== undefined && (
            <Badge className="sgi-badge" variant="secondary">
              {count}
            </Badge>
          )}
        </div>
        {description && <Text variant="secondary">{description}</Text>}
      </LayerCard.Secondary>
      <LayerCard.Primary className="module-panel-body">
        {toolbar && <div className="collection-toolbar">{toolbar}</div>}
        {children}
      </LayerCard.Primary>
    </LayerCard>
  );
}
export function LoadingState({
  text = "Memuat data transaksi…",
}: {
  text?: string;
}) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <Loader size="base" />
      <Text variant="secondary">{text}</Text>
    </div>
  );
}
export function RecordFacts({
  items,
  className = "",
}: {
  items: { label: string; value: ReactNode }[];
  className?: string;
}) {
  return (
    <dl className={`record-facts ${className}`}>
      {items.map(({ label, value }) => (
        <div key={label}>
          <Text as="dt" variant="secondary">
            {label}
          </Text>
          <Text as="dd">{value}</Text>
        </div>
      ))}
    </dl>
  );
}
