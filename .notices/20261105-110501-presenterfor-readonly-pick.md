# DOWNSTREAM NOTICE id:20261105-110501-presenterfor-readonly-pick
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:fix/bundle5 | commit:- (this commit)
date: 2026-11-05T11:05:00+09:00
severity: info
checkpoint: presenterfor-readonly-pick
fixes: 20261029-185421-fieldtype-list-presenter-for
resolves: 20261103-105120-presenterfor-readonly-fix-notice, 20261104-143340-presenterfor-fix-pickable-notice
change: the presenterFor.mjs part of c0b0cd2b as its own commit, based on the fieldtype-list-presenter-for checkpoint (510a8e313) so /flux can pick it right after that segment. Two JSDoc lines in src/lib/domain/fields/presenterFor.mjs: PresenterSpec.options and the field param's options become ReadonlyArray<{ value: unknown, label?: string }> (were Array<{ value: string | number | boolean, label?: string }>). No behavior change (values are compared with String(value))
why: a fork that applied domain-display-client (284ec4315) before fieldtype-list-presenter-for (parallel branches) failed pnpm typecheck at that checkpoint: src/lib/crud/presenters/domainColumns.ts(97,29) TS2345, readonly FieldOption[] not assignable to the mutable array. The fix c0b0cd2b reached forks ~20 segments later and could not be picked whole (it also touches a later notice body)
required_actions: none
verify: pnpm typecheck exit 0 at the fieldtype-list-presenter-for segment after the pick
manual_steps: -
refs: src/lib/domain/fields/presenterFor.mjs | commit c0b0cd2b | orders 20261103-105120-presenterfor-readonly-fix-notice, 20261104-143340-presenterfor-fix-pickable-notice
notes: the commit is a side commit on 510a8e313 merged --no-ff into main; its content is already on main (the merge adds only this notice). A fork already past c0b0cd2b has nothing to apply
