import type { AuthUser, UserRole } from '~/types/auth'

/** Messages tabs of the same browser exchange so every tab shows the same session. */
export type AuthSyncMessage =
  /** A new session was opened in another tab (sign-in or active-role switch). */
  | { type: 'session-changed', userUuid: string, activeRole: UserRole | null }
  /** The signed-in user's profile changed in another tab (name, photo, locale…). */
  | { type: 'user-updated', user: AuthUser }

let channel: BroadcastChannel | null | undefined

/**
 * The tab's single `BroadcastChannel('op-auth')`. One instance per tab on purpose: a channel
 * never receives its own messages, so the store (sender) and the `session-sync` plugin
 * (listener) sharing it means a tab never reacts to what it just did itself.
 * Null on the server and in browsers without BroadcastChannel.
 */
export function authChannel(): BroadcastChannel | null {
  if (channel !== undefined) return channel
  channel = import.meta.client && typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel('op-auth')
    : null
  return channel
}

/** Posts to the other tabs; never throws (a closed/unsupported channel just skips the sync). */
export function postAuthSync(message: AuthSyncMessage): void {
  try {
    authChannel()?.postMessage(message)
  }
  catch {
    // Sync is best-effort: each tab still recovers on its own next refresh.
  }
}
