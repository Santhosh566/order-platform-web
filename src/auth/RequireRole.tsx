import { Center, Loader } from '@mantine/core'
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import type { Role } from '../api/types'
import { NoAccessPage } from '../pages/NoAccessPage'
import { useAuth } from './AuthContext'

/**
 * Shows its children only to a signed-in user with one of the roles. The backend checks every
 * call anyway; this only keeps people away from screens that would refuse them.
 */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const auth = useAuth()
  const location = useLocation()

  if (auth.status === 'loading') {
    return (
      <Center h="60vh">
        <Loader aria-label="Loading" />
      </Center>
    )
  }
  if (auth.status !== 'signedIn') {
    return <Navigate to="/welcome" replace state={{ from: location.pathname + location.search }} />
  }
  if (!roles.some((role) => auth.hasRole(role))) {
    return <NoAccessPage />
  }
  return <>{children}</>
}
