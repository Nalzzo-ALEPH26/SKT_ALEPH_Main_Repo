type ProfileOption = {
  userId: string
  displayName: string
  username: string
}

type ChannelDialogProps = {
  profiles: ProfileOption[]
  currentUserId: string
  action?: (formData: FormData) => void | Promise<void>
}

export function ChannelDialog({ profiles, currentUserId, action }: ChannelDialogProps) {
  const candidates = profiles.filter((profile) => profile.userId !== currentUserId)

  return (
    <details className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <summary className="cursor-pointer text-sm font-semibold">채널 만들기</summary>
      <form action={action} className="mt-4 space-y-4">
        <label className="block space-y-1 text-sm">
          <span className="font-medium">채널 이름</span>
          <input
            name="name"
            required
            maxLength={80}
            placeholder="예: 개발"
            className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 outline-none focus:border-zinc-500 dark:border-zinc-700"
          />
        </label>

        {candidates.length > 0 ? (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">초대할 멤버</legend>
            {candidates.map((profile) => (
              <label key={profile.userId} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="memberIds" value={profile.userId} />
                <span>{profile.displayName}</span>
                <span className="text-zinc-500">@{profile.username}</span>
              </label>
            ))}
          </fieldset>
        ) : null}

        <button
          type="submit"
          className="rounded-lg bg-zinc-950 px-3 py-2 text-sm font-semibold text-white dark:bg-white dark:text-zinc-950"
        >
          만들기
        </button>
      </form>
    </details>
  )
}
