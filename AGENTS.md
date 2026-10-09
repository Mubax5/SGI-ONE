# SGI One - coding agent instructions

This document belongs at the repository root as `AGENTS.md`. It complements the full product requirements document (`SGI_One_PRD_v1.1_Local_Kumo_R2.md`). It is project guidance, not a substitute for the official Cloudflare `kumo-design` skill.

## 1. Product and deployment

- Build a single-tenant internal logistics management prototype for Sandika Global Indonesia (SGI).
- Run the application and PostgreSQL **locally** during development/demo: Next.js on Node.js, PostgreSQL in Docker Compose, Drizzle ORM.
- Use **Better Auth** with PostgreSQL for local authentication and sessions. Never use Supabase or a third-party hosted auth service.
- Use **Cloudflare R2 only for object storage**. R2 bucket is private and all credentials stay on the backend.
- Target an end-to-end demo: customer -> job -> assignment -> document -> review -> draft invoice -> issue -> partial payment -> director dashboard.
- Preserve role and job assignment scoping on **every server-side read and mutation**. UI hiding is not authorization.

## 2. UI and component standards

- Use **Cloudflare Kumo UI**, `@cloudflare/kumo`, as the only component design system.
- Install and follow the **official Kumo design skill**:

  ```bash
  npx skills add cloudflare/kumo@kumo-design
  ```

- Official source: <https://kumo-ui.com/skill/>.
- Review component docs with `npx @cloudflare/kumo doc ComponentName` before implementing unfamiliar props.
- Use `@phosphor-icons/react` for icons. Do not mix with a second icon pack unless there is a verified gap.
- Brand direction: SGI white + orange + black. Proposed, not verified official: white `#FFFFFF`, ink `#171717`, bright orange `#F58220`, accessible CTA orange `#A84306`, orange-tinted panel `#FFF2E8`.
- Map brand values to **Kumo semantic tokens** in one theme override. Avoid page-level raw Tailwind colors and random hex values.
- Default to Kumo light mode (`data-mode="light"`). Dark mode is out of scope for the first 7-day prototype.

## 3. Avoid AI-slop

- No generic SaaS dashboard template, glassmorphism, gradient backgrounds, giant decorative icons, or pointless KPI tiles.
- Do not apply huge border radii or drop shadows everywhere.
- Do not nest `LayerCard` in another `LayerCard`.
- Do not combine borders with drop shadows for a card; use Kumo's ring/border conventions.
- Body, data and control text should be 14px. Larger text is for headings.
- Headings use sentence case, `font-semibold`, and no custom tracking.
- Emphasize actions, real status, dates, ownership, and business consequences rather than decoration.
- Orange is primarily for the primary action and limited brand emphasis; do not use orange for every state.
- Use Kumo dialogs with controlled open state; preserve focus and keyboard behavior.
- Empty states, error messages, and validation must tell staff what to do next.
- SGI logo only. Kumo is the design system, not SGI's brand owner.

## 4. Information architecture

- Desktop app shell: compact sidebar + page header + filters + task-oriented table/forms.
- Field staff pages are mobile-first and assignment-scoped.
- Operations page shows job status and document readiness without navigating through many irrelevant cards.
- Billing screens show customer, billable items, approved amounts, taxes (if applicable), eligibility for issue, and audit.
- Show business statuses as text plus semantic badges, not color alone.

## 5. Secure document handling

- Only backend can access R2 credentials. Never prefix R2 credentials with `NEXT_PUBLIC_`.
- Upload via backend to a private R2 bucket for the MVP, validate file type, max size, filename, current user, and job assignment.
- Store metadata and random object keys in PostgreSQL. Never use client-provided path as the object key.
- Download endpoint must re-check permissions against the job/document every request.
- Do not mark an upload verified before an authorized reviewer checks it.
- Handle R2 errors explicitly; no false success UI or dangling verified DB record.

## 6. Finance integrity

- Draft invoice may be created early; issue validation is stricter.
- Multiple jobs may be combined only when they belong to the same customer and have compatible terms.
- One billable item can be referenced in draft invoices, but issuing must atomically prevent exceeding the approved amount.
- PostgreSQL transactions/locking are mandatory for invoice issue and payment allocations.
- Money is stored as integer minor units, never floating point.
- Issued invoice details are not silently overwritten; adjustments require controlled corrections and audit logs.

## 7. Change process

1. Check PRD feature ID and acceptance criterion.
2. Implement the narrowest server-side rule and associated DB change.
3. Build Kumo UI with real loading, empty, error, and success states.
4. Test unauthorized access and domain edge cases.
5. Run typecheck, lint, tests, and build.
6. Recheck desktop and mobile screenshots for overflow, design consistency, and accessibility.

## 8. Official references

- Kumo installation: <https://kumo-ui.com/installation/>
- Kumo colors: <https://kumo-ui.com/colors/>
- Kumo design skill: <https://kumo-ui.com/skill/>
- R2 S3 JS SDK v3: <https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/>
- Better Auth Next.js: <https://better-auth.com/docs/integrations/next>
