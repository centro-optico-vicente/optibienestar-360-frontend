import type { Pinia } from 'pinia'
import type { UserNotificationDto } from '~/types/notifications'

const POLL_MS = 60_000
const MIN_GAP_MS = 15_000

/**
 * In-app notifications (hub ADR 0039): keeps the unread count fresh and shows each new toast-type notification
 * (e.g. `REGISTRATION_APPROVED`) as a toast with a close button. Closing it, or pressing its action, marks it read,
 * so it is shown once — on whichever device the person opens first, even if it arrived while signed out.
 *
 * Checks: on sign-in, on an active-role change (an approval swaps the pending role), when the window gets the
 * focus back, and every minute while the tab is visible.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const auth = useAuthStore(nuxtApp.$pinia as Pinia)
  const notifications = useNotifications()
  const toast = useToast()
  const router = useRouter()
  const t = (key: string, params?: Record<string, unknown>) => nuxtApp.$i18n.t(key, params ?? {}) as string

  /** Uuids already on screen in this tab (a toast left open is not added twice). */
  const shown = new Set<string>()
  let lastCheck = 0
  let running = false

  function showToast(n: UserNotificationDto) {
    shown.add(n.uuid)
    const view = notificationView(n.type)
    let handled = false
    const done = () => {
      if (handled) return
      handled = true
      void nuxtApp.runWithContext(() => notifications.markRead(n.uuid))
    }
    const actions = n.actionUrl && view.action
      ? [{
          label: view.action(n, t),
          color: 'neutral' as const,
          variant: 'outline' as const,
          onClick: () => {
            done()
            void router.push(n.actionUrl!)
          },
        }]
      : undefined
    toast.add({
      id: `notification-${n.uuid}`,
      title: view.title(n, t),
      description: view.body(n, t) || undefined,
      icon: notificationIcon(n),
      color: notificationColor(n.severity),
      duration: 0,
      close: true,
      actions,
      'onUpdate:open': (open: boolean) => {
        if (!open) done()
      },
    })
  }

  async function sync(force = false) {
    if (!auth.isAuthenticated || running) return
    const now = Date.now()
    if (!force && now - lastCheck < MIN_GAP_MS) return
    lastCheck = now
    running = true
    try {
      await nuxtApp.runWithContext(async () => {
        const before = notifications.unread.value.length
        const count = await notifications.fetchUnreadCount()
        if (count === 0 || (!force && count === before && before > 0)) return
        const list = await notifications.fetchUnread()
        list
          .filter(n => !shown.has(n.uuid) && notificationView(n.type).toast)
          // Oldest first, so the newest ends on top of the stack.
          .reverse()
          .forEach(showToast)
      })
    }
    finally {
      running = false
    }
  }

  watch(() => [auth.isAuthenticated, auth.activeRole] as const, ([isAuthenticated]) => {
    if (isAuthenticated) void sync(true)
    else {
      notifications.reset()
      shown.clear()
    }
  })

  const visibility = useDocumentVisibility()
  useEventListener(window, 'focus', () => void sync())
  watch(visibility, (state) => {
    if (state === 'visible') void sync()
  })
  useIntervalFn(() => {
    if (visibility.value === 'visible') void sync()
  }, POLL_MS)

  // A session restored from storage (page reload) is already authenticated once hydrated.
  nuxtApp.hook('app:mounted', () => {
    if (auth.isAuthenticated) void sync(true)
  })
})
