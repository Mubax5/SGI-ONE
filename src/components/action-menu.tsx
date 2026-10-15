"use client";
import { Button, DropdownMenu } from "@cloudflare/kumo";
import { DotsThreeIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { usePhoneLayout } from "@/lib/phone-layout";
import { Modal } from "./shared";
type Action = { label: string; onSelect: () => void; disabled?: boolean };
export function ActionMenu({
  actions,
  label = "Tindakan lainnya",
}: {
  actions: Action[];
  label?: string;
}) {
  const mobile = usePhoneLayout();
  const [open, setOpen] = useState(false);
  if (!actions.length) return null;
  const trigger = (
    <Button
      variant="outline"
      shape="square"
      icon={<DotsThreeIcon size={22} />}
      aria-label={label}
      onClick={mobile ? () => setOpen(true) : undefined}
    />
  );
  return mobile ? (
    <>
      {trigger}
      <Modal open={open} onClose={() => setOpen(false)} title={label}>
        <div className="detail-body action-menu-list">
          {actions.map((action) => (
            <Button
              key={action.label}
              variant="ghost"
              disabled={action.disabled}
              onClick={() => {
                setOpen(false);
                action.onSelect();
              }}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </Modal>
    </>
  ) : (
    <DropdownMenu>
      <DropdownMenu.Trigger render={trigger} />
      <DropdownMenu.Content>
        <DropdownMenu.Group>
          {actions.map((action) => (
            <DropdownMenu.Item
              key={action.label}
              disabled={action.disabled}
              onClick={action.onSelect}
            >
              {action.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Group>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
