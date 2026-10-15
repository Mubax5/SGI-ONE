"use client";
import { Button, LinkButton } from "@cloudflare/kumo";
import type { ComponentProps, ReactNode } from "react";
import { usePhoneLayout } from "@/lib/phone-layout";

type ActionProps = { children: ReactNode; "aria-label": string };
export function ToolbarAction(
  props: ComponentProps<typeof Button> & ActionProps,
) {
  const phone = usePhoneLayout();
  if (phone)
    return (
      <Button
        {...props}
        aria-label={props["aria-label"]}
        shape="square"
        children={undefined}
      />
    );
  return <Button {...props} shape="base" />;
}
export function ToolbarLink(
  props: ComponentProps<typeof LinkButton> & ActionProps,
) {
  const phone = usePhoneLayout();
  return (
    <LinkButton {...props} shape={phone ? "square" : "base"}>
      {phone ? undefined : props.children}
    </LinkButton>
  );
}
