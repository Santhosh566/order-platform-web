import { Button } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconShare } from '@tabler/icons-react'

/** The phone's share sheet (WhatsApp, …) where there is one; otherwise the link is copied. */
export function ShareButton({ title, path }: { title: string; path: string }) {
  const share = async () => {
    const url = window.location.origin + path
    if (navigator.share) {
      try {
        await navigator.share({ title, url })
        return
      } catch (error) {
        // Closing the share sheet is not an error
        if (error instanceof DOMException && error.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      notifications.show({ color: 'green', title: 'Link copied', message: 'Paste it in a chat or a message.' })
    } catch {
      notifications.show({ color: 'gray', title: 'Copy this link', message: url })
    }
  }
  return (
    <Button variant="default" size="xs" leftSection={<IconShare size={14} />} onClick={() => void share()}>
      Share
    </Button>
  )
}
