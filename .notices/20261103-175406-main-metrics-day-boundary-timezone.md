# DOWNSTREAM NOTICE id:20261103-175406-main-metrics-day-boundary-timezone
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:fix/bundle5 | commit:- (this commit)
date: 2026-11-04T16:40:00+09:00
severity: info
checkpoint: main-metrics-day-boundary-timezone
resolves: 20261103-175406-main-metrics-day-boundary-timezone
change: the admin dashboard main metrics ("本日のユーザー登録数", src/features/core/admin/dashboard/services/server/mainMetrics.ts) now cut "today" at 00:00 Japan time instead of 00:00 in the server's time zone. New helpers in src/utils/date.ts: startOfDayInTimeZone(at?, { timeZone }) and dayRangeInTimeZone(at?, { timeZone }) → { start, end } (default "Asia/Tokyo", the same rule as formatDateJa)
why: on Vercel the server runs in UTC, so "today" ran from 09:00 JST to 09:00 JST the next day and signups between 00:00 and 09:00 JST were counted on the previous day
required_actions: none
verify: pnpm test:utils-date passes (UTC and Pacific/Auckland); pnpm typecheck passes
manual_steps: -
refs: src/features/core/admin/dashboard/services/server/mainMetrics.ts | src/utils/date.ts | src/utils/date.test.ts | src/features/core/admin/dashboard/README.md | order 20261103-175406-main-metrics-day-boundary-timezone
notes: the number a fork sees changes. A fork whose server runs in UTC sees the today count move around JST midnight: signups between 00:00 and 09:00 JST now count on the new day (before, they counted on the previous one). A fork whose server already runs in Asia/Tokyo sees no change. The total count is unchanged. A fork that wants another business time zone can call dayRangeInTimeZone with { timeZone } in its own code
