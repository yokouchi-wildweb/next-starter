# DOWNSTREAM NOTICE id:20261125-025303-ratelimit-consume
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:g2/20261124-161115/junction | commit:- (this commit)
date: 2026-11-25T02:53:03+09:00
severity: action-required
checkpoint: ratelimit-consume
change: (1) new consumeRateLimit({ key: { scope, identifier }, rule: <category> | { window: "fixed" | "sliding", windowSeconds, bucketSeconds? (sliding), limit }, weight? = 1, tx? }) → RateLimitResult and peekRateLimit (same key and rule, reads only) from the rateLimit domain's services/server: counts right (limit requests pass), a non-category scope is "<district>.<name>", fixed = one atomic upsert, sliding = bucket rows in rate_limits summed in one TX under a key advisory lock, tx = the caller's transaction; (2) checkRateLimit, getRateLimitStatus and judgmentRateLimit now sit on top with the same names, arguments and results; checkRateLimit still passes one request fewer than the category's value (fixed in the next segment); the route rateLimit / rateLimitSubnet, ipRate and pairedDevice callers are unchanged; (3) rate_limits gains column key and index rate_limits_key_window_idx (key, window_start)
why: the table changes (one column, one index) and needs db:push; behaviour stays as before except the two points in notes
required_actions:
1. [user-run] pnpm db:push (adds rate_limits.key and rate_limits_key_window_idx)
2. pnpm db:push:check (must report 0 statements)
verify: pnpm db:push:check reports 0 statements
manual_steps: -
refs: src/domains/core/rateLimit/README.md; .claude/rules/items/domains/rateLimit.md
notes: key table: no key of CLAUDE.md / core / cards renamed or removed | checkRateLimit is now atomic: the same number of sequential requests pass; under a burst of concurrent requests it no longer lets extra ones through | the two bank-transfer judgment counters move to scopes rateLimit.judgeFail15m / rateLimit.judgeAttempt24h: at deploy they start fresh once (at most 15 minutes / 24 hours of counts) | rows of sliding windows grow per key × bucket; their deletion comes with the expiry segments of this plan
