# DOWNSTREAM NOTICE id:20261103-175406-infinite-scroll-callers-on-retry
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-04T15:50:00+09:00
severity: info
checkpoint: infinite-scroll-callers-on-retry
resolves: 20261103-175406-infinite-scroll-callers-on-retry
change: Three upstream InfiniteScrollList callers now pass the optional onRetry (the hook's retry): admin audit-logs AuditLogSearchPanel, AdminWalletAdjustModal HistoryTabContent and the user WalletHistory. A failed load-more now shows the 「再試行」 button at the end of the list instead of the error text only. No new props, hooks or values.
why: Bundle 4 added onRetry to InfiniteScrollList but no upstream caller used it.
required_actions: none
verify: pnpm typecheck passes; pnpm lint passes
manual_steps: -
refs: src/components/Widgets/InfiniteScrollList/index.tsx, src/app/admin/(protected)/audit-logs/_screen/AuditLogSearchPanel.tsx, src/features/core/wallet/components/AdminWalletAdjustModal/HistoryTabContent.tsx, src/features/core/wallet/components/WalletHistory/index.tsx
notes: Not wired: AuditLogListView (auditLog/components/common/AuditTimeline, reached by AuditTimeline / UserActivityTimeline / AdminUserManageModal HistoryTab) — its AuditLogListQuery type has no retry, and adding it is a new prop; left to the planned split of that part. A fork screen in _components/ that renders InfiniteScrollList with a useInfiniteScrollQuery-based hook can pass onRetry={retry} the same way (optional).
