import { Button, Center, Paper, Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { IconLock } from '@tabler/icons-react'
import { useAuth } from '../auth/AuthContext'

/** Shown on every page while an admin has turned the account off. */
export function AccountInactivePage() {
  const auth = useAuth()
  return (
    <Center py="xl">
      <Paper withBorder radius="md" p="xl" maw={480}>
        <Stack align="center" gap="sm" ta="center">
          <ThemeIcon size={56} radius="xl" color="red" variant="light">
            <IconLock size={30} />
          </ThemeIcon>
          <Title order={2}>You have no access</Title>
          <Text>
            Your account is inactive, so you cannot open this page. Please contact the administrator.
          </Text>
          <Text size="sm" c="dimmed">
            Orders already on their way are not affected. Once your account is active again, sign in and carry on.
          </Text>
          <Button variant="default" onClick={() => void auth.refreshMe()}>
            Check again
          </Button>
        </Stack>
      </Paper>
    </Center>
  )
}
