// In-app notifications (hub ADR 0039): the inbox of the signed-in user, `/v1/me/notifications`.
// Not to be confused with the outgoing email queue (`notifications`, backend V28): that one only sends mail.

/** Open code of the notification kind (`REGISTRATION_APPROVED`, later `PAYMENT_APPROVED`, `BIRTHDAY_TEAM`…). */
export type NotificationType = 'REGISTRATION_APPROVED' | (string & {})

/** Groups the inbox and, in a later phase, the per-category preferences. */
export type NotificationCategory =
  | 'ACCOUNT'
  | 'PAYMENTS'
  | 'COMMISSIONS'
  | 'MEMBERSHIP'
  | 'NETWORK'
  | 'CELEBRATIONS'
  | (string & {})

export type NotificationSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | (string & {})

export interface UserNotificationDto {
  uuid: string
  type: NotificationType
  category: NotificationCategory
  severity: NotificationSeverity
  /** Values the frontend text of the type interpolates (`notifications.types.<TYPE>.*`). */
  params?: Record<string, unknown> | null
  /** Fallback texts (Spanish) for a type this frontend does not know yet. */
  title?: string | null
  body?: string | null
  /** Internal route the action button opens. */
  actionUrl?: string | null
  createdAt: string
  createdAt_Display?: string | null
  readAt?: string | null
  read?: boolean
}

/** GET /v1/me/notifications/unread-count */
export interface UnreadCountDto {
  count: number
}
