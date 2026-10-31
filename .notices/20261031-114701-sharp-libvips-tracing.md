# DOWNSTREAM NOTICE id:20261031-114701-sharp-libvips-tracing
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-10-31T11:47:01+09:00
severity: action-required
checkpoint: sharp-libvips-tracing
fixes: 20261026-063914-sharp-035
change: next.config.ts adds the sharp libvips lib directory to outputFileTracingIncludes["/api/**"], so libvips-cpp.so ships in API serverless functions
why: with sharp 0.35.5 the .so can be left out of the function file map on Vercel, so every server-side image strip fails in production (POST /api/me/storage/uploads/[id]/commit and POST /api/[domain]/[id]/duplicate return 500 with ERR_DLOPEN_FAILED: libvips-cpp.so.8.18.7). Local dev does not reproduce it
required_actions:
1. If next.config.ts already has your own entry for @img+sharp-libvips-linux-x64 (a stopgap), remove it and keep the upstream line only: git grep -n "sharp-libvips" -- next.config.ts
2. If your fork reaches stripImageMetadata or storageObjectService.commit / copy from outside src/app/api (SSR page / Server Action), add a route key with the same glob to outputFileTracingIncludes. Find callers: git grep -n "stripImageMetadata\|storageObjectService\.commit\|service\.copy" -- src
verify: pnpm typecheck | git grep -c "sharp-libvips-linux-x64" -- next.config.ts reports 1
manual_steps: After deploying to Vercel, confirm that uploading an image to a strip purpose (e.g. avatar) saves it, and that POST /api/[domain]/[id]/duplicate succeeds on a record with a legacy image URL. No error containing ERR_DLOPEN_FAILED should appear in the runtime logs
refs: next.config.ts, src/lib/storage/server/imageStrip.ts, .notices/20261026-063914-sharp-035.md, order 20261031-110700-sharp-libvips-missing-on-vercel
notes:
- Urgent: this commit is meant to be taken ahead of other upstream changes. A fork behind upstream may run `git cherry-pick -x <this commit>`, then add this notice to its ledger with upstream:<output of git merge-base HEAD upstream/main> (not this commit's sha: ownership:check reads upstream: as the merged upstream version)
- The repo owner confirmed that this fix resolves the failure on the downstream side. It was not run on Vercel from this repo
- Root cause (why tracing leaves the .so out, and whether sharp 0.34 was affected) is not established yet; order 20261031-110700 stays open for it, so this notice has no resolves:
- Size: the .so is about 19MB uncompressed and is added to each function matched by /api/**
- Glob: linux-x64 glibc only, which is the Vercel runtime. A stale node_modules can hold older libvips versions that also match, so measure size from a clean install
- No db:push
- Fork state: pandora holds an equivalent stopgap in next.config.ts; other forks not checked
