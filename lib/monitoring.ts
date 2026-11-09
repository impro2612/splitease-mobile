import * as Sentry from "@sentry/react-native"

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN

// Off in dev and until a DSN exists, so the app costs nothing before Sentry is set up
const enabled = typeof DSN === "string" && DSN.length > 0 && !__DEV__

let initialised = false

/** Starts Sentry once. Safe to call when disabled or misconfigured. */
export function initMonitoring() {
  if (!enabled || initialised) return
  initialised = true
  try {
    Sentry.init({
      dsn: DSN,
      enableAutoSessionTracking: true,
      tracesSampleRate: 0.1,
      environment: __DEV__ ? "development" : "production",
      sendDefaultPii: false,
      beforeSend(event) {
        // Ids only: never ship email or username to a third party
        if (event.user) {
          delete event.user.email
          delete event.user.username
        }
        return event
      },
    })
  } catch (e) {
    console.warn("[monitoring] init failed", e)
  }
}

/** Reports a caught error with optional context. No-op when monitoring is off. */
export function captureError(err: unknown, context?: Record<string, unknown>) {
  if (!enabled) return
  try {
    Sentry.captureException(err, context ? { extra: context } : undefined)
  } catch {
    // Monitoring must never take the app down
  }
}

/** Ties events to a user id (never email) so one user's crashes group together. */
export function setMonitoringUser(user: { id: string } | null) {
  if (!enabled) return
  try {
    Sentry.setUser(user ? { id: user.id } : null)
  } catch {
    // See captureError
  }
}

/** Wraps the root component for touch breadcrumbs and native crash context. */
export function wrapRoot<T>(component: T): T {
  if (!enabled) return component
  try {
    return Sentry.wrap(component as unknown as React.ComponentType<Record<string, unknown>>) as unknown as T
  } catch {
    return component
  }
}
