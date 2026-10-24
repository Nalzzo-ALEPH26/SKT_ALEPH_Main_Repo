import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { submitSupabaseSignupRequest } from '@/lib/auth/signup-requests-supabase'

type QueryResult = { data: unknown; error: unknown }

type FakeOptions = {
  profile?: QueryResult
  pending?: QueryResult
  insert?: QueryResult
  authCreate?: QueryResult
  authDelete?: QueryResult
}

function fakeSupabase(options: FakeOptions = {}) {
  const calls: Array<[string, ...unknown[]]> = []
  const profile = options.profile ?? { data: null, error: null }
  const pending = options.pending ?? { data: null, error: null }
  const insert = options.insert ?? { data: null, error: null }
  const authCreate = options.authCreate ?? {
    data: { user: { id: '77777777-7777-7777-7777-777777777777' } },
    error: null,
  }
  const authDelete = options.authDelete ?? { data: {}, error: null }

  const client = {
    from: vi.fn((table: string) => {
      calls.push(['from', table])
      let mode: 'lookup' | 'insert' = 'lookup'
      const query: Record<string, unknown> = {}
      const chain = (name: string) => (...args: unknown[]) => {
        calls.push([name, ...args])
        return query
      }
      query.select = chain('select')
      query.eq = chain('eq')
      query.limit = chain('limit')
      query.insert = (...args: unknown[]) => {
        mode = 'insert'
        calls.push(['insert', ...args])
        return query
      }
      query.maybeSingle = vi.fn(async () => (table === 'profiles' ? profile : pending))
      query.single = vi.fn(async () => insert)
      query.then = (resolve: (value: QueryResult) => unknown) =>
        Promise.resolve(mode === 'insert' ? insert : { data: null, error: null }).then(resolve)
      return query
    }),
    auth: {
      admin: {
        createUser: vi.fn(async (...args: unknown[]) => {
          calls.push(['createUser', ...args])
          return authCreate
        }),
        deleteUser: vi.fn(async (...args: unknown[]) => {
          calls.push(['deleteUser', ...args])
          return authDelete
        }),
      },
    },
  }

  return { client, calls }
}

const input = {
  loginId: 'member_one',
  displayName: 'Member One',
  password: 'password123',
}

describe('submitSupabaseSignupRequest', () => {
  it('maps an existing active profile to a generic conflict before Auth creation', async () => {
    const fake = fakeSupabase({
      profile: { data: { user_id: '11111111-1111-1111-1111-111111111111' }, error: null },
    })

    await expect(submitSupabaseSignupRequest(fake.client as never, input)).rejects.toThrow(
      'SIGNUP_REQUEST_CONFLICT',
    )
    expect(fake.calls.some(([name]) => name === 'createUser')).toBe(false)
  })

  it('creates the Auth user with internal email and persists only signup-request metadata', async () => {
    const fake = fakeSupabase()

    await expect(submitSupabaseSignupRequest(fake.client as never, input)).resolves.toEqual({
      userId: '77777777-7777-7777-7777-777777777777',
      loginId: 'member_one',
    })

    expect(fake.calls).toContainEqual([
      'createUser',
      {
        email: 'member_one@auth.keychats.invalid',
        password: 'password123',
        email_confirm: true,
        app_metadata: { role: 'member' },
      },
    ])
    expect(fake.calls).toContainEqual([
      'insert',
      {
        auth_user_id: '77777777-7777-7777-7777-777777777777',
        username: 'member_one',
        display_name: 'Member One',
      },
    ])
  })

  it('cleans up the Auth user when a concurrent pending insert loses the uniqueness race', async () => {
    const fake = fakeSupabase({
      insert: { data: null, error: { code: '23505', message: 'duplicate key value' } },
    })

    await expect(submitSupabaseSignupRequest(fake.client as never, input)).rejects.toThrow(
      'SIGNUP_REQUEST_CONFLICT',
    )
    expect(fake.calls).toContainEqual([
      'deleteUser',
      '77777777-7777-7777-7777-777777777777',
    ])
  })

  it('maps an Auth duplicate to a generic conflict without attempting request persistence', async () => {
    const fake = fakeSupabase({
      authCreate: {
        data: { user: null },
        error: { status: 422, code: 'email_exists', message: 'A user with this email already exists' },
      },
    })

    await expect(submitSupabaseSignupRequest(fake.client as never, input)).rejects.toThrow(
      'SIGNUP_REQUEST_CONFLICT',
    )
    expect(fake.calls.some(([name]) => name === 'insert')).toBe(false)
  })
})
