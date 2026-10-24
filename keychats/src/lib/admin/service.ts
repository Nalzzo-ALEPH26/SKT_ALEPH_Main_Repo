import { randomBytes } from 'node:crypto'

export type ManagedUserStatus = 'active' | 'disabled' | 'expelled'

export type ManagedUser = {
  userId: string
  username: string
  displayName: string
  status: ManagedUserStatus
  createdAt: string
}

export type AdminRepository = {
  listUsers: () => Promise<ManagedUser[]>
  getUser: (userId: string) => Promise<ManagedUser | null>
  setStatus: (userId: string, status: ManagedUserStatus) => Promise<void>
  updatePassword: (userId: string, password: string) => Promise<void>
  banUser: (userId: string) => Promise<void>
  deleteUser: (userId: string) => Promise<void>
  markDeleted: (userId: string) => Promise<void>
}

type RandomBytesFactory = () => Buffer

export function generateTemporaryPassword(
  randomBytesFactory: RandomBytesFactory = () => randomBytes(18),
) {
  const entropy = randomBytesFactory()
  if (entropy.byteLength < 16) throw new Error('TEMP_PASSWORD_ENTROPY_TOO_LOW')
  return `Kc!${entropy.toString('base64url')}9a`
}

async function requireManagedTarget(repository: AdminRepository, userId: string) {
  const target = await repository.getUser(userId)
  if (!target) throw new Error('ADMIN_TARGET_NOT_FOUND')
  return target
}

async function requireRemovableTarget(repository: AdminRepository, userId: string) {
  const target = await requireManagedTarget(repository, userId)
  if (target.username === 'cxu1344') throw new Error('SOLE_ADMIN_PROTECTED')
  return target
}

export async function listManagedUsers(repository: AdminRepository) {
  return repository.listUsers()
}

export async function resetManagedUserPassword(
  repository: AdminRepository,
  userId: string,
  randomBytesFactory?: RandomBytesFactory,
) {
  await requireRemovableTarget(repository, userId)
  const temporaryPassword = generateTemporaryPassword(randomBytesFactory)
  await repository.updatePassword(userId, temporaryPassword)
  return temporaryPassword
}

export async function disableManagedUser(repository: AdminRepository, userId: string) {
  await requireRemovableTarget(repository, userId)

  await repository.setStatus(userId, 'disabled')
  await repository.banUser(userId)
}

export async function expelManagedUser(repository: AdminRepository, userId: string) {
  await requireRemovableTarget(repository, userId)

  await repository.setStatus(userId, 'expelled')
  await repository.banUser(userId)
}

export async function deleteManagedUser(repository: AdminRepository, userId: string) {
  await requireRemovableTarget(repository, userId)

  // Revoke app access first, soft-delete Auth to preserve historical references,
  // then hide the retained profile from the active admin roster.
  await repository.setStatus(userId, 'expelled')
  await repository.deleteUser(userId)
  await repository.markDeleted(userId)
}
