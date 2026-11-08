# DOWNSTREAM NOTICE id:20261109-065309-date-default-fallback
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:legate/20261023-175358-config-redesign.1 | commit:- (this commit)
date: 2026-11-09T06:53:09+09:00
severity: info
checkpoint: date-default-fallback
change: formatDateJa (src/utils/date.ts) no longer reads src/config/ui/ui-behavior-config.ts: its default fallback (no value / unparsable) is the exported constant DEFAULT_FALLBACK = "(未設定)", the value it returned before with upstream's config | a call that passes `fallback` behaves as before | the admin tables keep passing their own UI_BEHAVIOR_CONFIG adminDataTable.emptyFieldFallback
why: utils are units and read no config (council D22 K2); the admin config can later move to the admin district without touching utils. A fork that changed adminDataTable.emptyFieldFallback would no longer see that value in formatDateJa calls without `fallback` (none of the five forks changed it: all keep "(未設定)")
required_actions: none
verify: pnpm test src/utils/date.test.ts
manual_steps: -
refs: src/utils/date.ts, src/utils/date.test.ts, council 20261023-175358-config-redesign decision D22, legate:l1 order:33
notes: if your fork wants another empty text in non-table places, pass `fallback` at the call (or wrap formatDateJa in your own util); emptyFieldFallback stays the admin tables' value.
