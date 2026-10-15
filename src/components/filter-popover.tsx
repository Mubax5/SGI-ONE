"use client";
import { Button, Popover } from "@cloudflare/kumo";
import { Popover as PopoverPrimitive } from "@cloudflare/kumo/primitives/popover";
import { FunnelIcon } from "@phosphor-icons/react";
import { useRef, useState, type ReactNode } from "react";
import { usePhoneLayout } from "@/lib/phone-layout";

/** Desktop filters share one anchored Kumo surface; phone controls stay in place. */
export function FilterPopover({
  children,
  active = false,
  label = "Filter data",
  align = "end",
}: {
  children: ReactNode;
  active?: boolean;
  label?: string;
  align?: "start" | "end";
}) {
  const phone = usePhoneLayout();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  if (phone) return children;
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        // Make space below a low trigger before opening, rather than moving the filter to another side.
        if (
          next &&
          trigger.current &&
          window.innerHeight - trigger.current.getBoundingClientRect().bottom <
            264
        ) {
          trigger.current.scrollIntoView({
            block: "start",
            behavior: "instant",
          });
        }
        setOpen(next);
      }}
    >
      <Popover.Trigger
        render={
          <Button
            ref={trigger}
            type="button"
            shape="square"
            variant={active ? "secondary" : "outline"}
            icon={<FunnelIcon size={18} weight={active ? "fill" : "regular"} />}
            aria-label={label}
            className="desktop-filter-trigger"
          />
        }
      />
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          side="bottom"
          align={align}
          sideOffset={8}
          positionMethod="fixed"
          collisionPadding={16}
          collisionAvoidance={{
            side: "none",
            align: "shift",
            fallbackAxisSide: "none",
          }}
          className="desktop-filter-positioner"
        >
          <PopoverPrimitive.Popup
            className="desktop-filter-popover flex flex-col rounded-lg bg-kumo-base text-sm text-kumo-default shadow-md outline outline-kumo-line"
            data-kumo-component="Popover"
            data-kumo-part="content"
          >
            <Popover.Title className="shrink-0 font-semibold">
              {label}
            </Popover.Title>
            <div className="desktop-filter-options">{children}</div>
            <div className="desktop-filter-footer">
              <Popover.Close render={<Button variant="primary" />}>
                Selesai
              </Popover.Close>
            </div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </Popover>
  );
}
