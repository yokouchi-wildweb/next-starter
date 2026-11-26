# DOWNSTREAM NOTICE id:20261126-215459-httperror-bundle-word
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:qc/kagerou/o/20261126-215311-httperror-apiaccess-bundle | commit:- (this commit)
date: 2026-11-26T21:54:59+09:00
severity: info
checkpoint: httperror-bundle-word
fixes: 20261126-014453-domain-decl
pick: clean
resolves: 20261126-202900-httperror-apiaccess-bundle
change: the dev-only authz warning of src/lib/errors/httpError.ts (warnAuthDenialInDev) no longer names the bundle's forbidden word apiAccess: it says "ドメインの entity.json の API の権限の欄"; the warning's meaning and when it shows are unchanged
why: the string reached the client chunk of every public page, so pnpm check --phase=build:post (structure/bundle, FORBIDDEN_WORDS) failed after next build and /sluice --safe could not pass (boardgame-site, 89 pages)
required_actions: none
verify: after next build, pnpm check --phase=build:post passes structure/bundle | git grep -n 'apiAccess' -- src/lib/errors prints nothing
manual_steps: -
refs: src/lib/errors/httpError.ts | scripts/structure/bundle/clientChunks.mjs (FORBIDDEN_WORDS) | upstream d2bed2ed8 | order 20261126-202900-httperror-apiaccess-bundle
notes: a fork that reworded or skipped the line locally to pass its safe point may return to upstream's text
