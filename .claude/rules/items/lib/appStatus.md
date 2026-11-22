---
paths:
  - "src/lib/appStatus/**"
  - "src/config/lib/appStatus.config.ts"
---
# lib/appStatus
what: useAppStatus watches /api/health on long-stay screens: maintenance → go to the maintenance path, new deploy → reload (callbacks replace either) | entry @/lib/appStatus
use: always
change: counterpart = src/config/lib/appStatus.config.ts (healthPath, maintenancePath, intervalMs)
rules:
using:
- one_call: call useAppStatus once in the screen's client part; never a guard component of your own around it
- own_reaction: a different reaction (a notice, an update banner) = onMaintenance / onNewDeploy, never a second poller
editing:
- response_contract: AppStatusResponse is the /api/health body | the route keeps `satisfies AppStatusResponse`, a key change goes to both in one commit
- no_router: the lib reads no router (full navigation with window.location) and no shelf part
- bypass_server_side: whether the viewer is blocked is decided by /api/health (same logic as the proxy), never re-judged here
read: call it → Usage | options, types → API | config keys → Extension
