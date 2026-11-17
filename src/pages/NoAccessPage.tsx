import { Button, Stack, Text, Title } from '@mantine/core'
import { Link } from 'react-router'

export function NoAccessPage() {
  return (
    <Stack align="center" mt="xl" ta="center">
      <Title order={2}>No access</Title>
      <Text c="dimmed">Your account cannot open this page. Ask an administrator if you need it.</Text>
      <Button component={Link} to="/" variant="light">
        Go to my start page
      </Button>
    </Stack>
  )
}
