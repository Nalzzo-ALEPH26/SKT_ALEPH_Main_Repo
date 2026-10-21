# Keychats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Keychats as an invite-only team chat for about five users, source-controlled in `Nalzzo-ALEPH26/SKT_ALEPH_Main_Repo/keychats`, backed by its own Supabase project, deployed as its own Vercel project, and exposed at `https://whogh.vercel.app/chats` through the existing `graypork/aleph` host project.

**Architecture:** `keychats/` is a standalone Next.js + TypeScript app with `basePath: '/chats'`. It uses a dedicated Supabase project for Auth, Postgres, Realtime, and private Storage, with RLS as the primary authorization boundary. The separate `graypork/aleph` Vite/Vercel project owns `whogh.vercel.app` and only adds a `/chats` rewrite to the Keychats production deployment.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS, Supabase Auth/Postgres/Realtime/Storage, `@supabase/supabase-js`, `@supabase/ssr`, Vitest, React Testing Library, Playwright, Supabase CLI + pgTAP, Vercel.

**Spec:** `docs/superpowers/specs/2026-10-21-keychats-design.md`

## Global Constraints

- Public URL is exactly `https://whogh.vercel.app/chats`.
- App source lives at `SKT_ALEPH_Main_Repo/keychats/`; the host rewrite lives separately in `graypork/aleph`.
- Keychats uses a new dedicated Supabase project named `keychats`.
- The existing Supabase project `graypork's Project` / ref `rluscctcdfqrrfaxdeya` is PlanDoSee infrastructure and must not receive any Keychats schema, Auth, Storage, or migration write.
- Before creating the Keychats Supabase project, ask the user which Supabase organization to use; if the platform quotes nonzero cost, obtain explicit cost approval before creation.
- Use current Supabase publishable/secret keys for the new app; never expose the secret key to the browser and never commit secrets.
- Use `@supabase/ssr` for cookie sessions and `auth.getClaims()` for server-side identity checks; do not trust `getSession()` alone for authorization.
- Do not use user-editable `user_metadata` for authorization. The sole admin role is placed in `app_metadata` and the database enforces active membership separately.
- All exposed `public` tables must have explicit role grants and RLS; new-project Data API exposure behavior must be verified before relying on REST access.
- Only login ID `cxu1344` is admin in v1; there is no admin-promotion UI.
- Invite links expire after exactly 1 hour, are single-registration-use, and do not limit the lifetime of an account created from them.
- All members may create channels; channel creator/admin manages membership; only admin deletes channels.
- Channels are invisible to non-members. DMs are 1:1 only and visible only to the two participants.
- Max attachment size is 10 MB. Allow only explicitly approved image/GIF/PDF/ZIP/text/Office MIME types; reject executables.
- Messages are soft-deleted and render `삭제된 메시지입니다.`; edited messages render `(수정됨)`.
- No presence, browser push, group DMs, advanced search, calls, bots, or admin-promotion UI in v1.
- Commit package lockfiles and pin installed package versions resolved by npm at implementation time.
- Every schema change is represented by a generated Supabase migration under `keychats/supabase/migrations/`; create migration files with `supabase migration new`, never by inventing timestamps.

## Review Focus

1. **Expired/reused/concurrent invite:** only one registration succeeds; expired/revoked/used links fail without creating an Auth user. Covered in Tasks 4 and 5.
2. **Direct private-data access:** a non-member using the Data API or guessed attachment ID cannot read a private channel, DM, message, or attachment. Covered in Tasks 3, 7, 9, and 11.
3. **Disabled user with a still-valid JWT:** RLS and server guards deny workspace access immediately even before the JWT expires. Covered in Tasks 3 and 13.
4. **SSRF through URL preview:** loopback/private/link-local/redirect-to-private targets are rejected; oversized or slow responses fail closed. Covered in Task 12.
5. **`/chats` reverse-proxy path:** assets, deep links, login redirects, invite URLs, and cookies remain functional through `whogh.vercel.app/chats`. Covered in Tasks 1 and 14.

---

## File Structure

Primary app files:

```text
keychats/
├─ package.json
├─ package-lock.json
├─ next.config.ts
├─ proxy.ts
├─ vitest.config.ts
├─ playwright.config.ts
├─ .env.example
├─ public/
│  └─ default-avatar.svg
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx
│  │  ├─ globals.css
│  │  ├─ login/page.tsx
│  │  ├─ invite/[token]/page.tsx
│  │  ├─ api/
│  │  │  ├─ attachments/[attachmentId]/route.ts
│  │  │  └─ url-preview/route.ts
│  │  └─ (workspace)/
│  │     ├─ layout.tsx
│  │     ├─ page.tsx
│  │     ├─ channel/[channelId]/page.tsx
│  │     ├─ dm/[threadId]/page.tsx
│  │     ├─ settings/page.tsx
│  │     └─ admin/page.tsx
│  ├─ components/
│  │  ├─ app-shell.tsx
│  │  ├─ sidebar.tsx
│  │  ├─ message-list.tsx
│  │  ├─ message-composer.tsx
│  │  ├─ message-item.tsx
│  │  ├─ channel-dialog.tsx
│  │  ├─ member-dialog.tsx
│  │  ├─ avatar.tsx
│  │  └─ theme-toggle.tsx
│  └─ lib/
│     ├─ auth/login-id.ts
│     ├─ auth/guards.ts
│     ├─ auth/invites.ts
│     ├─ channels/service.ts
│     ├─ dms/service.ts
│     ├─ messages/service.ts
│     ├─ files/validation.ts
│     ├─ url-preview/fetch-preview.ts
│     └─ supabase/{client,server,proxy,admin}.ts
├─ supabase/
│  ├─ config.toml
│  ├─ migrations/
│  └─ tests/database/
└─ tests/
   ├─ unit/
   ├─ components/
   └─ e2e/
```

Repository-level CI:

```text
.github/workflows/keychats-ci.yml
```

Host project change after Keychats production deployment exists:

```text
graypork/aleph/vercel.json
```

---

### Task 1: Scaffold Keychats with `/chats` base path and test harness

**Files:**
- Create: `keychats/package.json`, `keychats/package-lock.json`, `keychats/next.config.ts`, `keychats/tsconfig.json`, `keychats/src/app/layout.tsx`, `keychats/src/app/globals.css`, `keychats/src/app/page.tsx`
- Create: `keychats/vitest.config.ts`, `keychats/playwright.config.ts`, `keychats/tests/unit/base-path.test.ts`
- Create: `keychats/.env.example`

**Interfaces:**
- Produces: a Next.js app whose external root is `/chats`, plus `npm run test`, `npm run test:e2e`, `npm run build`.

- [ ] **Step 1: Write the failing base-path test**

Assert `next.config.ts` exports `basePath === '/chats'` and that the root app renders a Keychats shell marker.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd keychats && npm test -- base-path.test.ts`
Expected: FAIL because app/config do not exist.

- [ ] **Step 3: Scaffold the app and install test dependencies**

Use Next.js App Router + TypeScript + Tailwind, add Vitest/RTL/Playwright, set `basePath: '/chats'`, and expose only placeholder-safe variables in `.env.example`.

- [ ] **Step 4: Verify unit tests and production build**

Run: `npm test && npm run build`
Expected: PASS and successful Next.js build.

- [ ] **Step 5: Add an E2E base-path smoke test**

Create `tests/e2e/base-path.spec.ts` asserting `/chats` loads, `/chats/login` can be navigated to, and static assets return successfully under the base path.

- [ ] **Step 6: Commit**

```bash
git add keychats
git commit -m "feat: scaffold keychats app"
```

---

### Task 2: Create and isolate the dedicated Supabase project

**Files:**
- Create: `keychats/supabase/config.toml` via Supabase CLI initialization
- Modify: `keychats/.env.example`
- Create: `keychats/docs/supabase-project.md`

**Interfaces:**
- Produces: Keychats project ref, project URL, publishable key, server-only secret key configuration names.

- [ ] **Step 1: Verify current Supabase CLI and commands**

Run `supabase --version`, `supabase --help`, and relevant subcommand `--help` before any CLI mutation.

- [ ] **Step 2: Request the required user decision**

Ask which Supabase organization should own `keychats`. If project creation returns a nonzero cost quote, present it and obtain explicit approval before continuing.

- [ ] **Step 3: Create project `keychats` in `ap-northeast-2` unless the selected organization disallows that region**

Record the new project ref in `keychats/docs/supabase-project.md`. Add an explicit warning that `rluscctcdfqrrfaxdeya` is not a Keychats target.

- [ ] **Step 4: Configure environment-variable contracts**

Use `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and server-only `SUPABASE_SECRET_KEY` placeholders. No real values go into Git.

- [ ] **Step 5: Verify project health and separation**

Confirm the new project is healthy and its ref differs from `rluscctcdfqrrfaxdeya` before any schema work.

- [ ] **Step 6: Commit**

```bash
git add keychats/.env.example keychats/supabase keychats/docs/supabase-project.md
git commit -m "chore: configure isolated keychats supabase"
```

---

### Task 3: Define database schema, grants, RLS helpers, and RLS tests

**Files:**
- Create via `supabase migration new`: `keychats/supabase/migrations/<generated>_core_schema.sql`
- Create via `supabase migration new`: `keychats/supabase/migrations/<generated>_rls_policies.sql`
- Create: `keychats/supabase/tests/database/schema.test.sql`
- Create: `keychats/supabase/tests/database/rls.test.sql`

**Interfaces:**
- Produces tables: `profiles`, `invites`, `channels`, `channel_members`, `dm_threads`, `messages`, `attachments`, `message_reactions`, `message_pins`, `read_states`, `user_settings`, `url_previews`.
- Produces private authorization helpers including `private.is_active_user()` and `private.is_admin()`.

- [ ] **Step 1: Write failing pgTAP schema tests**

Assert required tables/constraints/indexes exist, all exposed tables have RLS enabled, and `channel_members(channel_id,user_id)` plus reaction/read-state uniqueness constraints exist.

- [ ] **Step 2: Write failing RLS tests**

Cover: active member can see own profile and member channels; non-member cannot see another private channel/messages; DM third party sees zero rows; disabled user sees zero workspace rows; member cannot delete a channel; admin can delete a channel.

- [ ] **Step 3: Run tests to verify failure**

Run local Supabase stack, then `supabase test db`.
Expected: FAIL because schema/policies do not exist.

- [ ] **Step 4: Implement core schema migration**

Use UUID PKs, timestamptz timestamps, explicit foreign keys, indexes on every membership/RLS lookup column, message soft-delete/edit timestamps, nullable `channel_id`/`dm_thread_id` with a check that exactly one room target is set, and a self-FK `reply_to_id`.

- [ ] **Step 5: Implement security migration**

Create non-exposed `private` helper functions with fixed `search_path`, explicit `auth.uid()` checks, restricted EXECUTE grants, and no authorization dependence on `user_metadata`. Add explicit `GRANT` statements for roles because Data API exposure is not assumed. Add RLS policies with both `USING` and `WITH CHECK` where required.

- [ ] **Step 6: Verify database tests**

Run: `supabase test db`
Expected: PASS.

- [ ] **Step 7: Run database lint/advisors before remote application**

Run current CLI lint command discovered through `--help`; after applying to the Keychats project, run Supabase security and performance advisors and fix findings relevant to these migrations.

- [ ] **Step 8: Commit**

```bash
git add keychats/supabase
git commit -m "feat: add keychats database security model"
```

---

### Task 4: Implement login-ID mapping and Supabase SSR session plumbing

**Files:**
- Create: `keychats/src/lib/auth/login-id.ts`
- Create: `keychats/src/lib/auth/guards.ts`
- Create: `keychats/src/lib/supabase/client.ts`, `server.ts`, `proxy.ts`, `admin.ts`
- Create: `keychats/proxy.ts`
- Create: `keychats/src/app/login/page.tsx`
- Test: `keychats/tests/unit/login-id.test.ts`, `keychats/tests/unit/auth-guards.test.ts`

**Interfaces:**
- Produces: `normalizeLoginId(raw: string): string`, `loginIdToInternalEmail(loginId: string): string`, `requireActiveUser()`, `requireAdmin()`.
- Login IDs are case-insensitive ASCII matching `^[a-z0-9_]{3,24}$` after trim/lowercase normalization.
- Internal email mapping is deterministic and never displayed to users.

- [ ] **Step 1: Write failing normalization/mapping tests**

Assert whitespace/case normalization, invalid characters/length rejection, stable synthetic email mapping, and identical mapping for `CXU1344`/`cxu1344`.

- [ ] **Step 2: Run tests to verify failure**

Expected: FAIL because helpers do not exist.

- [ ] **Step 3: Implement Supabase clients and SSR proxy**

Use `@supabase/ssr` browser/server clients, per-request server client creation, and `auth.getClaims()` in proxy/server guards. `admin.ts` uses `SUPABASE_SECRET_KEY` and is server-only.

- [ ] **Step 4: Implement ID/password login**

Map normalized ID to the internal Auth email and call password sign-in without exposing the synthetic email in UI or errors. Use one generic invalid-credentials message.

- [ ] **Step 5: Add disabled-user guard test**

Mock a valid JWT identity whose `profiles.status` is not `active`; assert workspace guard denies it.

- [ ] **Step 6: Verify**

Run: `npm test -- login-id.test.ts auth-guards.test.ts && npm run build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add keychats
git commit -m "feat: add keychats authentication plumbing"
```

---

### Task 5: Implement atomic one-hour invitation registration

**Files:**
- Create: `keychats/src/lib/auth/invites.ts`
- Create: `keychats/src/app/invite/[token]/page.tsx`
- Create: `keychats/src/app/(workspace)/admin/invite-actions.ts`
- Add migration via `supabase migration new`: invite claim/finalize database functions
- Test: `keychats/tests/unit/invites.test.ts`, `keychats/supabase/tests/database/invites.test.sql`

**Interfaces:**
- Produces: `createInvite()`, `claimInvite(token)`, `completeInviteRegistration(...)`, `revokeInvite(inviteId)`.
- Raw tokens are 32-byte cryptographically random base64url strings; DB stores only SHA-256 token hashes.
- `expires_at = created_at + interval '1 hour'`.

- [ ] **Step 1: Write failing invite unit tests**

Assert raw token is never persisted, expiry is exactly one hour, revoked/expired/used tokens fail, and account lifetime is not derived from invite expiry.

- [ ] **Step 2: Write failing concurrent-claim pgTAP tests**

Assert only one claim can hold an invite at a time and a finalized invite cannot be claimed again. Add a short stale-claim timeout so a crashed registration cannot permanently consume an otherwise unused invite.

- [ ] **Step 3: Implement claim/finalize database functions**

Keep privileged functions in a non-exposed schema, restrict execution, validate `auth.uid()` when admin-only, and make claim/finalize state changes transactional.

- [ ] **Step 4: Implement server registration flow**

Claim invite → validate ID/password/display name → create confirmed Supabase Auth user with internal email → insert profile/settings and `#general` membership → finalize invite. If Auth/profile creation fails, clean up the partial Auth user and release the claim when safe.

- [ ] **Step 5: Verify single-success behavior**

Run unit + pgTAP tests and an integration test that submits the same invite concurrently; exactly one request may create an account.

- [ ] **Step 6: Commit**

```bash
git add keychats
git commit -m "feat: add one-hour invite registration"
```

---

### Task 6: Provision sole admin, default profile image, and workspace shell

**Files:**
- Create: `keychats/public/default-avatar.svg`
- Create: `keychats/src/components/app-shell.tsx`, `sidebar.tsx`, `avatar.tsx`, `theme-toggle.tsx`
- Create: `keychats/src/app/(workspace)/layout.tsx`, `page.tsx`, `settings/page.tsx`
- Create: `keychats/scripts/bootstrap-admin.ts`
- Test: `keychats/tests/components/app-shell.test.tsx`, `keychats/tests/unit/bootstrap-admin.test.ts`

**Interfaces:**
- Admin bootstrap accepts ID `cxu1344` and password through runtime environment/input only; it sets `app_metadata.role = 'admin'` and creates/updates the profile without printing the password.

- [ ] **Step 1: Write failing shell/theme/avatar tests**

Assert default avatar fallback, Light/Dark persistence, sidebar sections, and mobile drawer trigger.

- [ ] **Step 2: Write failing admin-bootstrap safety test**

Assert bootstrap rejects any login ID other than `cxu1344`, never logs password, and sets admin in `app_metadata`, not `user_metadata`.

- [ ] **Step 3: Implement workspace shell and settings**

Persist user-selected `light|dark` in `user_settings` and apply it on initial render without requiring a system theme option.

- [ ] **Step 4: Implement admin bootstrap script**

Run only against the Keychats project ref; add a guard that aborts if the configured project ref equals the documented PlanDoSee ref.

- [ ] **Step 5: Verify**

Run component/unit tests and build.

- [ ] **Step 6: Commit**

```bash
git add keychats
git commit -m "feat: add workspace shell and admin bootstrap"
```

---

### Task 7: Implement private channels and membership management

**Files:**
- Create: `keychats/src/lib/channels/service.ts`
- Create: `keychats/src/components/channel-dialog.tsx`, `member-dialog.tsx`
- Create: `keychats/src/app/(workspace)/channel/[channelId]/page.tsx`
- Test: `keychats/tests/unit/channels.test.ts`, extend `supabase/tests/database/rls.test.sql`

**Interfaces:**
- Produces: `createChannel(name, memberIds)`, `addChannelMember(channelId,userId)`, `removeChannelMember(...)`, `deleteChannel(channelId)`.

- [ ] **Step 1: Write failing service and authorization tests**

Cover creator auto-membership, duplicate/invalid channel name rejection, creator member management, admin member management, ordinary member delete denial, admin delete success, and non-member metadata invisibility.

- [ ] **Step 2: Implement channel service and UI**

Create `#general` as undeletable/default bootstrap data; all new registered users join it automatically. Other channels are visible only to members.

- [ ] **Step 3: Verify negative RLS access directly**

As a non-member authenticated role, query channel and messages by known UUID and assert zero rows/permission denial.

- [ ] **Step 4: Commit**

```bash
git add keychats
git commit -m "feat: add private team channels"
```

---

### Task 8: Implement channel messaging, realtime updates, edit/delete, and replies

**Files:**
- Create: `keychats/src/lib/messages/service.ts`
- Create: `keychats/src/components/message-list.tsx`, `message-composer.tsx`, `message-item.tsx`
- Test: `keychats/tests/unit/messages.test.ts`, `keychats/tests/components/message-list.test.tsx`
- Modify: Realtime publication migration generated through Supabase CLI

**Interfaces:**
- Produces: `sendMessage`, `editMessage`, `deleteMessage`, `subscribeToMessages`, reply relation via `reply_to_id`.

- [ ] **Step 1: Write failing message behavior tests**

Assert sender identity is server/DB-derived, blank-only messages fail unless attachments exist, own edit sets `edited_at`, delete sets `deleted_at` and clears rendered content, non-owner edit/delete fails, admin delete succeeds, replies cannot point across rooms.

- [ ] **Step 2: Implement initial history loading with pagination**

Load newest 50 messages and paginate older history. Always filter by current `channel_id` even though RLS also protects rows.

- [ ] **Step 3: Implement Realtime subscription**

Subscribe only to the current room and reconcile INSERT/UPDATE/DELETE events without duplicating optimistic messages.

- [ ] **Step 4: Implement soft-delete/edit/reply UI**

Render exact copies `(수정됨)` and `삭제된 메시지입니다.`.

- [ ] **Step 5: Verify**

Run tests, database RLS tests, and a two-browser Playwright test where one user sends and the other receives without refresh.

- [ ] **Step 6: Commit**

```bash
git add keychats
git commit -m "feat: add realtime channel messaging"
```

---

### Task 9: Implement unique 1:1 direct messages

**Files:**
- Create: `keychats/src/lib/dms/service.ts`
- Create: `keychats/src/app/(workspace)/dm/[threadId]/page.tsx`
- Test: `keychats/tests/unit/dms.test.ts`, extend `supabase/tests/database/rls.test.sql`

**Interfaces:**
- Produces: `getOrCreateDm(otherUserId)` returning one canonical thread for a pair.

- [ ] **Step 1: Write failing DM uniqueness/privacy tests**

Assert A→B and B→A return the same thread, self-DM fails, third party cannot select thread/messages/read state, and duplicate pairs cannot be inserted.

- [ ] **Step 2: Implement canonical participant ordering and DB uniqueness**

Store the two UUIDs in deterministic order and enforce the pair with a database unique constraint.

- [ ] **Step 3: Reuse messaging components for DMs**

Do not fork a second message UI; room target is supplied through the existing message service.

- [ ] **Step 4: Verify two-party and third-party E2E behavior**

- [ ] **Step 5: Commit**

```bash
git add keychats
git commit -m "feat: add private direct messages"
```

---

### Task 10: Implement reactions, pins, and read/unread state

**Files:**
- Modify: `keychats/src/lib/messages/service.ts`, `message-item.tsx`, `sidebar.tsx`
- Test: `keychats/tests/unit/message-state.test.ts`, extend pgTAP RLS tests

**Interfaces:**
- Produces: `toggleReaction`, `togglePin`, `markRoomRead`, `getUnreadCounts`.

- [ ] **Step 1: Write failing tests**

Cover one reaction per user/message/emoji, reaction removal, member-only pin/read access, unread increment on new remote message, and unread reset when the room is marked read.

- [ ] **Step 2: Implement reactions and pins**

Keep authorization tied to message-room membership; admin does not gain implicit DM access merely by being admin.

- [ ] **Step 3: Implement read state and sidebar badges**

Track the latest read timestamp/message per user/room and display numeric unread badges for both channels and DMs.

- [ ] **Step 4: Verify Realtime state synchronization**

- [ ] **Step 5: Commit**

```bash
git add keychats
git commit -m "feat: add chat reactions pins and unread state"
```

---

### Task 11: Implement avatars, attachments, GIFs, and clipboard image paste

**Files:**
- Create: `keychats/src/lib/files/validation.ts`
- Create: `keychats/src/app/api/attachments/[attachmentId]/route.ts`
- Modify: `avatar.tsx`, `message-composer.tsx`, `message-item.tsx`
- Add storage migration via `supabase migration new`
- Test: `keychats/tests/unit/file-validation.test.ts`, `keychats/tests/e2e/attachments.spec.ts`, storage RLS pgTAP tests where applicable

**Interfaces:**
- Allowed size: `<= 10 * 1024 * 1024` bytes.
- Allowed MIME classes: JPEG/PNG/WebP/GIF, PDF, ZIP, plain text, DOCX/XLSX/PPTX.

- [ ] **Step 1: Write failing validation tests**

Assert 10 MB exact boundary passes, 10 MB + 1 byte fails, executable/script MIME/extensions fail, mismatched dangerous extension fails, clipboard PNG passes.

- [ ] **Step 2: Create private Storage buckets and upload policies**

Use `avatars` and `chat-attachments`. Users upload only to controlled paths. Do not make chat attachments public.

- [ ] **Step 3: Implement authorized attachment download**

`GET /api/attachments/[id]` verifies active user + room membership, then issues a short-lived signed Storage URL or streams the object. A guessed ID from a non-member returns 404/403 without revealing metadata.

- [ ] **Step 4: Implement upload/paste/render UI**

Support image/GIF preview, file chips, and clipboard image paste. Users without avatars render `/default-avatar.svg`.

- [ ] **Step 5: Verify private attachment access with three users**

- [ ] **Step 6: Commit**

```bash
git add keychats
git commit -m "feat: add secure chat attachments"
```

---

### Task 12: Implement safe URL previews

**Files:**
- Create: `keychats/src/lib/url-preview/fetch-preview.ts`
- Create: `keychats/src/app/api/url-preview/route.ts`
- Test: `keychats/tests/unit/url-preview.test.ts`

**Interfaces:**
- Produces: `fetchUrlPreview(url: string)` returning sanitized `{ url, title, description, imageUrl } | null`.
- Only HTTP(S), first previewable URL per message in v1.

- [ ] **Step 1: Write failing SSRF tests**

Reject `localhost`, `127.0.0.0/8`, `::1`, RFC1918, link-local, metadata-service targets, non-HTTP schemes, and public URLs that redirect to a blocked address. Reject excessive redirects, timeout, and response-size overflow.

- [ ] **Step 2: Implement DNS/IP validation before every fetch hop**

Resolve hostnames, reject blocked address ranges, cap redirects, timeout, downloaded HTML bytes, and parse only safe OpenGraph/title metadata. Never execute remote scripts.

- [ ] **Step 3: Cache sanitized previews in `url_previews`**

Use normalized URL hash and refresh stale entries server-side.

- [ ] **Step 4: Verify**

Run: `npm test -- url-preview.test.ts`
Expected: all blocked-target and redirect tests PASS.

- [ ] **Step 5: Commit**

```bash
git add keychats
git commit -m "feat: add safe url previews"
```

---

### Task 13: Implement admin moderation and account controls

**Files:**
- Create: `keychats/src/app/(workspace)/admin/page.tsx`
- Create: `keychats/src/app/(workspace)/admin/admin-actions.ts`
- Test: `keychats/tests/unit/admin-actions.test.ts`, extend pgTAP RLS tests

**Interfaces:**
- Produces: invite generation/revocation, user listing, temporary password reset, disable, expel, channel delete, message delete.

- [ ] **Step 1: Write failing admin authorization tests**

Assert ordinary members cannot call any admin action even by direct POST/server-action invocation. Assert only `app_metadata.role === 'admin'` plus active profile grants admin behavior.

- [ ] **Step 2: Implement temporary password reset**

Generate a high-entropy temporary password server-side, update it through the Auth Admin API, return it once to admin UI, and never log/store it in application tables.

- [ ] **Step 3: Implement disable/expel**

Set profile status and block workspace RLS immediately. Also ban the Auth user through the current Supabase Admin API so new sessions cannot be created. Historical messages remain.

- [ ] **Step 4: Add valid-JWT disabled-user regression test**

Keep a pre-disable access token and prove post-disable database queries are denied by active-user RLS.

- [ ] **Step 5: Verify admin-only deletion/moderation**

- [ ] **Step 6: Commit**

```bash
git add keychats
git commit -m "feat: add keychats admin controls"
```

---

### Task 14: Add responsive polish, full E2E suite, CI, Vercel deployment, and `/chats` host rewrite

**Files:**
- Modify: Keychats UI files and Playwright tests
- Create: `.github/workflows/keychats-ci.yml`
- Create or modify in separate repo: `graypork/aleph/vercel.json`

**Interfaces:**
- Produces: PR test gate, Vercel Preview for `keychats/`, production Keychats alias, and `whogh.vercel.app/chats` rewrite.

- [ ] **Step 1: Write end-to-end acceptance tests before deployment wiring**

Cover login, invite signup, channel creation/membership, realtime messaging, DM privacy, edit/delete, reaction/pin, unread badge, attachment access, admin disable, Light/Dark persistence, and mobile drawer.

- [ ] **Step 2: Add `/chats` proxy-path E2E assertions**

Assert `/chats`, `/chats/login`, `/chats/invite/<token>`, `/chats/channel/<id>`, Next static assets, login redirects, and session cookies all remain under/functional through the public host.

- [ ] **Step 3: Add CI workflow**

On PRs touching `keychats/**`, run npm unit/component tests, production build, local Supabase migrations + `supabase test db`, and Playwright smoke tests. Pin action versions and Supabase CLI setup according to current official docs.

- [ ] **Step 4: Create/link Vercel project for monorepo root `keychats`**

Use team `grayporks-projects`, set framework Next.js and root directory `keychats`, configure Keychats Supabase environment variables, deploy Preview first, and verify it before production.

- [ ] **Step 5: Discover the actual stable Keychats production alias**

Do not guess the hostname. Use Vercel project/deployment metadata and record the production alias.

- [ ] **Step 6: Modify `graypork/aleph/vercel.json`**

Add rewrites for `/chats` and `/chats/:path*` to the discovered Keychats production alias while preserving all existing `aleph` behavior. Commit this change in `graypork/aleph` separately.

- [ ] **Step 7: Deploy/verify the host project**

Verify existing `whogh` routes still work, then verify the complete Keychats E2E suite through `https://whogh.vercel.app/chats`.

- [ ] **Step 8: Run Supabase advisors and final secret scan**

Run security + performance advisors on the Keychats project, check Git history/staged changes for leaked secret values, and confirm no write was made to PlanDoSee project ref `rluscctcdfqrrfaxdeya`.

- [ ] **Step 9: Commit deployment/CI changes**

Shared repo:

```bash
git add .github/workflows/keychats-ci.yml keychats
git commit -m "chore: ship keychats production workflow"
```

Host repo:

```bash
git add vercel.json
git commit -m "feat: route whogh chats to keychats"
```

- [ ] **Step 10: Final verification report**

Report Keychats Supabase project ref, shared-repo commit SHA, `graypork/aleph` routing commit SHA, Vercel production deployment IDs, final public URL, unit/pgTAP/E2E results, and any advisor findings fixed or intentionally deferred.
