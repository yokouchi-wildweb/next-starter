---
paths:
  - "src/features/core/accountLifecycle/**"
  - "src/config/features/accountLifecycle.config.ts"
---
# features/accountLifecycle
what: self-service pause, withdraw and reactivate of one's own account (@/features/accountLifecycle): no table of its own, it moves users.status through user's services; screens /mypage/pause, /mypage/withdraw, /mypage/other, /reactivate
use: pause, withdraw, mypagePause, mypageWithdraw, mypageOther (the folder itself is in no rule's domains)
change: overlay = src/config/features/accountLifecycle.config.ts (withdraw.description) | screens: replace per route (SCREENS)
rules:
using:
- withdraw_cleanup: data of your domain to clear on withdraw → an item in user's cleanupHandlers receptacle (run inside the withdraw transaction)
editing:
- status_write: every users.status change goes through user's recordStatusTransition (CLAUDE.md user_status_history)
- withdraw_tx: the withdraw status change, executeCleanup and audit run in one transaction
- no_switch_in_config: config.ts holds values only | on / off lives in the gate rules (pause, withdraw, mypage*)
- reactivate_open: closing pause never blocks /reactivate or its API (users already paused must get back)
read: what each step does → Overview | endpoints → API | config keys → Extension | gate rules, what stays in other domains → Internals
