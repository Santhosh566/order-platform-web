import { Avatar, useMantineTheme, type AvatarProps } from '@mantine/core'
import { usePhotoUrl } from './queries'

function initials(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')).toUpperCase() || '?'
}

/** The user's photo, or their initials while there is none (or it is still loading). */
export function UserAvatar({
  userId,
  name,
  photoVersion,
  ...props
}: { userId: string | undefined; name: string | null | undefined; photoVersion: string | null | undefined } & AvatarProps) {
  const theme = useMantineTheme()
  const url = usePhotoUrl(userId, photoVersion)
  return (
    <Avatar
      radius="xl"
      color={theme.primaryColor}
      variant="filled"
      src={url}
      alt={url ? `Photo of ${name ?? 'you'}` : undefined}
      {...props}
    >
      {initials(name)}
    </Avatar>
  )
}
