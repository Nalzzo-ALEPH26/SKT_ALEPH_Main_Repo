import { describe, expect, it, vi } from 'vitest'

import {
  addChannelMember,
  createChannel,
  deleteChannel,
  normalizeChannelName,
  removeChannelMember,
  type ChannelActor,
  type ChannelRepository,
} from '@/lib/channels/service'

const creator: ChannelActor = {
  userId: '11111111-1111-1111-1111-111111111111',
  isAdmin: false,
}
const admin: ChannelActor = {
  userId: '55555555-5555-5555-5555-555555555555',
  isAdmin: true,
}
const memberId = '22222222-2222-2222-2222-222222222222'

function repository(): ChannelRepository {
  return {
    findByNormalizedName: vi.fn().mockResolvedValue(null),
    getById: vi.fn().mockResolvedValue({
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      name: 'design',
      createdBy: creator.userId,
      isDefault: false,
    }),
    activeUserIds: vi.fn(async (ids) => [...ids]),
    create: vi.fn().mockResolvedValue({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }),
    addMember: vi.fn().mockResolvedValue(undefined),
    removeMember: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  }
}

describe('normalizeChannelName', () => {
  it('trims a valid channel name without changing its display case', () => {
    expect(normalizeChannelName('  Product Design  ')).toBe('Product Design')
  })

  it.each(['', '   ', 'x'.repeat(81)])('rejects invalid channel name %s', (name) => {
    expect(() => normalizeChannelName(name)).toThrow('CHANNEL_NAME_INVALID')
  })

  it('reserves general for the default channel', () => {
    expect(() => normalizeChannelName(' GENERAL ')).toThrow('CHANNEL_NAME_RESERVED')
  })
})

describe('createChannel', () => {
  it('creates the actor as owner and adds unique active members', async () => {
    const repo = repository()

    await createChannel(repo, creator, 'Design', [memberId, memberId, creator.userId])

    expect(repo.create).toHaveBeenCalledWith({ name: 'Design', createdBy: creator.userId })
    expect(repo.addMember).toHaveBeenNthCalledWith(
      1,
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      creator.userId,
      'owner',
    )
    expect(repo.addMember).toHaveBeenNthCalledWith(
      2,
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      memberId,
      'member',
    )
  })

  it('rejects a duplicate normalized name before inserting anything', async () => {
    const repo = repository()
    vi.mocked(repo.findByNormalizedName).mockResolvedValue({
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      name: 'design',
      createdBy: memberId,
      isDefault: false,
    })

    await expect(createChannel(repo, creator, ' Design ', [])).rejects.toThrow('CHANNEL_NAME_TAKEN')
    expect(repo.create).not.toHaveBeenCalled()
  })

  it('rejects inactive requested members before creating the channel', async () => {
    const repo = repository()
    vi.mocked(repo.activeUserIds).mockResolvedValue([])

    await expect(createChannel(repo, creator, 'Design', [memberId])).rejects.toThrow(
      'CHANNEL_MEMBER_INVALID',
    )
    expect(repo.create).not.toHaveBeenCalled()
  })
})

describe('channel membership management', () => {
  it('allows the creator to add an active member', async () => {
    const repo = repository()
    await addChannelMember(repo, creator, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', memberId)
    expect(repo.addMember).toHaveBeenCalledWith(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      memberId,
      'member',
    )
  })

  it('allows the sole admin to manage another creator channel', async () => {
    const repo = repository()
    await addChannelMember(repo, admin, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', memberId)
    expect(repo.addMember).toHaveBeenCalled()
  })

  it('denies an ordinary non-creator member from managing membership', async () => {
    const repo = repository()
    const ordinary = { userId: memberId, isAdmin: false }

    await expect(
      removeChannelMember(repo, ordinary, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', creator.userId),
    ).rejects.toThrow('CHANNEL_MANAGE_FORBIDDEN')
    expect(repo.removeMember).not.toHaveBeenCalled()
  })

  it('does not allow the creator/owner membership to be removed', async () => {
    const repo = repository()

    await expect(
      removeChannelMember(repo, admin, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', creator.userId),
    ).rejects.toThrow('CHANNEL_OWNER_REQUIRED')
    expect(repo.removeMember).not.toHaveBeenCalled()
  })
})

describe('deleteChannel', () => {
  it('allows only admin to delete an ordinary channel', async () => {
    const repo = repository()

    await expect(
      deleteChannel(repo, creator, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
    ).rejects.toThrow('CHANNEL_DELETE_ADMIN_REQUIRED')

    await deleteChannel(repo, admin, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    expect(repo.delete).toHaveBeenCalledWith('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
  })

  it('never deletes the default general channel even for admin', async () => {
    const repo = repository()
    vi.mocked(repo.getById).mockResolvedValue({
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      name: 'general',
      createdBy: admin.userId,
      isDefault: true,
    })

    await expect(
      deleteChannel(repo, admin, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
    ).rejects.toThrow('DEFAULT_CHANNEL_UNDELETABLE')
    expect(repo.delete).not.toHaveBeenCalled()
  })
})
