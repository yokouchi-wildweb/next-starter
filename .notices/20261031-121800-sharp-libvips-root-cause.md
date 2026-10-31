# DOWNSTREAM NOTICE id:20261031-121800-sharp-libvips-root-cause
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-10-31T12:18:00+09:00
severity: info
checkpoint: sharp-libvips-root-cause
resolves: 20261031-110700-sharp-libvips-missing-on-vercel
change: next.config.ts comment now states the root cause of the libvips tracing gap and when to remove the include. No behavior change
why: closes the order and records the root cause for forks. Turbopack in next 16.1 to 16.2 does not trace libvips-cpp.so for sharp 0.35, so the outputFileTracingIncludes line from 20261031-114701-sharp-libvips-tracing stays required until next is 16.3 or later
required_actions: none
verify: pnpm typecheck
manual_steps: -
refs: next.config.ts, .notices/20261031-114701-sharp-libvips-tracing.md, order 20261031-121719-next-upgrade-latest-stable
notes:
- Measured on a minimal app with sharp 0.35.5: next 16.1.1, 16.1.6, 16.2.0 and 16.2.12 Turbopack leave the .so out; 16.3.0 and 16.4.3 Turbopack and 16.1.1 --webpack include it. sharp 0.34.5 on next 16.1.1 includes it, so 0.34 was not affected
- Vercel CLI 65.4.0 uses Next's trace, so the function lacks the .so and dlopen fails. CLI 50.1.3 logs its own tracing and includes it, so testing with it hides the problem
- With the include on next 16.1.1 and CLI 65.4.0, the .so is in the file map and dlopen succeeds when the file map is laid out elsewhere. This repo itself was not built this way or deployed
- Keep the include until you are on next 16.3 or later. On 16.3.0 linuxmusl libvips is traced too: 41.4MB against 21.9MB on the minimal app
- A fork that hand-picked 20261031-114701 may get a comment conflict at merge; take the upstream text
- No db:push
