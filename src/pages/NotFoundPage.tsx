import { Button, Stack, Text, Title } from '@mantine/core'
import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <Stack align="center" mt="xl" ta="center">
      <Title order={2}>Page not found</Title>
      <Text c="dimmed">The link may be old, or the page has moved.</Text>
      <Button component={Link} to="/" variant="light">
        Go to my start page
      </Button>
    </Stack>
  )
}
