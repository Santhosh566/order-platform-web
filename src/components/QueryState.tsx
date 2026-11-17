import { Alert, Button, Center, Loader } from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { errorMessage } from '../lib/errors'

/** Loading spinner, or the error with a retry button, or the content once the data is there. */
export function QueryState<T>({
  query,
  children,
}: {
  query: { data: T | undefined; isPending: boolean; error: unknown; refetch: () => unknown }
  children: (data: T) => ReactNode
}) {
  if (query.isPending) {
    return (
      <Center py="xl">
        <Loader aria-label="Loading" />
      </Center>
    )
  }
  if (query.error || query.data === undefined) {
    return (
      <Alert
        color="red"
        icon={<IconAlertTriangle size={18} />}
        title="Could not load this"
        maw={640}
      >
        {errorMessage(query.error)}
        <div>
          <Button variant="light" color="red" size="xs" mt="sm" onClick={() => void query.refetch()}>
            Try again
          </Button>
        </div>
      </Alert>
    )
  }
  return <>{children(query.data)}</>
}
