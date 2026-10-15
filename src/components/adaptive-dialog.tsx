"use client";
import { Button, Dialog } from "@cloudflare/kumo";
import { XIcon } from "@phosphor-icons/react";
import { CSSProperties, ReactNode, useRef, useState } from "react";

export function AdaptiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = "xl",
  className = "",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: "sm" | "base" | "lg" | "xl";
  className?: string;
}) {
  const origin = useRef<{ y: number; time: number } | null>(null);
  const distance = useRef(0);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog
        size={size}
        className={`modal adaptive-dialog ${className}`}
        data-dragging={dragging || undefined}
        style={{ "--sheet-drag": `${drag}px` } as CSSProperties}
      >
        <Button
          variant="ghost"
          className="sheet-handle"
          aria-label="Geser atau ketuk untuk menutup panel"
          onPointerDown={(e) => {
            origin.current = { y: e.clientY, time: performance.now() };
            distance.current = 0;
            e.currentTarget.setPointerCapture(e.pointerId);
            setDragging(true);
          }}
          onPointerMove={(e) => {
            if (origin.current) {
              distance.current = Math.max(0, e.clientY - origin.current.y);
              setDrag(distance.current);
            }
          }}
          onPointerCancel={() => {
            origin.current = null;
            setDrag(0);
            setDragging(false);
          }}
          onPointerUp={() => {
            if (!origin.current) return;
            const velocity =
              distance.current /
              Math.max(1, performance.now() - origin.current.time);
            if (
              distance.current > 90 ||
              (distance.current > 35 && velocity > 0.5)
            )
              onOpenChange(false);
            origin.current = null;
            setDragging(false);
            setDrag(0);
          }}
          onClick={(e) => {
            if (!e.detail || distance.current < 5) onOpenChange(false);
          }}
        >
          <span className="sheet-handle-bar" aria-hidden="true" />
        </Button>
        <div className="modal-header">
          <div>
            <Dialog.Title>{title}</Dialog.Title>
            {description && (
              <Dialog.Description>{description}</Dialog.Description>
            )}
          </div>
          <Button
            variant="ghost"
            shape="square"
            icon={<XIcon size={18} />}
            aria-label="Tutup dialog"
            onClick={() => onOpenChange(false)}
          />
        </div>
        {children}
      </Dialog>
    </Dialog.Root>
  );
}
