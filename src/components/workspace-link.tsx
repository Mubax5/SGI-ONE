"use client";
import Link from "next/link";
import { forwardRef, type ComponentProps } from "react";
import { cleanWorkspaceHref } from "@/lib/workspace-url";
export const WorkspaceLink = forwardRef<
  HTMLAnchorElement,
  ComponentProps<typeof Link>
>(function WorkspaceLink({ href, ...props }, ref) {
  return (
    <Link
      ref={ref}
      href={typeof href === "string" ? cleanWorkspaceHref(href) : href}
      {...props}
    />
  );
});
