# DOWNSTREAM NOTICE id:20261103-133000-format-date-ja-fixed-zone
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:fix/bundle4 | commit:- (this commit)
date: 2026-11-03T13:30:00+09:00
severity: action-required
checkpoint: format-date-ja-fixed-zone
resolves: 20261101-160324-format-date-ja-timezone
change: formatDateJa (src/utils/date.ts) now formats instants in a fixed zone, default "Asia/Tokyo", with a new optional option timeZone (IANA name); before it followed the runtime zone (Vercel server = UTC, browser = the device). "YYYY-MM-DD" date-only strings are written as that date with no zone shift. date.ts now loads dayjs/locale/ja itself (weekday / month names in Japanese on server and browser alike). It registers the dayjs utc + timezone plugins on the shared dayjs instance
why: server-rendered output differed from the browser (hydration error #418 on cards, a UTC date in server-side mail such as bankTransferReview bulkSendEmail between 0:00 and 9:00 JST); presenters, admin tables and mails now print the same date everywhere
required_actions:
1. If the fork serves users outside Japan and wants their local zone, pass formatDateJa(value, { timeZone: "<IANA zone>" }) at its call sites (git grep -n "formatDateJa(" -- src); otherwise nothing to change
2. If the fork added its own fixed-zone helper for the same purpose (e.g. a tokyoDayjs used only to avoid #418 around formatDateJa), it may switch back to formatDateJa; keep it if it serves other code
3. pnpm typecheck
verify: pnpm typecheck passes | pnpm test:utils-date passes
manual_steps: -
refs: src/utils/date.ts, src/utils/date.test.ts | research guild 20261101-144249 bundle1-recon.detail.md Q7
notes: dayjs.extend(utc / timezone) adds .utc() / .tz() and does not change other dayjs calls; no tz default is set. Not changed here: src/features/core/admin/dashboard/services/server/mainMetrics.ts:28 dayjs().startOf("day") still follows the server zone (follow-up order candidate). boardgame-site had its own tokyoDayjs (fdb2c9dc, from the order); other forks not checked
