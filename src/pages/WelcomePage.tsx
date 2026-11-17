import { Alert, Button, Center, Loader, Paper, Stack, Text, Title } from '@mantine/core'
import { IconAlertTriangle, IconLogin } from '@tabler/icons-react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { homeFor } from '../auth/roles'

/** The page for signed-out visitors. Sign-in itself happens on Keycloak's page. */
export function WelcomePage() {
  const auth = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from

  if (auth.status === 'loading') {
    return (
      <Center h="100vh">
        <Loader aria-label="Loading" />
      </Center>
    )
  }
  if (auth.status === 'signedIn' && auth.me) {
    return <Navigate to={from ?? homeFor(auth.me.roles)} replace />
  }

  return (
    <Center mih="100vh" p="md">
      <Paper withBorder shadow="sm" p="xl" radius="md" maw={440} w="100%">
        <Stack gap="md" align="center" ta="center">
          <img src="/favicon.svg" alt="" width={56} height={56} />
          <Title order={2}>Order Platform</Title>
          <Text c="dimmed">
            Shop with prices that include GST, follow your orders live, and return items within 7 days of
            delivery. Staff sign in here too.
          </Text>
          {auth.status === 'error' && (
            <Alert color="red" icon={<IconAlertTriangle size={18} />} w="100%" ta="left">
              {auth.error} Is the backend running on port 9091?
            </Alert>
          )}
          <Button
            size="md"
            fullWidth
            leftSection={<IconLogin size={18} />}
            disabled={auth.status === 'error'}
            onClick={() => void auth.signIn(from ?? '/')}
          >
            Sign in
          </Button>
        </Stack>
      </Paper>
    </Center>
  )
}
