type ProfileOption = {
  userId: string
  displayName: string
  username: string
}

type MemberDialogProps = {
  channelId: string
  members: ProfileOption[]
  candidates: ProfileOption[]
  canManage: boolean
  canDelete: boolean
  canLeave?: boolean
  isDefault: boolean
  addAction?: (formData: FormData) => void | Promise<void>
  removeAction?: (formData: FormData) => void | Promise<void>
  deleteAction?: (formData: FormData) => void | Promise<void>
  leaveAction?: (formData: FormData) => void | Promise<void>
}

export function MemberDialog({
  channelId,
  members,
  candidates,
  canManage,
  canDelete,
  canLeave = false,
  isDefault,
  addAction,
  removeAction,
  deleteAction,
  leaveAction,
}: MemberDialogProps) {
  if (!canManage && !(canDelete && !isDefault) && !canLeave) return null

  return (
    <details className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <summary className="cursor-pointer text-sm font-semibold">멤버 관리</summary>
      <div className="mt-4 space-y-4">
        {canManage ? (
          <>
            {candidates.length > 0 ? (
              <form action={addAction} className="flex gap-2">
                <input type="hidden" name="channelId" value={channelId} />
                <select name="addUserId" data-identity-font="true" className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700">
                  {candidates.map((profile) => (
                    <option key={profile.userId} value={profile.userId}>
                      {profile.displayName} (@{profile.username})
                    </option>
                  ))}
                </select>
                <button type="submit" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700">추가</button>
              </form>
            ) : null}

            <div className="space-y-2">
              {members.map((profile) => (
                <div key={profile.userId} className="flex items-center justify-between gap-3 text-sm">
                  <span>{profile.displayName} <span data-identity-font="true" className="text-zinc-500">@{profile.username}</span></span>
                  <form action={removeAction}>
                    <input type="hidden" name="channelId" value={channelId} />
                    <input type="hidden" name="removeUserId" value={profile.userId} />
                    <button type="submit" className="text-zinc-500 hover:text-zinc-950 dark:hover:text-white">제거</button>
                  </form>
                </div>
              ))}
            </div>
          </>
        ) : null}

        {canLeave ? (
          <form action={leaveAction}>
            <input type="hidden" name="channelId" value={channelId} />
            <button type="submit" className="text-sm font-semibold text-amber-700 dark:text-amber-300">채널 나가기</button>
          </form>
        ) : null}

        {canDelete && !isDefault ? (
          <form action={deleteAction}>
            <input type="hidden" name="channelId" value={channelId} />
            <button type="submit" className="text-sm font-semibold text-red-600">채널 삭제</button>
          </form>
        ) : null}
      </div>
    </details>
  )
}
