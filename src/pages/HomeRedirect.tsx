import { Navigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { homeFor } from '../auth/roles'

/** "/" sends each user to the start page for their role. */
export function HomeRedirect() {
  const { me } = useAuth()
  return <Navigate to={me ? homeFor(me.roles) : '/welcome'} replace />
}
