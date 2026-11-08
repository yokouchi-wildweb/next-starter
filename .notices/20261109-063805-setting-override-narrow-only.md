# DOWNSTREAM NOTICE id:20261109-063805-setting-override-narrow-only
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-09T06:38:05+09:00
severity: info
checkpoint: setting-override-narrow-only
change: pnpm check extensions now stops a setting override that widens who may read / edit a key: the key's effective roles after the override (key allowRoles → its section's allowRoles via ui.section → the whole admin category) must stay inside the effective roles before it. Stopped: a role outside upstream's, an empty list, allowRoles: undefined, moving a key by ui into a section without that limit, and a section override's allowRoles widening the section's. Narrowing (a subset) and overrides that do not touch roles pass. Same rule as the admin menu overrides.
why: setting fields / sections accept allowRoles in their overrides (src/features/core/setting/extensionPoints.ts), but nothing kept a fork from widening a permission upstream narrowed; the rule is "overrides only narrow"
required_actions: none
verify: pnpm check extensions passes (a failure names the override file: "キーの権限を広げている" / "セクション … の allowRoles を広げている" / "確かめられない")
manual_steps: -
refs: scripts/structure/extensions/derive/settingRoles.mjs, src/features/core/setting/README.md (親の Tier のキー・セクションを変える), scripts/structure/admin-menu/inspect.ts (the same rule for the admin menu), order 20261109-063049-setting-override-narrow-only
notes: The check reads allowRoles and ui.section as written (string literals or arrays of them); where upstream has a limit, an override that sets them some other way (a variable, a spread) cannot be verified and is stopped. groups only order fields on the screen and are not part of the permission. Runtime resolution (access.ts) is unchanged. The 5 forks of fleet.conf were checked read-only: only oripa-do has a setting override (sections/maintenance.override.ts, order only) and it passes.
