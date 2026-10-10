/**
 * Profile photo of the authenticated user (/v1/me/photo). Any role manages its
 * own photo; the URL is shared app-wide through `useState` so the sidebar
 * avatar updates as soon as the portal uploads a new one.
 */
export const useProfilePhoto = () => {
  const photoUrl = useState<string | null>('profile-photo-url', () => null)
  const loaded = useState<boolean>('profile-photo-loaded', () => false)

  const refresh = async () => {
    try {
      const res = await useApi<{ photoUrl: string | null }>('/v1/me/photo')
      photoUrl.value = res.photoUrl
    }
    catch {
      photoUrl.value = null
    }
    finally {
      loaded.value = true
    }
  }

  /** Lazy first load — call from any component that renders the avatar. */
  const ensure = () => (loaded.value ? Promise.resolve() : refresh())

  const upload = async (file: File) => {
    const form = new FormData()
    form.append('image', file)
    const res = await useApi<{ photoUrl: string | null }>('/v1/me/photo', { method: 'POST', body: form })
    photoUrl.value = res.photoUrl
  }

  const remove = async () => {
    await useApi('/v1/me/photo', { method: 'DELETE' })
    photoUrl.value = null
  }

  return { photoUrl, refresh, ensure, upload, remove }
}
