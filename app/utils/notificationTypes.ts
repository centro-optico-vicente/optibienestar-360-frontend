import type { UserNotificationDto } from '~/types/notifications'

type Translate = (key: string, params?: Record<string, unknown>) => string

/** How one notification type looks in the UI. */
export interface NotificationTypeView {
  icon: string
  /** Shown as a toast (with a close button) when it arrives, besides the future inbox list. */
  toast: boolean
  title: (n: UserNotificationDto, t: Translate) => string
  body: (n: UserNotificationDto, t: Translate) => string
  /** Label of the action button (only when the notification has an `actionUrl`). */
  action?: (n: UserNotificationDto, t: Translate) => string
}

const fallbackTitle = (n: UserNotificationDto, t: Translate) => n.title || t('notifications.fallbackTitle')
const fallbackBody = (n: UserNotificationDto) => n.body || ''

/**
 * Registry of the known notification types (hub ADR 0039). Adding a type = one entry here plus its
 * `notifications.types.<TYPE>` texts in es/en; a type missing here still shows with the backend's fallback texts.
 */
export const NOTIFICATION_TYPES: Readonly<Record<string, NotificationTypeView>> = {
  REGISTRATION_APPROVED: {
    icon: 'i-lucide-party-popper',
    toast: true,
    title: (_n, t) => t('notifications.types.REGISTRATION_APPROVED.title'),
    body: (n, t) => {
      const name = typeof n.params?.name === 'string' ? n.params.name : ''
      return String(n.params?.kind ?? '').toUpperCase() === 'ALLY'
        ? t('notifications.types.REGISTRATION_APPROVED.bodyAlly', { name })
        : t('notifications.types.REGISTRATION_APPROVED.bodyMember')
    },
    action: (_n, t) => t('notifications.types.REGISTRATION_APPROVED.action'),
  },
}

const SEVERITY_ICON: Readonly<Record<string, string>> = {
  SUCCESS: 'i-lucide-circle-check',
  WARNING: 'i-lucide-triangle-alert',
  ERROR: 'i-lucide-circle-x',
}

/** View of a notification: the registered one, or a generic view built from the fallback texts. */
export function notificationView(type: string): NotificationTypeView {
  return NOTIFICATION_TYPES[type] ?? {
    icon: 'i-lucide-bell',
    toast: false,
    title: fallbackTitle,
    body: fallbackBody,
    action: (_n, t) => t('notifications.open'),
  }
}

/** Toast color of a severity (Nuxt UI semantic colors). */
export function notificationColor(severity: string): 'success' | 'warning' | 'error' | 'info' {
  switch (String(severity).toUpperCase()) {
    case 'SUCCESS': return 'success'
    case 'WARNING': return 'warning'
    case 'ERROR': return 'error'
    default: return 'info'
  }
}

export function notificationIcon(n: UserNotificationDto): string {
  return NOTIFICATION_TYPES[n.type]?.icon ?? SEVERITY_ICON[String(n.severity).toUpperCase()] ?? 'i-lucide-bell'
}
