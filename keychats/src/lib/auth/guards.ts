export type ProfileStatus = 'active' | 'disabled' | 'expelled'

export type KeychatsProfile = {
  user_id: string
  username: string
  display_name: string
  avatar_path: string | null
  status: ProfileStatus
}

export type VerifiedClaims = {
  sub: string
  app_metadata?: {
    role?: 'admin' | 'member'
    [key: string]: unknown
  }
  user_metadata?: Record<string, unknown>
  [key: string]: unknown
}

type ClaimsResult = {
  data: { claims: VerifiedClaims | null } | null
  error: unknown
}

type ProfileResult = {
  data: KeychatsProfile | null
  error: unknown
}

export type AuthGuardClient = {
  auth: {
    getClaims: () => Promise<ClaimsResult>
  }
  from: (table: 'profiles') => {
    select: (columns: string) => {
      eq: (column: 'user_id', value: string) => {
        maybeSingle: () => PromiseLike<ProfileResult>
      }
    }
  }
}

export class AuthGuardError extends Error {
  readonly code: 'UNAUTHENTICATED' | 'USER_INACTIVE' | 'ADMIN_REQUIRED'

  constructor(code: AuthGuardError['code']) {
    super(code)
    this.name = 'AuthGuardError'
    this.code = code
  }
}

export async function requireActiveUser(client: AuthGuardClient) {
  const { data, error } = await client.auth.getClaims()
  const claims = data?.claims

  if (error || !claims?.sub) {
    throw new AuthGuardError('UNAUTHENTICATED')
  }

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('user_id, username, display_name, avatar_path, status')
    .eq('user_id', claims.sub)
    .maybeSingle()

  if (profileError || !profile) {
    throw new AuthGuardError('UNAUTHENTICATED')
  }

  if (profile.status !== 'active') {
    throw new AuthGuardError('USER_INACTIVE')
  }

  return { claims, profile }
}

export async function requireAdmin(client: AuthGuardClient) {
  const result = await requireActiveUser(client)

  if (result.claims.app_metadata?.role !== 'admin') {
    throw new AuthGuardError('ADMIN_REQUIRED')
  }

  return result
}
