---
paths:
  - "src/lib/isClient/**"
---
# lib/isClient
what: useIsClient() (@/lib/isClient): false during SSR and hydration, true after; no dependencies, no config
use: always
change: none → /order <direct parent>
rules:
using:
- mounted_flag: "rendered on the client yet?" → useIsClient, never useEffect + setMounted(true)
read: when to use → Overview | example → Usage | values → API | how → Internals
