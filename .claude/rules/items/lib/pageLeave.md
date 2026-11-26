---
paths:
  - "src/lib/pageLeave/**"
---
# lib/pageLeave
what: useOnPageLeave(onLeave) (@/lib/pageLeave): calls onLeave only when the page is really left (hidden by <Activity> under cacheComponents, or unmounted), never on StrictMode's simulated remount; no dependencies, no config
use: always
change: none → /order <direct parent>
rules:
using:
- per_visit_reset: an init that must run on every visit and is guarded by a ref → reset the ref and its state in useOnPageLeave (core/client.md activity_state)
- keep_intended: never reset what should stay on return (drafts, scroll, double-submit locks, once-only firing)
read: when to use → Overview | example → Usage | the lint and rule → Related
