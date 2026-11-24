# DOWNSTREAM NOTICE id:20261125-025737-ratelimit-count-fix
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:g2/20261124-161115/junction | commit:- (this commit)
date: 2026-11-25T02:57:37+09:00
severity: action-required
checkpoint: ratelimit-count-fix
uses: .notices/20261125-025737-ratelimit-count-fix.mjs
change: checkRateLimit (and the route rateLimit / rateLimitSubnet built on it) now lets maxRequests requests through per window; before it stopped one request early (maxRequests - 1, and 1 for a value of 1 or 2). Upstream category values are unchanged, so every category passes one more request per window
why: a fork that tuned a category against the old count gets one more pass per window unless it lowers that value by 1; only the fork knows which of its own values should keep today's count
required_actions:
1. `node .notices/20261125-025737-ratelimit-count-fix.mjs` (dry-run: lists only the categories your src/config/domains/rateLimit.config.ts added through Extra or whose maxRequests differs from upstream; a value of 1 is reported as unchanged and not asked; a maxRequests that is not a number literal (an expression, a call, a name) is listed under 「手で見る」 with its source text and never written)
2. ask the human, one category at a time: 「今と同じにする(maxRequests を 1 減らす)/ そのまま(1 回多く通す)」
3. `node .notices/20261125-025737-ratelimit-count-fix.mjs --apply <name>=same|keep …` with the answers (it marks each row it handled; running it again changes nothing), commit the config apart from the merge
4. each 「手で見る」 row: ask the human the same question; for 「今と同じにする」 lower each number inside the expression by 1 by hand (e.g. `isDevelopment() ? 100 : 7` → `isDevelopment() ? 99 : 6`), commit it with step 3
verify: the dry-run prints nothing left to ask (「手で見る」 rows stay listed: they are yours) | `git diff` touches only src/config/domains/rateLimit.config.ts
manual_steps: -
refs: src/domains/core/rateLimit/README.md; .claude/rules/items/domains/rateLimit.md; src/config/domains/rateLimit.config.ts
notes: key table: no key of CLAUDE.md / core / cards renamed or removed | upstream's own categories keep their values (each passes one more); a fork that wants today's count for an upstream category it did not tune lowers it in its config by hand | the tool reads only the config file by AST and stops (exit 2, writes nothing) on an unknown name, a 「手で見る」 name given to --apply or an answer other than same / keep
