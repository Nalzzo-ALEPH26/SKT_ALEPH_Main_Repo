# Keychats Signup Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Keychats’ primary invite-link onboarding with a public signup-request flow where `cxu1344` approves or rejects applicants before they receive workspace access.

**Architecture:** A public server action creates a Supabase Auth user and a private `signup_requests` row, but no Keychats profile or channel membership. Admin-only actions review pending requests; approval atomically creates profile/settings/general membership through a database RPC. Rejection first records a retryable rejected state, then deletes the Auth identity; `on delete set null` clears the stored Auth ID only after deletion succeeds.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase Auth/Postgres/RLS, pgTAP, Vitest, Playwright, Vercel.

**Spec:** `docs/superpowers/specs/2026-10-22-keychats-signup-approval-design.md`

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

### Task 1: Signup-request schema and atomic review RPCs

**Files:**
- Create: `keychats/supabase/migrations/20261022_signup_requests.sql`
- Create: `keychats/supabase/tests/database/signup_requests.test.sql`

**Interfaces:**
- Produces `public.signup_requests`.
- Produces `approve_signup_request_server(target_request_id uuid, reviewer_user_id uuid, at_time timestamptz) returns boolean`.
- Produces `reject_signup_request_server(target_request_id uuid, reviewer_user_id uuid, at_time timestamptz) returns uuid`.

- [ ] **Step 1: Write failing pgTAP tests** for schema/status constraints, `auth_user_id ... on delete set null`, pending-only username uniqueness, no anon/authenticated table or function privileges, atomic approval, duplicate approval safety, missing-general rollback, rejection audit retention, and rejected cleanup retry state.
- [ ] **Step 2: Run RED** with `cd keychats && supabase test db`; expected new signup-request tests fail while existing tests stay green.
- [ ] **Step 3: Implement migration.** `signup_requests` fields: `id`, nullable unique `auth_user_id`, `username`, `display_name`, `status`, `requested_at`, `reviewed_at`, `reviewed_by`. Add SQL username/display-name checks and a partial unique index on `username where status='pending'`. Revoke table and RPC execution from `public`, `anon`, and `authenticated`; RPCs are server/admin-only with fixed `search_path`.
- [ ] **Step 4: Implement approval RPC.** Lock a pending request, resolve `general`, reject active username conflicts, insert profile/settings/general membership, mark approved with reviewer metadata, and commit as one transaction.
- [ ] **Step 5: Implement rejection RPC.** For a pending request, mark rejected and retain `auth_user_id`; for an already rejected request with non-null `auth_user_id`, return that same ID for cleanup retry. Never create workspace rows.
- [ ] **Step 6: Run GREEN** with `cd keychats && supabase test db`; all database tests pass.
- [ ] **Step 7: Commit** `feat: add signup request approval schema`.

---

### Task 2: Public signup-request service with compensation

**Files:**
- Create: `keychats/src/lib/auth/signup-requests.ts`
- Create: `keychats/src/lib/auth/signup-requests-supabase.ts`
- Create: `keychats/tests/unit/signup-requests.test.ts`
- Create: `keychats/tests/unit/signup-requests-supabase.test.ts`

**Interfaces:**
- `SignupRequestInput = { loginId: string; displayName: string; password: string }`
- `validateSignupRequestInput(input)`
- `submitSignupRequest(deps, input)`
- `submitSupabaseSignupRequest(admin, input)`

- [ ] **Step 1: Write failing tests** for lowercase normalization, username 3–24, display name 1–60, password 8–72, generic conflict behavior, persistence-failure Auth cleanup, and concurrent duplicate cleanup.
- [ ] **Step 2: Run RED** with `cd keychats && npm test -- --run tests/unit/signup-requests.test.ts tests/unit/signup-requests-supabase.test.ts`.
- [ ] **Step 3: Implement pure service** using existing login-ID rules; create Auth only after validation/prechecks and delete the newly created Auth identity if request persistence fails.
- [ ] **Step 4: Implement Supabase adapter** with `auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { role: 'member' } })`; check active profiles/pending requests; insert only request metadata; map duplicate/Auth conflicts to stable generic domain errors.
- [ ] **Step 5: Run GREEN** with the focused unit command.
- [ ] **Step 6: Commit** `feat: add public signup request service`.

---

### Task 3: Public `/chats` login + signup request UI

**Files:**
- Modify: `keychats/src/components/login-form.tsx`
- Modify: `keychats/src/app/page.tsx`
- Modify: `keychats/src/app/login/page.tsx`
- Create: `keychats/src/app/signup/page.tsx`
- Create: `keychats/src/app/signup/actions.ts`
- Modify: `keychats/tests/e2e/base-path.spec.ts`
- Create: `keychats/tests/e2e/signup-request.spec.ts`

**Interfaces:**
- Consumes `submitSupabaseSignupRequest`.
- Produces `/chats` immediate login, `/chats/signup`, and `requestSignup(previousState, formData)`.

- [ ] **Step 1: Write E2E RED** asserting `/chats` immediately shows login ID/password plus `가입 요청`; signup form submits and shows approval-pending confirmation; pending login cannot reach workspace.
- [ ] **Step 2: Run RED** with `cd keychats && npx playwright test tests/e2e/base-path.spec.ts tests/e2e/signup-request.spec.ts`.
- [ ] **Step 3: Implement `requestSignup`** as a server action that creates the admin client server-side, calls Task 2, and returns generic Korean validation/conflict errors.
- [ ] **Step 4: Implement signup page and shared login form.** `/chats` and `/chats/login` both render `LoginForm`; the form includes a visible `/signup` link; successful signup replaces the form with a pending-approval message and login link.
- [ ] **Step 5: Run GREEN** with the focused Playwright command.
- [ ] **Step 6: Commit** `feat: add signup request page`.

---

### Task 4: Admin signup-review service and actions

**Files:**
- Create: `keychats/src/lib/admin/signup-requests.ts`
- Create: `keychats/src/lib/admin/signup-requests-supabase.ts`
- Create: `keychats/tests/unit/admin-signup-requests.test.ts`
- Modify: `keychats/src/app/(workspace)/admin/admin-actions.ts`
- Modify: `keychats/tests/unit/admin-actions.test.ts`

**Interfaces:**
- `PendingSignupRequest`
- `listPendingSignupRequests(repository)`
- `approveSignupRequest(repository, requestId, reviewerId)`
- `rejectSignupRequest(repository, requestId, reviewerId)`
- Guarded actions: `listSignupRequestsAction`, `approveSignupRequestAction`, `rejectSignupRequestAction`.

- [ ] **Step 1: Write RED tests** for pending listing, approval RPC delegation, rejection state then Auth deletion, retrying an already rejected row when deletion previously failed, admin authorization, approval retry, and missing-general propagation.
- [ ] **Step 2: Run RED** with `cd keychats && npm test -- --run tests/unit/admin-signup-requests.test.ts tests/unit/admin-actions.test.ts`.
- [ ] **Step 3: Implement repository/service.** Rejection calls the RPC to obtain retained `auth_user_id`, attempts `auth.admin.deleteUser`, and relies on FK `on delete set null`; if deletion fails, surface an error but keep the row rejected with the ID intact for retry.
- [ ] **Step 4: Add guarded server actions.** Derive `reviewerId` from the authenticated admin session/profile; never accept reviewer IDs from the browser.
- [ ] **Step 5: Run GREEN** with the focused unit command.
- [ ] **Step 6: Commit** `feat: add admin signup review actions`.

---

### Task 5: Admin signup-request UI and end-to-end lifecycle

**Files:**
- Modify: `keychats/src/app/(workspace)/admin/page.tsx`
- Modify: `keychats/src/components/admin-panel.tsx`
- Modify: `keychats/tests/e2e/acceptance.spec.ts`

**Interfaces:**
- Consumes Task 4 review actions.
- Produces a primary `가입 요청` admin section; legacy invite UI remains below as fallback.

- [ ] **Step 1: Extend acceptance E2E to RED.** Submit applicant, deny preapproval login, approve from admin, log in with original password and enter `general`; reject a second applicant, verify no login, retry same username as a fresh request. Include an Auth-delete-failure unit path from Task 4 rather than forcing that failure in browser E2E.
- [ ] **Step 2: Run RED** with `cd keychats && npx playwright test tests/e2e/acceptance.spec.ts`.
- [ ] **Step 3: Add AdminPanel request section** with ID/display name/request time, `승인`/`거절`, stable error copy, and local removal/refresh on success.
- [ ] **Step 4: Load pending requests server-side** after `requireAdmin` and pass them with existing users/invites.
- [ ] **Step 5: Run GREEN** with the acceptance spec.
- [ ] **Step 6: Commit** `feat: add signup approvals to admin`.

---

### Task 6: `whogh.vercel.app` Keychats entry link

**Files in separate repo `graypork/aleph`:**
- Modify: `index.html` on `feature/keychats-host`
- Modify only if needed: `src/style.css`

- [ ] **Step 1: Verify current host page lacks an `href="/chats"` entry point.**
- [ ] **Step 2: Add a visible `Keychats 들어가기` link** in the existing hero/evidence visual language; preserve the Money Saju link and all other content.
- [ ] **Step 3: Preview verify** `/` link, `/chats` proxy, and `/pds/` 200; do not change existing PDS rewrites.
- [ ] **Step 4: Commit** `feat: add Keychats entry point`.

---

### Task 7: Full regression, hosted migration, and security verification

- [ ] **Step 1: Run full gate** `cd keychats && supabase test db && npm test && npm run build && npm run test:e2e`; expected all PASS.
- [ ] **Step 2: Secret/isolation review.** Confirm no production secret/admin password committed and no change targets `rluscctcdfqrrfaxdeya`.
- [ ] **Step 3: Apply only the new migration** to Keychats project `otcohkelaqajomlashgy`; verify table/RPCs.
- [ ] **Step 4: Re-run Supabase security/performance advisors**; document findings without weakening security to silence INFO warnings.
- [ ] **Step 5: Commit any required verification docs** as `chore: finalize signup approval verification`.

---

### Task 8: Administrator bootstrap, deployment, and production smoke

**Reuse:** `keychats/scripts/bootstrap-admin.ts`, `keychats/src/lib/auth/bootstrap-admin.ts`.

- [ ] **Step 1: Query production Keychats for `cxu1344`.** If absent, bootstrap through the existing server-side mechanism using the supplied password out-of-band; never put it in git, URL parameters, or logs.
- [ ] **Step 2: Verify admin resources**: Auth role `admin`, active profile, settings, and default `general` membership.
- [ ] **Step 3: Deploy `feature/keychats-v1`** to the separate `keychats` Vercel project and wait for READY with clean runtime logs.
- [ ] **Step 4: Smoke-test through `whogh.vercel.app/chats`**: immediate login form, signup request, pending denial, admin approval, approved login, rejection, static assets, no unexpected 5xx.
- [ ] **Step 5: Deploy the host entry-link commit** and verify `https://whogh.vercel.app/`, `/chats`, `/chats/login`, and `/pds/`.
- [ ] **Step 6: Final report** with Keychats/host SHAs, DB/unit/E2E counts, deployment IDs, admin bootstrap status, advisor findings, and explicit PlanDoSee isolation confirmation.
