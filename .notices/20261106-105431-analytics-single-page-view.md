# DOWNSTREAM NOTICE id:20261106-105431-analytics-single-page-view
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-06T10:54:31+09:00
severity: info
checkpoint: analytics-single-page-view
change: Firebase Analytics is initialized with send_page_view: false (initializeAnalytics instead of getAnalytics), so <FirebaseAnalytics /> is the only page_view sender; the first page was counted twice before (gtag's automatic page_view on init + the component's)
why: forks running Firebase Analytics (ANALYTICS_CONFIG.enabled true and NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID set) will see page_view (and session-start based page counts) drop from the deploy date; the earlier numbers were inflated by one page_view per page load
required_actions: none
verify: pnpm test:analytics-consent passes; in the browser Network tab, the first load sends one google-analytics.com/g/collect with en=page_view and each client navigation one more
manual_steps: if Analytics is enabled: (1) note the deploy date on your dashboards (page_view drops from then; compare before/after with care); (2) in GA4 Admin → Data streams → Enhanced measurement, turn off "Page changes based on browser history events", otherwise gtag also sends a page_view on each client navigation and navigations stay double counted
refs: src/lib/firebase/client/analytics.ts | src/lib/firebase/README.md「Firebase Analytics」 | order 20261106-092528-quest-analytics-double-page-view
notes: trackEvent / trackPageView names and arguments unchanged. The consent gate (nothing loaded or sent before consent) is unchanged and was re-checked in the browser.
