# DOWNSTREAM NOTICE id:20261105-070608-analytics-opt-in-consent
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-05T07:06:08+09:00
severity: action-required
checkpoint: analytics-opt-in-consent
change: Firebase Analytics (page_view from <FirebaseAnalytics /> and trackEvent / trackPageView of @/lib/firebase/client/analytics) now sends nothing unless ANALYTICS_CONFIG.enabled is true (new src/config/app/analytics.config.ts, default false) AND consent allows it (consent "required" by default = waits for setAnalyticsConsent("granted") from new @/lib/analyticsConsent; "notRequired" = no wait). getAnalytics (gtag load) is not called before that. Setting NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID alone no longer turns it on.
why: Measurement features ship opt-in, and a consent banner / CMP needs a place to gate the tag. Without action, a fork that sends analytics today stops sending after this merge.
required_actions:
1. Merge upstream up to this checkpoint.
2. Check whether the fork sends Firebase Analytics: `git grep -n "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-" -- '.env*'` and the Vercel env, plus `git grep -n "trackEvent\|trackPageView" -- src`. If it does not, nothing more to do (keep the defaults).
3. To keep today's behavior (send without asking for consent): in src/config/app/analytics.config.ts set `enabled: true,` and `consent: "notRequired" as "required" | "notRequired",`.
4. If the fork shows a consent banner / CMP instead: set `enabled: true` and keep `consent: "required"`, and call `setAnalyticsConsent("granted" | "denied")` from @/lib/analyticsConsent at page load (stored choice) and when the choice changes. Mount an app-wide banner from src/app/_providers/ForkProviders.tsx. Example: src/lib/analyticsConsent/README.md.
verify: `pnpm typecheck` | `pnpm test:analytics-consent` | with the dev server, Firebase console Analytics > DebugView shows page_view after step 3 (or after granting consent in step 4), and nothing before.
manual_steps: -
refs: src/config/app/analytics.config.ts, src/lib/analyticsConsent/README.md, src/lib/firebase/README.md (Firebase Analytics), order 20261104-183246-analytics-toggle-consent
notes: oripa-do sends Firebase Analytics in production (MEASUREMENT_ID in .env.production, trackEvent in (marketing)/entry/_components) — step 3 or 4 is needed there (not checked in the oripa-do repo; taken from the order). src/lib/googleTag and src/lib/clarity are not gated by this yet and keep working from their env values. Server-side analytics (features/core/analytics, DAU) is unaffected.
