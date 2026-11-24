# DOWNSTREAM NOTICE id:20261125-065349-bank-transfer-date-timezone
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:qc/kagerou/o/20261125-065133-bank-transfer-date-timezone | commit:- (this commit)
date: 2026-11-25T06:53:49+09:00
severity: info
checkpoint: bank-transfer-date-timezone
resolves: 20261125-061454-bank-transfer-date-timezone
change: formatBankTransferDate (src/domains/core/bankTransferReview/presenters.ts, re-exported from @/domains/core/bankTransferReview) now writes Japan time through the shared formatDateJa (Asia/Tokyo) instead of toLocaleString in the runtime's time zone; same name, arguments and "YYYY/MM/DD HH:mm" / "-" output shape
why: the admin bank-transfer review list and detail modal render on the server first, so the times came out in UTC (Vercel) or shifted at hydration
required_actions: none (a fork that calls formatBankTransferDate gets Japan time with no change)
verify: the review list's 審査日時 / 申請日時 and the detail modal show the same Japan-time value on the server render and after hydration
manual_steps: -
refs: src/domains/core/bankTransferReview/presenters.ts, src/domains/core/bankTransferReview/presenters.test.ts, src/utils/date.ts (formatDateJa)
notes: -
