# Keychats Design Specification

Date: 2026-10-21
Status: Approved

## Goal

Build **Keychats**, a small team chat application for approximately five teammates, inside the shared `SKT_ALEPH_Main_Repo` as an independent `keychats/` app and expose it at:

- `https://whogh.vercel.app/chats`

The app should be simple and modern, with invite-only accounts, private member-only channels, 1:1 direct messages, rich messages/files, unread state, and a single administrator account.

## Repository and deployment

Application source lives in the shared team repository:

```text
Nalzzo-ALEPH26/SKT_ALEPH_Main_Repo/
├─ democracy-omok/
├─ dongsi-omok/
├─ hint-omok/
├─ nunchi-omok/
└─ keychats/
```

`keychats/` will be a standalone **Next.js + TypeScript** application with its own Vercel project.

The public host `whogh.vercel.app` is owned by the separate Vercel `aleph` project backed by `graypork/aleph`. That host remains the front door. The `graypork/aleph` project will contain only the routing configuration needed to rewrite/proxy `/chats` and `/chats/*` to the Keychats deployment without changing the rest of the site.

Keychats itself must be configured to operate under the `/chats` base path so assets, navigation, authentication redirects, and deep links work through the public host.

## Infrastructure isolation

Keychats uses a **dedicated Supabase project named `keychats`**.

The existing Supabase project currently used for PlanDoSee Diary (`graypork's Project`) is outside Keychats scope and must not be modified, migrated, reused, or share Auth/Storage/data with Keychats.

The separation is intentional:

- independent `auth.users`
- independent Postgres database and migrations
- independent Storage buckets
- independent RLS policies and database functions
- independent API keys and Vercel environment variables
- independent Realtime configuration

No Keychats migration or bootstrap script may target the PlanDoSee project reference.

## Users and roles

Initial size: about 5 users.

Roles:

- `admin`: only `cxu1344`
- `member`: invited teammates

There is no admin-promotion UI in v1.

## Authentication

Public login UX:

```text
ID
PASSWORD
```

Supabase Auth is used internally. Passwords are never stored in app tables, source code, Git, migrations, or logs.

The administrator account uses login ID `cxu1344`. Its initial password must be provisioned directly in the Keychats authentication system and changed after setup.

### Invite-only registration

There is no open signup.

1. Admin creates an invite link.
2. The invite is valid for **1 hour**.
3. It can be consumed by **one successful registration only**.
4. The invite is immediately invalid after successful registration.
5. Unused invites automatically expire after one hour.
6. Admin can revoke an unused invite early.
7. The new user chooses ID, password, display name, and optional avatar.
8. Once the account is created, the invite expiry no longer matters. The account remains usable indefinitely unless disabled/expelled by admin.

Raw invite tokens should not be stored; only a secure hash is stored.

## Profiles

Each user has:

- internal UUID
- unique login ID
- display name
- profile image
- active/disabled/expelled state
- created timestamp

Users without an uploaded avatar receive a default Keychats profile image.

## Channels

- `#general` exists by default.
- New users automatically join `#general`.
- All members may create channels.
- Only admin may delete channels.
- Channels are visible only to their members.
- Non-members must not be able to discover channel metadata, messages, or files by direct API access.
- The channel creator can add/remove members.
- Admin can manage membership for any channel.

## Direct messages

v1 supports **1:1 DMs only**.

Selecting a teammate opens the existing pair thread or creates it if necessary. A DM is readable only by its two participants under normal application access.

## Messages

Supported:

- text
- emoji input
- emoji reactions
- GIF/animated image upload
- image upload
- clipboard image paste
- clickable URL
- URL preview cards
- replies
- pins
- PDF/ZIP/common document attachments

Maximum attachment size: **10 MB per file**.

Dangerous executable types are rejected.

### Editing and deletion

Users can edit and delete their own messages.

Edited messages show `(수정됨)`.

Deleted messages remain as:

```text
삭제된 메시지입니다.
```

Admin can delete any message.

## Read/unread

Read state is tracked for both channels and DMs.

Sidebar items show unread counts.

No browser push notifications in v1.

## Presence

Explicit online/offline presence is not included in v1.

## Appearance

Users can choose:

- Light
- Dark

Preference is persisted per user.

Desktop layout:

```text
┌───────────────┬────────────────────────────────────┐
│ KEYCHATS      │ # channel / teammate              │
│ CHANNELS      │ messages                           │
│ DIRECT        │                                    │
│ + channel     │ message composer                   │
└───────────────┴────────────────────────────────────┘
```

On mobile, left navigation becomes a drawer.

## Admin tools

Only `cxu1344` can access admin tools.

Admin can:

- generate invite link
- revoke invite
- list users
- reset password to a temporary password
- disable user
- expel user
- delete any channel
- delete any message

Historical messages remain if a user is disabled or expelled.

## Supabase data model

Planned tables in the dedicated Keychats project:

- `profiles`
- `invites`
- `channels`
- `channel_members`
- `dm_threads`
- `messages`
- `attachments`
- `message_reactions`
- `message_pins`
- `read_states`
- `user_settings`
- `url_previews`

Storage buckets:

- `avatars`
- `chat-attachments`

All exposed tables use RLS.

## Security rules

- users can read only channels they belong to
- users can read only DMs they participate in
- users can create messages only as themselves
- users can edit/delete only their own messages, except admin deletion
- channel creator/admin can manage channel membership
- only admin can delete channels
- only admin can create/revoke invites and manage accounts
- disabled/expelled users cannot perform normal workspace actions
- the browser never receives a Supabase secret/service-role key
- authorization must never rely on user-editable `user_metadata`

Invite consume must be atomic to prevent reuse races.

URL preview fetching must prevent SSRF by rejecting private/loopback/link-local targets, validating redirects, enforcing timeouts/size limits, and only allowing HTTP(S).

## Routes

```text
/chats/login
/chats/invite/[token]
/chats
/chats/channel/[channelId]
/chats/dm/[threadId]
/chats/settings
/chats/admin
```

## Collaboration workflow

```text
feature/<short-name>
    ↓
GitHub Pull Request
    ↓
Vercel Preview
    ↓
review/test
    ↓
main merge
    ↓
production
```

Supabase schema changes are tracked as migrations under:

```text
keychats/supabase/migrations/
```

Secrets and `.env` files stay out of Git.

## v1 non-goals

- public signup
- group DMs
- browser push notifications
- advanced message search
- voice/video calls
- bots/integrations
- admin promotion UI

## Acceptance criteria

1. `whogh.vercel.app/chats` opens Keychats without breaking the rest of `whogh`.
2. Only an unused invite less than one hour old can create an account.
3. An invite cannot be reused after successful registration.
4. An account remains valid after its invite expires.
5. `cxu1344` alone has admin privileges.
6. Members can create private member-only channels.
7. Non-members cannot query private channel data.
8. Admin alone can delete channels.
9. 1:1 DMs are private to participants.
10. Rich messages and allowed attachments up to 10 MB work.
11. Message edits/deletes follow the agreed UI.
12. Admin can disable/expel users and moderate messages.
13. Channel and DM read/unread state works.
14. Light/Dark preference persists.
15. Desktop and mobile layouts are usable.
16. RLS/storage authorization tests pass.
17. PRs can be previewed before production merge.
18. Keychats uses a separate Supabase project and no operation modifies the PlanDoSee Supabase project.

## Implementation order

1. scaffold `keychats/`
2. create a dedicated Keychats Supabase project
3. schema migrations
4. auth, invite signup, admin provisioning
5. RLS/storage security tests
6. channels and membership
7. realtime messaging
8. 1:1 DMs
9. attachments/GIF/image paste
10. reactions/replies/pins/read state
11. URL preview service
12. admin tools
13. light/dark + responsive polish
14. create/link Keychats Vercel project
15. configure `graypork/aleph` `/chats` routing
16. GitHub Preview workflow and production verification
