# Keychats Signup Approval Flow Design

Date: 2026-10-22
Branch: `feature/keychats-v1`
App: `keychats/`

## Intent

Replace the primary invite-link onboarding flow with a public signup-request flow reachable from `whogh.vercel.app/chats`.

A visitor should be able to request access without receiving a link from the administrator. The administrator (`cxu1344`) reviews pending requests and explicitly approves or rejects them. Only approved users receive Keychats workspace access.

The existing invite-link implementation remains in the codebase for compatibility, but it is no longer the primary onboarding path in the admin UI.

## User Experience

### Public `/chats`

`/chats` shows the login form immediately. The page also exposes a clear `가입 요청` action.

The signup-request form collects:
- login ID
- display name
- password

On successful submission, the user sees a confirmation that approval is pending and that they should return to the login page after approval.

### Pending user

A signup request creates a Supabase Auth user, but does not create a Keychats `profiles` row, user settings, or channel membership.

Because the existing authentication guard requires an active profile, the pending user cannot enter the workspace even if they try to sign in before approval.

The password is never stored in a Keychats database table. Supabase Auth receives it directly and stores only its password hash.

### Administrator

The admin page adds a `가입 요청` section above the existing user-management area.

Each pending request shows:
- requested login ID
- display name
- request time
- approve button
- reject button

Approval creates the workspace resources required for an active member:
- `profiles` row with status `active`
- `user_settings` row with theme `light`
- `general` channel membership with role `member`
- request state changes to `approved`

Rejection:
- marks the request `rejected`
- deletes the corresponding unapproved Supabase Auth user
- leaves no workspace profile or membership behind
- keeps a minimal audit row so the administrator can see that the request was rejected

The existing invite-link code remains available as a fallback/legacy path, but the admin UI should emphasize signup requests instead of requiring the administrator to distribute links.

## Data Model

Add a `signup_requests` table.

Recommended schema shape:

```sql
create table public.signup_requests (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  username text not null,
  display_name text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(user_id)
);

create unique index signup_requests_pending_username_uidx
  on public.signup_requests(username)
  where status = 'pending';
```

The permanent audit table does not make `username` globally unique. Only a currently pending request is unique by username. This allows a rejected requester to submit again later. Active-account uniqueness continues to be enforced by `profiles.username` and Supabase Auth's internal email uniqueness.

Validation must match the existing Keychats account rules:
- username: normalized lowercase, `^[a-z0-9_]{3,24}$`
- display name: 1–60 characters after trim
- password: 8–72 characters

The table should not be readable or writable directly by `anon` or `authenticated`. Public request creation and administrator review happen only through server-side actions using the Keychats Supabase admin client.

This keeps pending-account metadata out of client-side RLS surfaces and avoids exposing the service-role credential.

## Signup Request Creation

A server action receives the public form data.

Sequence:
1. Validate and normalize input using the existing login-ID/password rules.
2. Check for an existing active profile, pending request, or conflicting Auth account.
3. Create the Supabase Auth user using `auth.admin.createUser()` with:
   - internal Keychats email derived from login ID
   - submitted password
   - confirmed email
   - app metadata role `member`
4. Insert the `signup_requests` row.
5. If inserting the request fails, delete the newly created Auth user as compensation.
6. Return a generic success state.

A rejected request can be submitted again because the rejected Auth user is deleted and the username uniqueness constraint only covers `pending` requests.

Duplicate or unavailable login IDs must return a generic user-facing conflict message without revealing unnecessary account details.

## Approval Transaction Semantics

Approval is a server-side admin action guarded by `requireAdmin`.

The action must ensure the request is still `pending` before provisioning.

Provisioning sequence:
1. Resolve the default `general` channel.
2. Insert `profiles` with status `active`.
3. Insert `user_settings` with theme `light`.
4. Insert `channel_members` for the general channel.
5. Mark `signup_requests.status = 'approved'`, set `reviewed_at`, and `reviewed_by`.

The profile/settings/membership/request-state updates should run through a database RPC/transaction so they commit atomically. If the transaction fails, the Auth user remains and the request stays `pending`, allowing the administrator to retry safely.

## Rejection Semantics

Rejection is admin-only and must be retry-safe across the database/Auth boundary.

Sequence:
1. Require the request to be `pending` (or already `rejected` with a remaining `auth_user_id` when retrying cleanup).
2. Mark the request `rejected`, set reviewer metadata, and preserve username/display-name audit fields while retaining `auth_user_id`.
3. Delete the corresponding Supabase Auth user.
4. `auth_user_id` becomes `null` automatically through `on delete set null`.

If Auth deletion fails temporarily, the request remains rejected and inaccessible but still retains `auth_user_id`, allowing the administrator/service to retry cleanup without recreating or reactivating the request. Once Auth deletion succeeds, the rejected request row remains as an audit record and no longer prevents a later signup request with the same username.

## Login and Access Control

No new client-side bypass is introduced.

The existing login action may authenticate a pending Auth user, but it already checks for an active `profiles` row. A pending requester has no profile and therefore receives the existing generic login failure and is signed out.

Approved users receive the active profile during approval, so the same login action works without a second password-registration step.

## Main Site Entry Point

The `graypork/aleph` home page receives a visible Keychats entry link pointing to `/chats`.

The link should use the existing portfolio visual language and must not disturb the existing PlanDoSee routes or rewrites.

The existing `/chats` external rewrite to the separate Keychats Vercel project remains unchanged.

## Security Requirements

- Never store a plaintext password in `signup_requests` or any public table.
- Never expose `SUPABASE_SECRET_KEY` or an admin client in browser code.
- Signup-request insert/review operations use server-side admin code only.
- Approval/rejection actions require `requireAdmin`.
- Pending users receive no `profiles` row and therefore fail the existing active-user guard and RLS helper checks.
- Approval provisioning is atomic.
- Rejection preserves only the minimal audit record while deleting the Auth identity, and a failed Auth deletion remains retryable.
- Existing invite and user-management security tests must continue to pass.
- No writes or migrations may target the PlanDoSee Supabase project.

## Testing

### Database tests

Add pgTAP coverage for:
- `signup_requests` schema and status constraints
- pending-only username uniqueness
- no anon/authenticated direct table privileges
- approval RPC only provisions a pending request
- approval creates profile/settings/general membership atomically
- duplicate approval is rejected/no-op safely
- rejected requests retain audit data after Auth deletion
- rejection cleanup remains retryable while `auth_user_id` is still present

### Unit tests

Add coverage for:
- signup request input validation
- Auth user cleanup if request persistence fails
- duplicate/pending request behavior
- approval/rejection service behavior
- Auth-deletion retry after rejection
- admin authorization wrappers

### E2E

Add/extend Playwright flow:
1. anonymous visitor opens `/chats`
2. login form is immediately visible
3. visitor opens signup request form and submits a new account
4. login before approval is denied
5. admin opens `/chats/admin` and sees the pending request
6. admin approves it
7. requester logs in with the original password
8. requester enters the general channel

A rejection scenario should also verify that the rejected account cannot log in and can submit a fresh request later if needed.

Existing realtime, DM, attachment, reaction/pin, unread, theme, mobile, invite, and admin-disable tests remain unchanged and must continue to pass.

## Deployment

1. Apply the new migration only to Keychats Supabase project `otcohkelaqajomlashgy`.
2. Run database, unit, build, and full E2E CI.
3. Deploy the updated Keychats branch to the separate `keychats` Vercel project.
4. Verify `whogh.vercel.app/chats` through the existing rewrite.
5. Update the `graypork/aleph` host branch to add the Keychats entry link and deploy it.
6. Production smoke-test signup request, admin approval, login, and existing `/` + `/pds/` routes.

## Administrator Bootstrap

The production administrator login ID remains `cxu1344`.

The administrator account must be created using the existing server-side bootstrap mechanism or an equivalent Supabase admin API path. The administrator password must never be committed, printed in logs, or stored in the application database.
