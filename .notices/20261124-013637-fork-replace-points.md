# DOWNSTREAM NOTICE id:20261124-013637-fork-replace-points
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261026-152333-shared-shelf.4r | commit:- (this commit)
date: 2026-11-24T01:36:37Z
severity: action-required
checkpoint: fork-replace-points
fixes: 20261122-213044-district-stage2
pick: clean
resolves: 20261124-103154-fork-declared-replace-points
change: the district-stage2 tool .notices/20261122-213044-district-stage2.declarations.mjs declares a replace point whose default sits under an upstream route's `_components/` (a tier's own frame part, no district owner) in that tier's own `src/app/<route>/_components/extensionPoints.ts` (owner = that folder) instead of stopping with only upstream `_layout/extensionPoints.ts` candidates | docs: scripts/structure/extensions/README.md (差替点) and .claude/rules/core/receptacles.md extension_points (a key line added, none renamed or removed) name that place
why: a fork that split its own frame parts into .default + 1-line switches for its downstream (oripa-do: the user header's 5 looks for pandora) had no fork-owned place offered: declaring in upstream src/app/(user)/_layout/extensionPoints.ts is an ownership violation, and without a declaration pnpm generate extensions fails. The reader already takes any src/**/extensionPoints.ts with owner = its folder, so only the tool and the docs pointed the wrong way
required_actions:
1. Forks with their own `<名前>.default.tsx` + switch under an upstream route's `_components/` (find: `git ls-files 'src/app/**/_components/**/*.default.ts' 'src/app/**/_components/**/*.default.tsx'`; none → nothing to do): node .notices/20261122-213044-district-stage2.declarations.mjs (dry-run; the plan lists the points into `src/app/<route>/_components/extensionPoints.ts`) → node .notices/20261122-213044-district-stage2.declarations.mjs --apply
2. pnpm generate extensions (intake.txt gains the switch / .replace rows of those points) and commit the new extensionPoints.ts with it
3. A fork that declared them in an upstream `_layout/extensionPoints.ts` under a temporary permit (oripa-do: upreq 20261124-103154-fork-declared-replace-points): remove those lines from the upstream file (back to the upstream version) and drop the permit line from .fork-ownership/<repo_id>.permits.txt
verify: pnpm check extensions passes | pnpm workflow ownership check reports no violation and no permit for the upstream `_layout/extensionPoints.ts`
manual_steps: -
refs: .notices/20261122-213044-district-stage2.declarations.mjs (ownComponentsOwnerOf, replacePlanOf) | scripts/structure/extensions/README.md (差替点) | .claude/rules/core/receptacles.md extension_points | order 20261124-103154-fork-declared-replace-points
notes: no reader / generator change (src/lib/districtMap/declarations.mjs already reads any src/**/extensionPoints.ts with owner = its folder; a test now locks it) | at district-stage3 the declaration's type.from moves to the type-only entry `src/app/<route>/_components/points.ts` (export type { <名前>Props } from the defaults), the same D33 rule as every owner | a downstream of the middle tier (pandora) replaces these points with `<名前>.replace` beside the default and never edits the middle tier's declaration | oripa-do's points: Brand, HeaderShell, NotificationBell, Sp/SpNavSwitch, HeaderCurrencyView (src/app/(user)/_components/Header/)
