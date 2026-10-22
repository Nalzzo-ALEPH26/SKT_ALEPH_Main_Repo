# Keychats Signup Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Keychats’ primary invite-link onboarding with a public signup-request flow where `cxu1344` approves or rejects applicants before they receive workspace access.

**Architecture:** A public server action creates a Supabase Auth user and a private `signup_requests` row, but no Keychats profile or channel membership. Admin-only server actions review pending requests; approval uses a database RPC to atomically create `profiles`, `user_settings`, and `general` membership and mark the request approved, while rejection preserves a minimal audit row and deletes the Auth identity. Existing login guards remain the gate: pending users have no active profile and therefore cannot enter the workspace.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase Auth/Postgres/RLS, pgTAP, Vitest, Playwright, Vercel.

**Spec:** `docs/superpowers/specs/2026-10-22-keychats-signup-approval-design.md`

## Global Constraints

- Apply schema/data changes only to Keychats Supabase project `otcohkelaqajomlashgy`; never write to PlanDoSee Supabase project `rluscctcdfqrrfaxdeya`.
- Never store applicant passwords in `signup_requests` or any public table; only Supabase Auth receives the plaintext password and stores its hash.
- Never expose `SUPABASE_SECRET_KEY` or an admin client in browser code.
- Pending applicants must have no `profiles` row, `user_settings` row, or `channel_members` row.
- Approval must atomically provision profile/settings/general membership and mark the request approved.
- Rejection must preserve a minimal audit record while deleting the unapproved Auth identity.
- `username` conflicts must be blocked for active users and currently pending requests, while a rejected request must not permanently reserve the username.
- Existing invite-link code remains available as compatibility/fallback code; do not weaken or delete existing security tests.
- `/chats` must show the login form immediately and provide a visible signup-request path.
- Existing `/`, `/pds/`, and PlanDoSee rewrites on `whogh.vercel.app` must remain unchanged.
- Production administrator ID remains `cxu1344`; no administrator password may be committed or printed in logs.

## Review Focus

- Concurrent requests for the same login ID: exactly one pending/Auth account survives; the other returns a generic conflict and leaves no orphan Auth user.
- Approval retry after a transient failure: request remains `pending`, Auth user remains intact, and no partial profile/settings/membership rows remain.
- Rejected username reuse: a later applicant can request the same username after the rejected Auth identity is removed.
- Pending-user login attempt: Auth may accept the password, but the application must sign the user back out and deny workspace access because no active profile exists.
- Missing `general` channel during approval: approval fails atomically, request stays pending, and no partial workspace rows are created.

---

### Task 1: Signup-request schema and atomic review RPCs

**Files:**
- Create: `keychats/supabase/migrations/20261022_signup_requests.sql`
- Create: `keychats/supabase/tests/database/signup_requests.test.sql`

**Interfaces:**
- Consumes: existing `profiles`, `user_settings`, `channels`, `channel_members`, and `auth.users` schema.
- Produces: `public.signup_requests`; `public.approve_signup_request_server(uuid, uuid, timestamptz)`; `public.reject_signup_request_server(uuid, uuid, timestamptz)`.

- [ ] **Step 1: Write failing pgTAP tests**

Assert that `signup_requests` exists with `pending|approved|rejected` status, `auth_user_id` is nullable and `on delete set null`, anon/authenticated have no direct privileges, only one pending request may exist per username, rejected usernames can be reused, approval provisions profile/settings/general membership plus review metadata atomically, duplicate approval does not provision twice, and missing `general` leaves the request pending with no partial rows.

- [ ] **Step 2: Run the database tests and verify RED**

Run: `cd keychats && supabase test db`

Expected: existing tests pass and new signup-request assertions fail because the table/RPCs do not exist.

- [ ] **Step 3: Implement migration**

Create `signup_requests` with fields `id`, nullable unique `auth_user_id`, `username`, `display_name`, `status`, `requested_at`, `reviewed_at`, `reviewed_by`; validate username/display-name formats in SQL; revoke all table privileges from `anon, authenticated`; add a partial unique index on `username where status = 'pending'`; add an additional conflict guard so an existing `profiles.username` cannot be requested.

Implement `approve_signup_request_server(target_request_id uuid, reviewer_user_id uuid, at_time timestamptz) returns boolean` as a `security definer` function with fixed `search_path`. It must lock the pending request, resolve `general`, reject conflicts, insert profile/settings/general membership, update request review state, and return `true`; any error rolls back all writes.

Implement `reject_signup_request_server(target_request_id uuid, reviewer_user_id uuid, at_time timestamptz) returns uuid` to lock the pending request, mark it rejected, clear `auth_user_id`, retain username/display name/review metadata, and return the Auth user UUID for server-side deletion.

- [ ] **Step 4: Run pgTAP and verify GREEN**

Run: `cd keychats && supabase test db`

Expected: all previous database tests plus the new signup-request suite pass.

- [ ] **Step 5: Commit**

Commit message: `feat: add signup request approval schema`

---

### Task 2: Public signup-request service with compensation

**Files:**
- Create: `keychats/src/lib/auth/signup-requests.ts`
- Create: `keychats/src/lib/auth/signup-requests-supabase.ts`
- Create: `keychats/tests/unit/signup-requests.test.ts`
- Create: `keychats/tests/unit/signup-requests-supabase.test.ts`

**Interfaces:**
- Consumes: `normalizeLoginId`, `loginIdToInternalEmail`, existing password/display-name validation values, Supabase admin client.
- Produces: `validateSignupRequestInput(input)`, `submitSignupRequest(deps, input)`, `submitSupabaseSignupRequest(admin, input)`.

- [ ] **Step 1: Write failing unit tests for validation and compensation**

Cover normalized lowercase IDs, 3–24 character username format, 1–60 character display name, 8–72 character password, generic conflict mapping, Auth-user cleanup when request insert fails, and concurrent duplicate behavior leaving no orphan Auth user.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `cd keychats && npm test -- --run tests/unit/signup-requests.test.ts tests/unit/signup-requests-supabase.test.ts`

Expected: FAIL because the signup-request modules do not exist.

- [ ] **Step 3: Implement the pure service**

Define `SignupRequestInput = { loginId: string; displayName: string; password: string }` and dependencies for conflict checks, Auth creation, request persistence, and Auth deletion. `submitSignupRequest` must create Auth only after validation/conflict checks and must delete the newly created Auth user if persistence fails.

- [ ] **Step 4: Implement the Supabase adapter**

`submitSupabaseSignupRequest(admin, input)` uses `auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { role: 'member' } })`, checks `profiles` plus pending `signup_requests` for conflicts, inserts only `auth_user_id/username/display_name`, and maps duplicate/Auth conflicts to a stable service error without exposing account existence details.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `cd keychats && npm test -- --run tests/unit/signup-requests.test.ts tests/unit/signup-requests-supabase.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `feat: add public signup request service`

---

### Task 3: Signup-request page and immediate-login root experience

**Files:**
- Modify: `keychats/src/components/login-form.tsx`
- Modify: `keychats/src/app/page.tsx`
- Modify: `keychats/src/app/login/page.tsx`
- Create: `keychats/src/app/signup/page.tsx`
- Create: `keychats/src/app/signup/actions.ts`
- Modify: `keychats/tests/e2e/base-path.spec.ts`
- Create or modify: `keychats/tests/e2e/signup-request.spec.ts`

**Interfaces:**
- Consumes: `submitSupabaseSignupRequest(admin, input)` from Task 2; existing `login` action.
- Produces: `/chats` immediate login form, `/chats/signup`, and `requestSignup(previousState, formData)` server action.

- [ ] **Step 1: Extend E2E tests to RED**

Assert `/chats` immediately shows ID/password fields and a visible `가입 요청` link; `/chats/signup` accepts ID/display name/password and shows a pending-approval confirmation; login before approval does not enter `/channel/*` or `/settings`.

- [ ] **Step 2: Run focused E2E and verify RED**

Run: `cd keychats && npx playwright test tests/e2e/base-path.spec.ts tests/e2e/signup-request.spec.ts`

Expected: signup-request assertions fail.

- [ ] **Step 3: Implement `requestSignup` server action**

Create an admin client only inside the server action, call `submitSupabaseSignupRequest`, return `{ status: 'idle'|'submitted'; error: string|null }`, and use generic Korean copy for conflicts/invalid input.

- [ ] **Step 4: Implement `/signup` and finish shared login UI**

`/chats` and `/chats/login` both render `LoginForm`; add a visible `가입 요청` link to `/signup`. Signup form fields are `loginId`, `displayName`, `password`; after success, replace the form with approval-pending confirmation and a link back to `/login`.

- [ ] **Step 5: Run focused E2E and verify GREEN**

Run: `cd keychats && npx playwright test tests/e2e/base-path.spec.ts tests/e2e/signup-request.spec.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `feat: add signup request page`

---

### Task 4: Admin review service and actions

**Files:**
- Create: `keychats/src/lib/admin/signup-requests.ts`
- Create: `keychats/src/lib/admin/signup-requests-supabase.ts`
- Create: `keychats/tests/unit/admin-signup-requests.test.ts`
- Modify: `keychats/src/app/(workspace)/admin/admin-actions.ts`
- Modify: `keychats/tests/unit/admin-actions.test.ts`

**Interfaces:**
- Consumes: Task 1 RPCs and Supabase admin client; existing `requireAdmin` guard.
- Produces: `PendingSignupRequest`, `listPendingSignupRequests(repository)`, `approveSignupRequest(repository, requestId, reviewerId)`, `rejectSignupRequest(repository, requestId, reviewerId)`, plus guarded server actions `listSignupRequestsAction`, `approveSignupRequestAction`, `rejectSignupRequestAction`.

- [ ] **Step 1: Write failing service/action tests**

Cover listing only pending requests, approval RPC delegation, rejection RPC then Auth deletion, Auth deletion failure reporting without reactivating the rejected request, admin guard enforcement, approval retry semantics, and missing-general propagation.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `cd keychats && npm test -- --run tests/unit/admin-signup-requests.test.ts tests/unit/admin-actions.test.ts`

Expected: FAIL because review interfaces/actions do not exist.

- [ ] **Step 3: Implement admin signup-request repository/service**

Repository reads pending rows ordered oldest-first, invokes the two RPCs, and deletes an Auth user returned by rejection. Service functions expose stable domain errors such as `SIGNUP_REQUEST_NOT_PENDING` and `SIGNUP_REQUEST_REVIEW_FAILED` without weakening existing admin protections.

- [ ] **Step 4: Add guarded server actions**

Reuse `requireAdmin` and return the authenticated admin profile/user ID as `reviewerId`; do not trust reviewer IDs supplied by the browser.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `cd keychats && npm test -- --run tests/unit/admin-signup-requests.test.ts tests/unit/admin-actions.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `feat: add admin signup review actions`

---

### Task 5: Admin signup-request UI

**Files:**
- Modify: `keychats/src/app/(workspace)/admin/page.tsx`
- Modify: `keychats/src/components/admin-panel.tsx`
- Modify: `keychats/tests/e2e/acceptance.spec.ts`

**Interfaces:**
- Consumes: Task 4 list/approve/reject actions.
- Produces: visible `가입 요청` admin section with approve/reject controls and immediate list refresh.

- [ ] **Step 1: Extend acceptance E2E to RED**

Create an applicant through `/chats/signup`, verify admin sees it, verify applicant cannot log in before approval, approve it, verify it disappears from pending list, then verify original password logs into `general`. Add a second request that is rejected and confirm it cannot log in; submit the same rejected username again and confirm a new pending request can be created.

- [ ] **Step 2: Run the acceptance spec and verify RED**

Run: `cd keychats && npx playwright test tests/e2e/acceptance.spec.ts`

Expected: new approval-flow scenario fails because the admin UI is absent.

- [ ] **Step 3: Render signup requests in AdminPanel**

Add `initialSignupRequests` prop; render applicant ID/display name/requested time; `승인` and `거절` buttons call Task 4 actions with confirmation for rejection, show stable error copy, and remove reviewed rows from local state on success. Keep legacy invite UI available but below/de-emphasized relative to signup requests.

- [ ] **Step 4: Load pending requests on admin page**

After `requireAdmin`, fetch pending requests server-side and pass them into `AdminPanel` alongside current users/invites.

- [ ] **Step 5: Run acceptance E2E and verify GREEN**

Run: `cd keychats && npx playwright test tests/e2e/acceptance.spec.ts`

Expected: PASS including approval, rejection, and rejected-username reuse.

- [ ] **Step 6: Commit**

Commit message: `feat: add signup approvals to admin`

---

### Task 6: Main `whogh.vercel.app` Keychats entry link

**Files (separate host repo `graypork/aleph`):**
- Modify: `index.html` on `feature/keychats-host`
- Modify only if necessary: `src/style.css` on `feature/keychats-host`

**Interfaces:**
- Consumes: existing host `/chats` rewrite.
- Produces: visible `Keychats 들어가기` link to `/chats` without changing PDS routes.

- [ ] **Step 1: Add a host-page smoke assertion before the UI change**

Use the existing deployed-preview/public-host check to require an `href="/chats"` entry point from `/`.

- [ ] **Step 2: Verify it currently fails**

Expected: main page has no Keychats link.

- [ ] **Step 3: Add the entry link using existing portfolio styles**

Place the link in a visible hero/evidence area; preserve the Money Saju link and all existing content. Add only minimal CSS if existing `.text-link/.hero-link/.primary-link` styles cannot provide adequate contrast.

- [ ] **Step 4: Preview-deploy and verify**

Verify `/` contains the Keychats entry link and `/chats` still proxies to Keychats; verify `/pds/` remains 200.

- [ ] **Step 5: Commit**

Commit message in `graypork/aleph`: `feat: add Keychats entry point`

---

### Task 7: Full regression gate and hosted Supabase migration

**Files:**
- No expected product-code changes unless tests reveal a defect.

**Interfaces:**
- Consumes: Tasks 1–6.
- Produces: green branch and hosted Keychats schema ready for production.

- [ ] **Step 1: Run full local/CI-equivalent verification**

Run: `cd keychats && supabase test db && npm test && npm run build && npm run test:e2e`

Expected: all DB tests, all unit/component tests, production build, and all E2E tests PASS.

- [ ] **Step 2: Review the diff for secret and PlanDoSee isolation**

Confirm no production Supabase secrets/admin password are committed and no migration/config references `rluscctcdfqrrfaxdeya`.

- [ ] **Step 3: Apply only the new signup migration to Keychats hosted Supabase**

Target project: `otcohkelaqajomlashgy` only. Verify `signup_requests` and review RPCs exist after migration.

- [ ] **Step 4: Re-run Supabase security/performance advisors**

Document new warnings if any; do not weaken security or remove useful indexes merely to silence informational findings.

- [ ] **Step 5: Commit any verification-only documentation changes**

Commit message if needed: `chore: finalize signup approval verification`

---

### Task 8: Administrator bootstrap, Vercel deployment, and production smoke test

**Files:**
- No password-bearing committed files.
- Reuse: `keychats/scripts/bootstrap-admin.ts`, `keychats/src/lib/auth/bootstrap-admin.ts`.

**Interfaces:**
- Consumes: production Keychats env vars and the administrator password supplied out-of-band.
- Produces: sole administrator `cxu1344`, deployed signup-approval flow, and verified public-host experience.

- [ ] **Step 1: Verify whether `cxu1344` already exists in production**

Query Keychats Supabase only. If absent, bootstrap via the existing server-side mechanism using the supplied password without placing it in git, URL query strings, or command output.

- [ ] **Step 2: Verify administrator workspace resources**

Confirm Auth user role `admin`, active `profiles.username = 'cxu1344'`, `user_settings`, and membership in default `general` channel.

- [ ] **Step 3: Deploy `feature/keychats-v1` to the `keychats` Vercel project**

Wait for READY; inspect build/runtime logs for errors.

- [ ] **Step 4: Production smoke-test through `whogh.vercel.app/chats`**

Verify immediate login form, signup request submission, pending login denial, admin request visibility, approval, applicant login with original password, general-channel access, rejection behavior, `/chats/_next/*` assets, and zero unexpected 5xx responses.

- [ ] **Step 5: Deploy the host entry-link change and regression-test Aleph/PDS**

Verify `https://whogh.vercel.app/`, `/chats`, `/chats/login`, and `/pds/`; confirm existing PDS rewrites are unchanged.

- [ ] **Step 6: Final production report**

Report final Keychats commit SHA, host commit SHA, DB/unit/E2E counts, deployment IDs/aliases, admin bootstrap status, Supabase advisor findings, and explicit confirmation that PlanDoSee was untouched.
