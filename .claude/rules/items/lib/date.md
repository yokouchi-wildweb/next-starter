---
paths:
  - "src/lib/date/**"
---
# lib/date
what: the date lib: the project's dayjs setup (ja locale, customParseFormat), flexible input parsing (parseFlexibleDate / Time / Datetime) and the one date-like rule toDayjs (string trimmed / number / Date / dayjs → Dayjs | null) with formatDateLike(value, pattern) | closed lib: entry @/lib/date only
use: always
change: none → /order <direct parent>
rules:
using:
- date_like_once: turning a date-like value into dayjs goes through toDayjs / formatDateLike | never a local "string | number | Date | dayjs → dayjs" check
- date_caller_job: what an unreadable value shows (typed text, null, a fallback) stays with the caller
editing:
- date_deps: reads dayjs only (no domain, SDK or React), so the shelf may read it by value
read: functions → API | Tokyo-time display → Related
