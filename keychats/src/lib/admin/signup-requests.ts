export type PendingSignupRequest = {
  id: string
  authUserId: string
  username: string
  displayName: string
  requestedAt: string
}

export type SignupReviewRepository = {
  listPending: () => Promise<PendingSignupRequest[]>
  approve: (requestId: string, reviewerId: string, at: Date) => Promise<boolean>
  reject: (requestId: string, reviewerId: string, at: Date) => Promise<string | null>
  deleteAuthUser: (userId: string) => Promise<void>
}

export function listPendingSignupRequests(repository: SignupReviewRepository) {
  return repository.listPending()
}

export async function approveSignupRequest(
  repository: SignupReviewRepository,
  requestId: string,
  reviewerId: string,
  at = new Date(),
) {
  const approved = await repository.approve(requestId, reviewerId, at)
  if (!approved) throw new Error('SIGNUP_REQUEST_APPROVAL_FAILED')
}

export async function rejectSignupRequest(
  repository: SignupReviewRepository,
  requestId: string,
  reviewerId: string,
  at = new Date(),
) {
  const authUserId = await repository.reject(requestId, reviewerId, at)
  if (!authUserId) throw new Error('SIGNUP_REQUEST_REJECTION_FAILED')
  await repository.deleteAuthUser(authUserId)
}
