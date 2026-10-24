import { describe, expect, it, vi } from 'vitest'

import { bootstrapAdmin } from '@/lib/auth/bootstrap-admin'

const KEYCHATS_PROJECT_REF = 'otcohkelaqajomlashgy'
const PLANDOSEE_PROJECT_REF = 'rluscctcdfqrrfaxdeya'

function dependencies() {
  return {
    upsertAuthAdmin: vi.fn().mockResolvedValue({ userId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }),
    upsertProfile: vi.fn().mockResolvedValue(undefined),
    upsertSettings: vi.fn().mockResolvedValue(undefined),
    ensureGeneralMembership: vi.fn().mockResolvedValue(undefined),
    log: vi.fn(),
  }
}

describe('bootstrapAdmin', () => {
  it('accepts only the fixed cxu1344 admin login ID', async () => {
    const deps = dependencies()

    await expect(
      bootstrapAdmin(deps, {
        projectRef: KEYCHATS_PROJECT_REF,
        loginId: 'someone_else',
        password: 'test-password-only',
      }),
    ).rejects.toThrow('ADMIN_LOGIN_ID_INVALID')

    expect(deps.upsertAuthAdmin).not.toHaveBeenCalled()
  })

  it('refuses to run against the PlanDoSee project', async () => {
    const deps = dependencies()

    await expect(
      bootstrapAdmin(deps, {
        projectRef: PLANDOSEE_PROJECT_REF,
        loginId: 'cxu1344',
        password: 'test-password-only',
      }),
    ).rejects.toThrow('PROJECT_REF_NOT_KEYCHATS')

    expect(deps.upsertAuthAdmin).not.toHaveBeenCalled()
  })

  it('sets admin authorization in app metadata and provisions the workspace profile', async () => {
    const deps = dependencies()

    await bootstrapAdmin(deps, {
      projectRef: KEYCHATS_PROJECT_REF,
      loginId: 'CXU1344',
      password: 'test-password-only',
      displayName: 'Keychats Admin',
    })

    expect(deps.upsertAuthAdmin).toHaveBeenCalledWith({
      email: 'cxu1344@auth.keychats.invalid',
      password: 'test-password-only',
      appMetadata: { role: 'admin' },
    })
    expect(deps.upsertProfile).toHaveBeenCalledWith({
      userId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      username: 'cxu1344',
      displayName: 'Keychats Admin',
      status: 'active',
    })
    expect(deps.upsertSettings).toHaveBeenCalledWith('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    expect(deps.ensureGeneralMembership).toHaveBeenCalledWith(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      { isDefault: true },
    )
  })

  it('never writes the password to logs', async () => {
    const deps = dependencies()
    const password = 'test-password-only'

    await bootstrapAdmin(deps, {
      projectRef: KEYCHATS_PROJECT_REF,
      loginId: 'cxu1344',
      password,
    })

    const logged = JSON.stringify(deps.log.mock.calls)
    expect(logged).not.toContain(password)
  })
})
