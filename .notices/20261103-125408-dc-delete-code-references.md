# DOWNSTREAM NOTICE id:20261103-125408-dc-delete-code-references
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-03T12:54:08+09:00
severity: info
checkpoint: dc-delete-code-references
resolves: 20261102-184122-dc-delete-code-references
change: pnpm dc:delete now also stops (deletes nothing) when code that stays under src imports the target domain folder: @/features/<d>/…, @/features/core/<d>/…, relative paths into it, dynamic import() / require(). Its own folder, its admin route, the --extra dirs chosen and src/registry/ are not counted; extra-dir candidates not chosen are checked after --confirm. The README lists what it still cannot see (plain id columns without FK, string references via registries or /api URLs, code outside src).
why: Domains used by other domains through plain fields and imports (relations: []) passed the stop and broke tsc or db:push later.
required_actions: none
verify: `pnpm test:dc-delete-stop`
manual_steps: -
refs: scripts/domain-config/pipeline/remove/deleteStop.mjs (codeReferences, codeReferenceStopMessage), scripts/domain-config/cli/delete.mjs, scripts/domain-config/README.md「dc:delete」step 0
notes: A fork that deletes a domain still imported by its own code now gets the list of importing files instead of a later tsc failure; remove the imports first. No force flag.
