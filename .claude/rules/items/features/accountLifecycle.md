---
paths:
  - "src/domains/core/accountLifecycle/**"
  - "src/config/domains/accountLifecycle.config.ts"
---
# domains/accountLifecycle
what: self-service pause, withdraw and reactivate of one's own account (@/domains/accountLifecycle): no table of its own, it moves users.status through user's services; screens /mypage/pause, /mypage/withdraw, /mypage/other, /reactivate, /reactivate/complete
use: pause, withdraw, mypagePause, mypageWithdraw, mypageOther (the folder itself is in no rule's domains)
change: counterpart = src/config/domains/accountLifecycle.config.ts (withdraw.description) | screens: replace per route (SCREENS)
rules:
using:
- withdraw_cleanup: data of your domain to clear on withdraw → an item in user's cleanupHandlers receptacle (run inside the withdraw transaction and the admin soft delete)
editing:
- status_write: every users.status change goes through user's recordStatusTransition (CLAUDE.md user_status_history)
- withdraw_tx: the withdraw status change, executeCleanup and audit run in one transaction
- no_switch_in_config: config.ts holds values only | on / off lives in the gate rules (pause, withdraw, mypage*)
- reactivate_open: the pause gate rule never lists /reactivate or /api/account-lifecycle/reactivate (users already paused keep the API) | the /reactivate screen loader returns notFound while pause is closed
read: what each step does → Overview | endpoints → API | config keys → Extension | gate rules, what stays in other domains → Internals
