# DOWNSTREAM NOTICE id:20261022-190000-storage-api-admin-only
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-10-22T19:00:00+09:00
severity: action-required
checkpoint: storage-api-admin-only
change: SECURITY stopgap. POST /api/storage/upload and POST /api/storage/delete (src/app/api/storage/*) are now `access: { roleCategories: ["admin"] }` instead of "authenticated" (unauthenticated → 401, non-admin → 403). This is the path used by `useAppStorage` / `appStorageClient` (src/lib/storage). Client-direct uploads (clientUploader / directStorageClient / useDirectStorage) are unchanged.
why: the routes accepted any basePath and deleted any object path with no owner check, so any logged-in user could overwrite or delete arbitrary files in the bucket. The full redesign (policy registry, signed upload URLs, engine abstraction) is under council review: 20261022-121853-storage-authority-policy-redesign. Until then the routes are closed to non-admins.
required_actions:
1. Merge upstream. Then check whether fork-owned code lets NON-admin users reach these routes: `grep -rnE "useAppStorage|appStorageClient|/api/storage/(upload|delete)" src --include=*.ts --include=*.tsx` (ignore hits inside src/lib/storage/ and src/app/api/storage/, and comment-only hits). If there are none, nothing else to do.
2. If a non-admin screen uses them, do NOT widen the upstream route back to "authenticated". Instead add a fork-owned route for that one use case (createMeRoute, fixed server-side path prefix that includes `user.userId`, size / content-type limits, delete only paths under that prefix) and point the screen at it, or switch that screen to the client-direct path guarded by Storage rules scoped to the user's own prefix. Record the route in project.md as a temporary measure until the storage redesign lands.
verify: `npx tsc --noEmit` passes | `grep -n "roleCategories" src/app/api/storage/upload/route.ts src/app/api/storage/delete/route.ts` shows the admin rule in both
manual_steps: Review your Firebase Storage rules: if they are still `allow read, write: if request.auth != null;` (the tentative setup in docs/setup), any logged-in user can overwrite or delete any object through the client SDK. Narrow write rules to the paths your app actually uses until the redesign ships.
refs: src/app/api/storage/upload/route.ts, src/app/api/storage/delete/route.ts, src/lib/storage/README.md (⚠️ /api/storage/* は暫定で管理者専用)
notes: Checked forks 88-base, TriQ, boardgame-site, next-vnx, oripa-do, pandora, voranowa, oripa-do-2, oripa-demo: none call these routes from code (only stale comments in bank-transfer files, fixed upstream in this commit). No DB change.
