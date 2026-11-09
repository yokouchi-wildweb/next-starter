# DOWNSTREAM NOTICE id:20261109-141306-config-district-maintenance
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-09T05:13:06Z
severity: action-required
checkpoint: config-district-maintenance
moved: src/config/app/maintenance.config.ts -> src/config/features/setting.config.ts
change: the maintenance settings moved from src/config/app/maintenance.config.ts (deleted) to their owner src/features/core/setting/config.ts (defaults, types SettingConfig / SettingMaintenanceConfig / SettingOverride, composed settingConfig) with the empty override src/config/features/setting.config.ts. Old name -> new key: maintenanceConfig -> settingConfig.maintenance (same inner keys allowedPaths, allowedPrefixes, bypassRoles, redirectTo, redirectAfterEnd). Values unchanged. bypassRoles is now typed readonly string[] (was `as const`); canBypassMaintenance gives the same result.
why: a fork that changed a value in the old file loses it (the file is gone), and a fork file importing @/config/app/maintenance.config fails typecheck
required_actions:
1. Merge upstream up to this checkpoint. If the merge keeps a fork version of src/config/app/maintenance.config.ts (modify/delete conflict), copy its values first (`git show HEAD:src/config/app/maintenance.config.ts`), then delete the file.
2. Write changed values into src/config/features/setting.config.ts as literals under `maintenance` (only the keys the fork changed; each array replaces the default as a whole, so write the full list): `export default { maintenance: { allowedPaths: ["/maintenance", "/login", …] } } satisfies SettingOverride;`. [判断] boardgame-site removed "/signup/oauth" from allowedPaths → write its full allowedPaths list (upstream's 14 paths minus "/signup/oauth") into the override. oripa-do: no change in the old file; its own setting receptacle items (fields/autoSafetyGuardThreshold.ts, sections/gacha.ts read its gacha.config) are unrelated and it has no src/features/core/setting/config.ts, so nothing to write. 88-base, TriQ, next-vnx, pandora: upstream's values → nothing to write. voranowa: no such file.
3. Rewrite fork imports: `git grep -nE "config/app/maintenance\.config|maintenanceConfig" -- src scripts` → read `settingConfig` from `@/features/setting/config` and use `.maintenance.<key>` (no re-export of the old name).
verify: the git grep in step 3 finds nothing | pnpm check config-overrides passes | pnpm typecheck | pnpm lint | FEATURE_GATE_CHECK=all pnpm test src/featureGate scripts/structure/proxies src/proxies | in development, turn maintenance on in /admin/settings/maintenance and open an allowed path and a blocked path while logged out (allowed = page, blocked = redirect to /maintenance)
manual_steps: -
refs: src/features/core/setting/config.ts, src/config/features/setting.config.ts, src/proxies/maintenance.ts, src/features/core/setting/utils/maintenanceBypass.ts, src/config/README.md, order 20261109-131135-config-district-maintenance (council 20261101-233830 D39, D95)
notes: the maintenance on/off and times stay in the DB setting (admin screen), not in config.
