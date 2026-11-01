# DOWNSTREAM NOTICE id:20261101-164228-dc-delete-stop-any-reference
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:feature/bundle2-crud-db | commit:- (this commit)
date: 2026-11-01T16:42:28+09:00
severity: action-required
checkpoint: dc-delete-stop-any-reference
moved: scripts/domain-config/pipeline/remove/pairStop.mjs -> scripts/domain-config/pipeline/remove/deleteStop.mjs
resolves: 20261028-141419-delete-stop-any-belongsto
change: pnpm dc:delete now stops, deleting nothing and with no force option, when another domain's domain.json points at the target by belongsTo, belongsToMany (includeRelationTable:false too), hasMany or hasOne; it lists each referrer as domain + fieldName. New pure export inboundReferences beside deleteStopMessage
why: deleting a referenced domain left the referrer's generated code importing it, so tsc / db:push failed later, far from the cause. A fork's everyday dc:delete that passed before can now stop
required_actions:
1. a fork script or doc that runs dc:delete in a fixed order: find it with `git grep -n "dc:delete"`; delete referrers first with --remove-config, or remove the relation from the referrer's domain.json first. A kept domain.json (the default) still declares the relation and keeps stopping the target
2. mutually related domains (e.g. a belongsToMany and its inverse): remove the relation from one side's domain.json by hand, run `pnpm dc:generate <that domain>`, then delete the other. dc:delete never edits another domain's domain.json
3. a fork importing pipeline/remove/pairStop.mjs directly: find it with `git grep -n "pairStop"`; import from scripts/domain-config/pipeline/remove/index.mjs instead
verify: `pnpm test:dc-delete-stop` passes
manual_steps: -
refs: scripts/domain-config/pipeline/remove/deleteStop.mjs, scripts/domain-config/README.md (dc:delete section 0)
notes: the collection order is now remove the owner's field -> dc:delete child --remove-config -> dc:delete owner. The scan reads domain.json only: domains without one and unreadable files are not seen. Domains with no inbound reference delete as before. Other forks not checked.
