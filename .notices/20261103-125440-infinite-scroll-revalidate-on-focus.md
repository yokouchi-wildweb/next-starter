# DOWNSTREAM NOTICE id:20261103-125440-infinite-scroll-revalidate-on-focus
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:fix/bundle4 | commit:- (this commit)
date: 2026-11-03T12:54:40+09:00
severity: info
checkpoint: infinite-scroll-revalidate-on-focus
resolves: 20261102-160430-infinite-scroll-revalidate-on-focus
change: useInfiniteScrollQuery gains an opt-in option revalidateOnFocus (default false). When true, returning to the tab (visibilitychange → visible, or window focus) calls revalidate(): items stay on screen while page 1 is re-fetched and replaces them. Throttled to once per 5s; skipped before the first fetch completes, while a fetch is in flight and while enabled=false
why: info only: lists moved from SWR lost its default refresh on tab return; existing callers see no change unless they pass the option
required_actions: none
verify: pnpm typecheck passes
manual_steps: -
refs: src/hooks/useInfiniteScrollQuery.ts (revalidateOnFocus) | src/components/Widgets/InfiniteScrollList/README.md「注意」 | order 20261102-160430-infinite-scroll-revalidate-on-focus
notes: a fork that wants it (e.g. message conversations / threads) adds revalidateOnFocus: true to its useInfiniteScrollQuery call. Same semantics as revalidate(): a list loaded past page 1 shrinks back to page 1 on refresh (no blanking), later pages load again on scroll
