import type { UnreadCountDto, UserNotificationDto } from '~/types/notifications'

interface Page<T> { content?: T[] }

/**
 * In-app notifications of the signed-in user (hub ADR 0039, `/v1/me/notifications`), shared through `useState`.
 * The `notifications` plugin polls the unread count and turns new toast-type notifications into toasts; a later
 * phase adds the bell and the history list on top of the same state.
 *
 * Every call is silent: while the backend does not have the endpoint yet (404) the app just shows nothing.
 */
export const useNotifications = () => {
  const unreadCount = useState<number>('notifications:unread-count', () => 0)
  const unread = useState<UserNotificationDto[]>('notifications:unread', () => [])

  async function fetchUnreadCount(): Promise<number> {
    try {
      const res = await useApi<UnreadCountDto>('/v1/me/notifications/unread-count', { silent: true })
      unreadCount.value = Math.max(0, Number(res?.count ?? 0))
    }
    catch {
      // Endpoint missing or session ending: keep the last value.
    }
    return unreadCount.value
  }

  async function fetchUnread(size = 20): Promise<UserNotificationDto[]> {
    try {
      const res = await useApi<Page<UserNotificationDto> | UserNotificationDto[]>('/v1/me/notifications', {
        query: { unread: true, size },
        silent: true,
      })
      unread.value = Array.isArray(res) ? res : res?.content ?? []
    }
    catch {
      unread.value = []
    }
    return unread.value
  }

  async function markRead(uuid: string): Promise<void> {
    unread.value = unread.value.filter(n => n.uuid !== uuid)
    unreadCount.value = Math.max(0, unreadCount.value - 1)
    try {
      await useApi(`/v1/me/notifications/${uuid}/read`, { method: 'POST', silent: true })
    }
    catch {
      // Not critical: it shows again on the next load and can be closed then.
    }
  }

  async function markAllRead(): Promise<void> {
    unread.value = []
    unreadCount.value = 0
    try {
      await useApi('/v1/me/notifications/read-all', { method: 'POST', silent: true })
    }
    catch {
      // Same as markRead.
    }
  }

  function reset() {
    unreadCount.value = 0
    unread.value = []
  }

  return { unreadCount, unread, fetchUnreadCount, fetchUnread, markRead, markAllRead, reset }
}
