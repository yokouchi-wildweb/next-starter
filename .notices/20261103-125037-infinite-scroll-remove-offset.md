# DOWNSTREAM NOTICE id:20261103-125037-infinite-scroll-remove-offset
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:fix/bundle4 | commit:- (this commit)
date: 2026-11-03T12:50:37+09:00
severity: info
checkpoint: infinite-scroll-remove-offset
resolves: 20261102-160430-infinite-scroll-remove-offset
change: useInfiniteScrollQuery counts the rows removeItems took out since the last fetch; the next loadMore / retry / sentinel fetch re-reads the page that holds the rows that slid forward and drops the already-loaded head (new pure export computeNextFetchPosition(lastFetchedPage, limit, removedCount) => { page, skip }). nextPage reflects the correction. Hook API otherwise unchanged; updateItems / revalidate / reset unchanged (reset / deps / a page-1 replace clear the count). New test: pnpm test:infinite-scroll
why: info only: after removeItems(k rows) the next page started k rows late, so k rows never showed until reload; fixed inside the hook, callers keep calling removeItems as before
required_actions: none
verify: pnpm typecheck passes | pnpm test:infinite-scroll passes
manual_steps: -
refs: src/hooks/useInfiniteScrollQuery.ts (computeNextFetchPosition, removeItems) | src/hooks/useInfiniteScrollQuery.test.ts | src/components/Widgets/InfiniteScrollList/README.md | order 20261102-160430-infinite-scroll-remove-offset
notes: removeItems must mirror a server-side removal (delete / status change out of the filter), as the action_optimistic rule already says; a fork that used removeItems to hide rows the server still returns will see those rows again on the next load (one re-read page). Rows removed while a load-more is in flight are carried to the following fetch
