type AvatarProps = {
  displayName: string
  avatarPath: string | null
  size?: 'sm' | 'md'
}

export function Avatar({ displayName, avatarPath, size = 'md' }: AvatarProps) {
  const dimension = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'
  const src = avatarPath
    ? `/chats/api/avatars?path=${encodeURIComponent(avatarPath)}`
    : '/chats/default-avatar.svg'

  return (
    <img
      src={src}
      alt={displayName}
      className={`${dimension} shrink-0 rounded-full bg-black/5 object-cover`}
    />
  )
}
