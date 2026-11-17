import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { api, apiBlob } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import type { Profile, ProfileUpdate } from './types'

const PROFILE = ['profile'] as const

export function useMyProfile() {
  return useQuery({
    queryKey: PROFILE,
    queryFn: ({ signal }) => api<Profile>('/api/me/profile', { signal }),
  })
}

/** Saves, then reloads /api/me so the header shows the new name and photo. */
function useProfileChange<T>(send: (input: T) => Promise<Profile>) {
  const client = useQueryClient()
  const auth = useAuth()
  return useMutation({
    mutationFn: send,
    onSuccess: async (profile) => {
      client.setQueryData(PROFILE, profile)
      await auth.refreshMe()
    },
  })
}

export function useSaveProfile() {
  return useProfileChange((update: ProfileUpdate) => api<Profile>('/api/me/profile', { method: 'PUT', body: update }))
}

export function useUploadPhoto() {
  return useProfileChange((file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api<Profile>('/api/me/photo', { method: 'POST', body: form })
  })
}

export function useRemovePhoto() {
  return useProfileChange(() => api<Profile>('/api/me/photo', { method: 'DELETE' }))
}

/**
 * A private picture as an address an <img> can show. It is fetched with the sign-in token instead
 * of linked directly. `version` changes with every new photo; null means there is none.
 */
export function usePrivateImage(path: string | null, version: string | null | undefined): string | null {
  const query = useQuery({
    queryKey: ['photo', path, version],
    queryFn: () => apiBlob(`${path}?v=${encodeURIComponent(version ?? '')}`),
    enabled: !!path && !!version,
    staleTime: Infinity,
    retry: false,
  })
  const url = useMemo(() => (query.data && version ? URL.createObjectURL(query.data) : null), [query.data, version])
  // The old picture's address is freed once a new one replaces it, or the avatar goes away
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url)
  }, [url])
  return url
}

/** A user's own photo (the user themselves, or an admin). */
export function usePhotoUrl(userId: string | undefined, version: string | null | undefined): string | null {
  return usePrivateImage(userId ? `/api/users/${encodeURIComponent(userId)}/photo` : null, version)
}
