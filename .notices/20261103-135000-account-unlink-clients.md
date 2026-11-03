# DOWNSTREAM NOTICE id:20261103-135000-account-unlink-clients
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:fix/bundle4 | commit:- (this commit)
date: 2026-11-03T13:50:00+09:00
severity: action-required
checkpoint: account-unlink-clients
resolves: 20261101-153803-account-unlink-clients
change: upstream ships POST /api/auth/line/unlink (src/app/api/auth/line/unlink/route.ts, createApiRoute access authenticated, skipForDemo, unlinkLineAccount(ctx user)) and two ClientServices: unlinkLine() in src/features/core/userLineProfile/services/client/userLineProfileClient.ts and unlinkX() in src/features/core/userXProfile/services/client/userXProfileClient.ts (axios + normalizeHttpError). No hook is shipped. src/lib/line/README.md and src/lib/x/README.md now point to them (the old LINE snippet read session.userId, a forbidden pattern)
why: forks wrote their own LINE unlink route and client copies from the README recipe; a fork-owned src/app/api/auth/line/unlink/route.ts now collides with the upstream file on merge
required_actions:
1. If the fork has src/app/api/auth/line/unlink/route.ts: on merge take upstream's file; if the fork's route did more than unlinkLineAccount(userId) (extra audit, redirect, response shape the UI reads), keep that behavior in a fork-owned route under a new path and point its client there instead
2. git grep -nE "auth/(line|x)/unlink" -- src ':!src/app/api' ':!src/features/core'; replace fork-owned client functions that post to these paths with unlinkLine / unlinkX from the files above and delete the copies; keep the fork's hooks (e.g. useUnlinkLine / useUnlinkX), now calling the upstream ClientServices
3. pnpm typecheck && pnpm lint
verify: pnpm typecheck and pnpm lint pass | step 2 grep shows only hooks / UI calling unlinkLine / unlinkX, no fork copy posting to the unlink paths
manual_steps: -
refs: src/app/api/auth/line/unlink/route.ts, src/app/api/auth/x/unlink/route.ts, src/features/core/userLineProfile/services/client/userLineProfileClient.ts, src/features/core/userXProfile/services/client/userXProfileClient.ts, src/lib/line/README.md, src/lib/x/README.md
notes: oripa-do has src/app/api/auth/line/unlink/route.ts and src/features/accountLink/services/client/{lineClient,xClient}.ts, hooks useUnlinkLine / useUnlinkX (bundle survey); its route content not compared. Other forks not checked. Routes not run live
