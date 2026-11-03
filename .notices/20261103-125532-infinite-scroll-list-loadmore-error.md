# DOWNSTREAM NOTICE id:20261103-125532-infinite-scroll-list-loadmore-error
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:fix/bundle4 | commit:- (this commit)
date: 2026-11-03T12:55:32+09:00
severity: info
checkpoint: infinite-scroll-list-loadmore-error
resolves: 20261102-160430-infinite-scroll-list-loadmore-error
change: InfiniteScrollList keeps the loaded items when a load-more (page 2+) fails: children(items) still renders and a footer shows 「続きの読み込みに失敗しました」 plus a 再試行 button when the new optional prop onRetry (pass the hook's retry) is given. errorNode now applies only to the initial-load error (error with 0 items). The sentinel is now a Flex with ref (same classes) instead of a raw div
why: info only: before, a failed page 2+ request replaced every loaded card with errorNode and offered no retry; existing props keep working, onRetry is optional
required_actions: none
verify: pnpm typecheck passes
manual_steps: -
refs: src/components/Widgets/InfiniteScrollList/index.tsx | src/components/Widgets/InfiniteScrollList/README.md | order 20261102-160430-infinite-scroll-list-loadmore-error
notes: to get the retry button, add onRetry={retry} to each <InfiniteScrollList> (retry comes from useInfiniteScrollQuery or the domain hook that returns it); without it the footer shows the message only. A fork whose errorNode assumed it also covers load-more failures now sees the list + footer instead. Upstream callers (auditLog, wallet, admin audit-logs) do not pass onRetry yet (outside this change's scope)
