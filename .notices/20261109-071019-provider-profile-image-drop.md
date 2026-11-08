# DOWNSTREAM NOTICE id:20261109-071019-provider-profile-image-drop
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-09T07:10:19+09:00
severity: action-required
checkpoint: provider-profile-image-drop
change: third-party login profile images are no longer stored for any provider | columns user_line_profiles.picture_url and user_x_profiles.profile_image_url are dropped from the schema | removed: linkLineAccount option pictureUrl, linkXAccount option profileImageUrl, UserLineProfile.pictureUrl / UserXProfile.profileImageUrl (model, schema, display, domain.json), lib/line verifyIdToken's picture, LineIdTokenPayload.picture, LineLinkResult.pictureUrl | the X callback calls client.v2.me() without user.fields | tables and their other columns stay; users.avatar untouched
why: the pushed schema no longer has the two columns (db:push drops them); fork code that passes or reads the removed fields fails typecheck
required_actions:
1. Merge upstream up to this checkpoint. Conflicts in src/features/core/userLineProfile/**, src/features/core/userXProfile/**, src/lib/line/**, src/app/api/auth/x/callback/route.ts: take upstream.
2. Forks whose LINE callback is still the old one (88-base, TriQ, next-vnx: src/app/api/auth/line/callback/route.ts passes `pictureUrl: linkResult.pictureUrl`): take upstream's src/app/api/auth/line/callback/route.ts (it passes only displayName). If your fork edited that file, delete only the `pictureUrl: linkResult.pictureUrl,` line.
3. Find and remove any own use of the removed names: `git grep -n -E "pictureUrl|profileImageUrl|picture_url|profile_image_url|\.picture\b" -- src` (README hits included) must find nothing in your own files; delete the lines that pass or read them (nothing upstream reads them, and no fork code reads them today).
4. [user-run] `pnpm db:push` (drops the two columns; the LINE picture URLs stored by the old callback in 88-base, TriQ, next-vnx are already expired CDN URLs and go with the column; no reader exists). Production: `pnpm db:push -- --env production` at a quiet time.
5. `pnpm db:push:check` must report zero statements; `pnpm typecheck`; `pnpm test src/features/core/userLineProfile src/features/core/userXProfile src/lib/line`.
verify: `git grep -n -E "pictureUrl|profileImageUrl|picture_url|profile_image_url" -- src` finds nothing; `pnpm db:push:check` reports zero statements; `pnpm typecheck` passes; `pnpm test src/features/core/userLineProfile src/features/core/userXProfile src/lib/line` passes
manual_steps: browser check of LINE link and X link once per fork (the human, council D91)
refs: order 20261108-173319-provider-profile-image-policy (council 20261020-195854 D95, D96), commit 70587b83 (LINE callback stopped storing picture_url), src/lib/line/README.md, src/lib/x/README.md
notes: checked read-only in the 5 forks (88-base, triq, boardgame-site, next-vnx, oripa-do): no file of their own outside the upstream files reads or writes these fields; 88-base, triq, next-vnx still have the old LINE callback line `pictureUrl: linkResult.pictureUrl` (step 2).
