---
paths:
  - "src/lib/firebase/**"
---
# lib/firebase
what: Firebase SDK setup for client (app, auth, fstore, Analytics) and server (Admin SDK getServerApp / Auth / Firestore / Storage, authAdmin user operations) (@/lib/firebase/client/*, @/lib/firebase/server/*)
use: always (boots unconfigured: NEXT_PUBLIC_FIREBASE_* and MY_SERVICE_ACCOUNT_KEY may be empty)
change: none → /order <direct parent> | Analytics on = env NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID + the analyticsConsent config
rules:
using:
- authorize_first: Admin SDK helpers skip the security rules → authorize before calling them
- files_via_storage: files go through @/lib/storage | business code never touches buckets with getServerStorage
- mounted_guard: a new always-mounted Firebase consumer (root layout) skips with isFirebaseClientConfigured (CLAUDE.md BACKENDS unconfigured)
- analytics_client: call Analytics only in useEffect or event handlers, never during render or on the server
- ga4_history: keep GA4's "page changes based on browser history events" off (it double-counts page_view)
editing:
- unconfigured_only: detect "not configured" only | configured but failing → the real error, never hidden
- lazy_firestore: the Firestore crud resolves Firestore at the first call, never at construction
- single_page_view: page_view is sent only by <FirebaseAnalytics /> | init keeps send_page_view: false
read: parts → Overview | set up Analytics, track events → Usage | server helpers, analytics functions → API | unconfigured mode → Internals
