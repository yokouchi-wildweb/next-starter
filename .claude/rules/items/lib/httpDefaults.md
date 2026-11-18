---
paths:
  - "src/lib/httpDefaults/**"
  - "src/config/lib/httpDefaults.config.ts"
---
# lib/httpDefaults
what: an app-wide default timeout for client axios calls that set none (one request interceptor on the default axios instance, installed by HttpDefaultsRoot in src/wiring/AppProviders.tsx) | entry @/lib/httpDefaults
use: always
change: placement = src/config/lib/httpDefaults.config.ts (@lib-config/httpDefaults: timeoutMs; upstream ships none)
rules:
using:
- no_limit_marker: a call that must run without a limit writes `defaultTimeout: false` (axios cannot tell unset from 0)
- own_timeout_wins: a call's own `timeout` always wins over the default
editing:
- defaults_untouched: never write `axios.defaults` (axios.create copies them, so the limit would leak into direct uploads) | only the default instance gets the interceptor
- no_retry: the interceptor never retries (a write could run twice)
- client_only: server fetch is out of scope
read: config → Extension | how it applies → Internals | tests → Verification
