# Keychats Signup Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Keychats’ primary invite-link onboarding with a public signup-request flow where `cxu1344` approves or rejects applicants before they receive workspace access.

**Architecture:** A public server action creates a Supabase Auth user and a private `signup_requests` row, but no Keychats profile or channel membership. Admin-only actions review pending requests; approval atomically creates profile/settings/general membership through a database RPC. Rejection first records a retryable rejected state, then deletes the Auth identity; `on delete set null` clears the stored Auth ID only after deletion succeeds.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase Auth/Postgres/RLS, pgTAP, Vitest, Playwright, Vercel.

**Spec:** `docs/superpowers/specs/2026-10-22-keychats-signup-approval-design.md`

## Completion Status — 2026-10-22

Implemented and verified:
- public signup requests with server-side Auth creation and compensation cleanup
- private `signup_requests` table plus server-only approve/reject RPCs
- immediate `/chats` login form and `/chats/signup` request form
- admin approval/rejection UI with legacy invite flow retained as fallback
- production migration applied only to Keychats Supabase project `otcohkelaqajomlashgy`
- Keychats CI run `39741979663` passed database, unit, production build, and Playwright E2E steps on application SHA `48dcb39a78f8e002e57b840a28362c0a4d8d5d25`
- production Keychats deployment `dpl_A42QbVtHzf8kKniJKYd6Qev2smgo` is READY
- `whogh.vercel.app` host deployment `dpl_CacKunimNqH4nFjDpKHbJYCgZBnB` is READY with a visible Keychats entry link
- production smoke: `/`, `/chats`, `/chats/signup` return 200; no recent fatal/error runtime logs

Remaining operational bootstrap:
- create the sole administrator `cxu1344` through the official Supabase Auth path, then provision/promote its workspace profile. The supplied password must not be committed, printed, or sent through unsafe tooling.

## Global Constraints

- Apply schema/data changes only to Keychats Supabase project `otcohkelaqajomlashgy`; never write to PlanDoSee project `rluscctcdfqrrfaxdeya`.
- Never store applicant passwords outside Supabase Auth and never expose `SUPABASE_SECRET_KEY` to browser code.
- Pending applicants have no `profiles`, `user_settings`, or `channel_members` rows.
- Approval must be atomic; failure leaves the request pending and the Auth user intact.
- Rejection must remain retryable if Auth deletion fails: keep `auth_user_id` on the rejected row until Auth deletion succeeds.
- A rejected username may be requested again after its Auth identity is removed; only pending requests reserve a username.
- Keep existing invite-link code/tests as fallback; do not weaken existing security expectations.
- `/chats` shows login immediately and a visible `가입 요청` path.
- Existing `/`, `/pds/`, PlanDoSee rewrites, and PlanDoSee Supabase remain unchanged.
- Admin ID remains `cxu1344`; the password must never be committed or printed.

## Review Focus

- Concurrent same-ID signup requests leave exactly one pending request/Auth identity and no orphan user.
- Missing `general` during approval rolls back every workspace write and keeps the request pending.
- Pending login authenticates at Auth at most, then is signed out because no active profile exists.
- Auth deletion failure after rejection leaves an inaccessible rejected request with `auth_user_id` retained so cleanup can be retried.
- After successful rejection cleanup, the same username can submit a new pending request.

---

### Task 1: Signup-request schema and atomic review RPCs — COMPLETE

Created `keychats/supabase/migrations/20261022072200_signup_requests.sql` and pgTAP coverage. Database gate passes 70 tests.

### Task 2: Public signup-request service with compensation — COMPLETE

Created `signup-requests.ts` and Supabase adapter with validation, duplicate handling, and Auth cleanup.

### Task 3: Public `/chats` login + signup request UI — COMPLETE

`/chats` renders login directly and links to `/chats/signup`; signup request action/form implemented.

### Task 4: Admin signup-review service and actions — COMPLETE

Admin-only list/approve/reject actions implemented; reviewer ID is derived from authenticated admin claims.

### Task 5: Admin signup-request UI and lifecycle — COMPLETE

Pending request list and approve/reject controls added; legacy invite controls remain as fallback.

### Task 6: `whogh.vercel.app` Keychats entry link — COMPLETE

Visible hero and footer links to `/chats` added in `graypork/aleph` while existing rewrites are preserved.

### Task 7: Full regression, hosted migration, and security verification — COMPLETE

CI is green. Hosted migration is applied only to Keychats. Advisor findings are INFO-only: RLS-without-policy on intentionally service-role-only tables and fresh-project unused-index/performance notices.

### Task 8: Administrator bootstrap, deployment, and production smoke — PARTIAL

Deployments and production smoke are complete. Sole-admin Auth bootstrap remains because the administrator password must be entered through an official Auth path rather than committed or passed through blocked tooling.
