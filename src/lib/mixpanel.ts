import mixpanel from 'mixpanel-browser';

/**
 * Vite exposes env vars via import.meta.env.
 * Supports both VITE_MIXPANEL_TOKEN and NEXT_PUBLIC_MIXPANEL_TOKEN
 * (vite.config envPrefix includes NEXT_PUBLIC_).
 */
const token =
  (import.meta.env.VITE_MIXPANEL_TOKEN as string | undefined) ||
  (import.meta.env.NEXT_PUBLIC_MIXPANEL_TOKEN as string | undefined) ||
  '';

let initialized = false;

if (token) {
  mixpanel.init(token, {
    debug: import.meta.env.MODE !== 'production',
    track_pageview: true,
    persistence: 'localStorage',
    ignore_dnt: true,
  });
  initialized = true;
} else if (import.meta.env.MODE !== 'production') {
  console.warn(
    '[mixpanel] No token found (VITE_MIXPANEL_TOKEN / NEXT_PUBLIC_MIXPANEL_TOKEN). Tracking disabled.'
  );
}

export const mp = mixpanel;

function insertId(): string {
  return crypto.randomUUID();
}

export function identifyUser(userId: string, traits: Record<string, unknown>) {
  if (!initialized) return;
  mixpanel.identify(userId);
  mixpanel.people.set({
    ...traits,
    platform: 'ai_policy_foundry',
  });
}

export function trackEvent(event: string, props: Record<string, unknown> = {}) {
  if (!initialized) return;
  mixpanel.track(event, {
    ...props,
    platform: 'ai_policy_foundry',
    timestamp: new Date().toISOString(),
    $insert_id: insertId(),
  });
}
