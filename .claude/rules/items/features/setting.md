---
paths:
  - "src/domains/core/setting/**"
---
# domains/setting
what: values an admin changes in the running app: one row `global` + one jsonb holding saved keys only | key = fields/<key>.ts, section = sections/<name>.ts → generated lists | server settingService, hooks in hooks/
use: always
change: add = fields/<key>.ts, sections/<name>.ts (receptacles in extensionPoints.ts, then pnpm generate extensions) | overlay = <name>.override.ts beside a parent tier's key or section
rules:
using:
- config_direction: a setting default may read config, never the reverse
- field_imports: a key file value-imports only zod, @/config, pure functions and types (proxy and client read it)
- input_body_place: a custom input's body goes to src/domains/<domain>/components/, never core | helperText is drawn by the frame, never inside the part
- section_feature_literal: a section's `feature` = FeatureName literal(s), never changed by an override
- override_narrows: an override only narrows the effective roles | allowRoles and ui.section are string literals (pnpm check extensions)
- read_few_keys: proxy, health and loaders read readSettingKeys, not getGlobalSetting
- setting_or_config: admin changes it while running = setting, fixed at deploy or structural = config
- code_values: each key has one home per repo: the admin + DB by default, or code when listed in the setting config's codeValues | no other switch (no per-key or per-section source flags) | fork-added keys use the same table
  - a listed key is read as its code value everywhere (never from the DB; public reads give saved or code values) | read-only in the admin (only that key's fields; the rest of the section still saves) | a save is refused (save.ts → 409)
- one_key_groups: values that mean nothing apart (changing one alone breaks the meaning, e.g. a switch and its window) are one key with parts (schema z.object + ui.parts), never separate keys or a group mark | the admin lays the parts out as fields | merging saved keys ships a migration task and a notice step
- read_memo: the settings DB read is memoized per instance for config readMemoMs (0 = off), cleared by a save in that instance; other instances see old values up to that long | never the cacheComponents APIs (use cache, cacheTag) | to keep the DB idle, list the key in codeValues
- maintenance_window: the maintenance key's window is judged only by utils/maintenanceWindow.ts isMaintenanceWindowActive
- public_saved_only: public reads give saved values only | computed values → the owner domain's route and hook
editing:
- single_writer: save.ts is the only writer | defaults are never stored
- generic_api_closed: generic /api/setting stays INTERNAL_ONLY
- setup_one_shot: setup refuses once any admin exists (409) and fixes role admin
- hooks_rethrow: form hooks rethrow after the error toast (AppForm restores the unsaved guard only on a throw)
- list_per_page_order: the admin_list_per_page move keeps its order: stop old writes → task → db:push → db:push:check
read: keys, sections, overrides, code values, keys with parts → Extension | read, save, form hooks → Usage | access, routes, setup → API | storage, read memo, migration → Internals | tests → Verification
