// VAPID public key is read from a meta tag injected at build time — no
// separate endpoint needed.
//
// IMPORTANT: this file runs in the browser only — no Node.js imports.

export async function getOrCreateSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null

  // Register service worker if not already registered
  const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  await navigator.serviceWorker.ready

  // Return existing subscription if present
  const existing = await reg.pushManager.getSubscription()
  if (existing) return existing

  // Request permission — browser will only prompt once; denied = null forever
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null

  // Read VAPID public key from meta tag
  const vapidMeta = document.querySelector<HTMLMetaElement>('meta[name="vapid-public-key"]')
  const vapidPublicKey = vapidMeta?.content
  if (!vapidPublicKey) {
    console.warn('VAPID public key not found in meta tag')
    return null
  }

  // Subscribe
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  })

  // Send to server
  const sub = subscription.toJSON()
  const res = await fetch('/api/push-subscriptions', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      endpoint: sub.endpoint,
      p256dh: sub.keys?.p256dh,
      auth: sub.keys?.auth,
      userAgent: navigator.userAgent.slice(0, 200),
    }),
  })
  if (!res.ok) {
    throw new Error(`Failed to register push subscription: ${res.status}`)
  }

  return subscription
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}
