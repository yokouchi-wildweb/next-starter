# DOWNSTREAM NOTICE id:20261101-161600-upstream-fix-correctness
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:054527b3
date: 2026-11-01T16:16:00+09:00
severity: action-required
checkpoint: bundle1-correctness-fixes
resolves: 20261029-221452-upstream-fix-correctness
change: LINE callback stops storing pictureUrl | SeedResultMap.demoUser = the user row and the registry fn returns it | user frame BackgroundLayer uses var(--background) | ControlledMediaUploader puts "" instead of null in the form value when empty | coin issuance comments and README table state today's source set
why: the background layer was transparent (hsl around an oklch token) and now paints the token, which can change a fork's look | a hand-written schema that refuses "" now fails on an emptied media field
required_actions:
1. git grep -n "storageMediaValueSchema" -- src outside src/lib/storage/; a form schema with a bare storageMediaValueSchema.nullish() must accept "": use the generated line or add emptyToNull before it
2. a direct caller of ControlledMediaUploader passing defaultUrl no longer falls back to it after a clear: pass the value through the form value
3. if the fork relied on the transparent layer, for example a background on body under the user frame, set --background or the frame background in its own overrides.css
4. a fork carrying its own copy of these fixes under a permit naming this order (LINE callback, ControlledMediaUploader, MediaUploader): drop the copy and take upstream's version. MediaUploader stays as it was: staying in the uploading state after failure was rejected because inside AppForm it disables submit, clear and re-pick
verify: `pnpm typecheck`, `pnpm test:config-module-load` and `pnpm test:user-layout` pass
manual_steps: open a user page and a form with a media field once, to check the background and clearing an image
refs: src/app/api/auth/line/callback/route.ts, src/lib/line/README.md, scripts/db/seed/data/registry.ts, src/app/(user)/_layout/BackgroundLayer.tsx, src/components/Form/MediaHandler/ControlledMediaUploader.tsx, src/features/core/analytics/README.md
notes: Checkpoint of this bundle. No data step: stored pictureUrl rows stay, relink writes null, no reader in 9 repos by git grep. next-vnx carries the same seed lines, so its merge may touch them. Items: 1 in 20261101-161100-wallet-lock-balance | 5 mostly on main earlier, dev warning in 20261101-161400-misc-small | 6 stays in order 20261101-133024-fix-coin-issuance-double-count, comments only here | 9 in order 20261101-133024-fix-core-indexes | 8 no upstream timezone policy and no code change, formatDateJa zone followed up in order 20261101-160324-format-date-ja-timezone | failed upload dropping a stored image followed up in order 20261101-160323-media-failed-upload-drops-stored-image. Not run in a browser; LINE callback and seed not run.
