/** iOS Safari는 홈 화면에 추가된 PWA(standalone)에서만 Web Push를 받을 수 있다. */
export function isIOS(): boolean {
  const ua = window.navigator.userAgent;
  const isAppleTouch = /iPad|iPhone|iPod/.test(ua);
  const isIpadOSDesktopUA = ua.includes("Macintosh") && "ontouchend" in document;
  return isAppleTouch || isIpadOSDesktopUA;
}

export function isStandalone(): boolean {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

export function isPushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export interface PushSubscriptionPayload {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * 서비스워커 등록 → 알림 권한 요청 → 구독. 실패하면 null(권한 거부, 미지원 브라우저 등).
 * iOS Safari는 홈 화면에 추가하지 않은 상태에서 pushManager.subscribe()가 예외를 던진다 —
 * 여기서 잡지 않으면 호출부의 "알림 설정 중…" 상태가 영원히 안 풀린다.
 */
export async function subscribeToPush(vapidPublicKey: string): Promise<PushSubscriptionPayload | null> {
  if (!isPushSupported() || !vapidPublicKey) return null;

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      }));

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return null;

    return { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth };
  } catch {
    return null;
  }
}
