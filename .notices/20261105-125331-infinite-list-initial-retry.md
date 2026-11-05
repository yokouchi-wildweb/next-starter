# DOWNSTREAM NOTICE id:20261105-125331-infinite-list-initial-retry
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:ui/infinite-list-retry | commit:- (this commit)
date: 2026-11-05T12:53:31+09:00
severity: info
checkpoint: infinite-list-initial-retry
change: InfiniteScrollList now also shows a "再試行" button when the first page fails (below errorNode or the default error), whenever `onRetry` is passed; before, onRetry was used only for a failed later page. AuditLogListQuery (core auditLog AuditLogListView) gained optional `retry`, which AuditTimeline / UserActivityTimeline now pass through, so audit timelines can retry. New devDependency jsdom (+ @types/jsdom) for the render test src/hooks/useInfiniteScrollQuery.retry.test.tsx (added to pnpm test:infinite-scroll).
why: Visible behavior change: fork screens that pass both errorNode and onRetry to InfiniteScrollList get a retry button under their errorNode on a first-page failure. No code change is needed.
required_actions: none
verify: pnpm typecheck passes including upstream _screen/* default screens even where your page.tsx points to _components/; a failure there = your fork's core edit is not backward compatible (CLAUDE.md CORE_FILES fork_core_edit_compat) — fix the core side, do not edit the upstream Screen | pnpm test:infinite-scroll
manual_steps: -
refs: src/components/Widgets/InfiniteScrollList/index.tsx, src/components/Widgets/InfiniteScrollList/README.md, src/features/core/auditLog/components/common/AuditTimeline/AuditLogListView.tsx, src/hooks/useInfiniteScrollQuery.retry.test.tsx, order 20261105-113817-infinite-query-retry-for-lists
notes: If a fork's own errorNode already contains its own retry button, remove it from the errorNode (the list now adds one) to avoid two buttons: `git grep -n "errorNode" -- src` and look for a retry inside it. useInfiniteScrollQuery already returned `retry`; no change there.
