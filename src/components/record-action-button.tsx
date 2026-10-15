"use client";
import { Button } from "@cloudflare/kumo";
import type { Icon } from "@phosphor-icons/react";
import { usePhoneLayout } from "@/lib/phone-layout";
export function RecordActionButton({
  label,
  icon: Icon,
  onClick,
  className = "",
}: {
  label: string;
  icon: Icon;
  onClick: () => void;
  className?: string;
}) {
  const phone = usePhoneLayout();
  return (
    <Button
      size="sm"
      variant={phone ? "ghost" : undefined}
      className={`compact-row-action ${className}`}
      aria-label={label}
      icon={phone ? <Icon size={18} /> : undefined}
      onClick={onClick}
    >
      <span className="compact-row-action-label">{label}</span>
    </Button>
  );
}
