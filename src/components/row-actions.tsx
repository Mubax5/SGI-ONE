"use client";
import { Button } from "@cloudflare/kumo";
import { DotsThreeIcon } from "@phosphor-icons/react";
import {
  Children,
  cloneElement,
  isValidElement,
  ReactNode,
  useState,
  type ReactElement,
} from "react";
import { usePhoneLayout } from "@/lib/phone-layout";
import { Modal } from "./shared";
export function RowActions({ children }: { children: ReactNode }) {
  const phone = usePhoneLayout();
  const [open, setOpen] = useState(false);
  const nodes = Children.toArray(children).filter(isValidElement);
  if (!phone || nodes.length < 2)
    return <div className="row-actions">{nodes}</div>;
  return (
    <>
      <Button
        variant="ghost"
        shape="square"
        aria-label="Tindakan record"
        icon={<DotsThreeIcon size={22} />}
        onClick={() => setOpen(true)}
      />
      <Modal open={open} onClose={() => setOpen(false)} title="Tindakan record">
        <div className="detail-body row-action-menu">
          {nodes.map((node) => {
            const element = node as ReactElement<{
              onClick?: (event: React.MouseEvent) => void;
              className?: string;
            }>;
            return cloneElement(element, {
              className: `${element.props.className ?? ""} row-action-item`,
              onClick: (event) => {
                setOpen(false);
                element.props.onClick?.(event);
              },
            });
          })}
        </div>
      </Modal>
    </>
  );
}
