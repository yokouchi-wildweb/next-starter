---
paths:
  - "src/features/core/setting/**"
---
# features/setting
what: values an admin changes in the running app: one row `global` + one jsonb holding saved keys only | key = fields/<key>.ts, section = sections/<name>.ts → generated lists | server settingService, hooks in hooks/
use: always
change: add = fields/<key>.ts, sections/<name>.ts (receptacles in extensionPoints.ts, then pnpm generate extensions) | overlay = <name>.override.ts beside a parent tier's key or section
rules:
using:
- config_direction: a setting default may read config, never the reverse
- field_imports: a key file value-imports only zod, @/config, pure functions and types (proxy and client read it)
- input_body_place: a custom input's body goes to src/features/<domain>/components/, never core | helperText is drawn by the frame, never inside the part
- section_feature_literal: a section's `feature` = FeatureName literal(s), never changed by an override
- override_narrows: an override only narrows the effective roles | allowRoles and ui.section are string literals (pnpm check extensions)
- read_few_keys: proxy, health and loaders read readSettingKeys, not getGlobalSetting
- public_saved_only: public reads give saved values only | computed values → the owner domain's route and hook
editing:
- single_writer: save.ts is the only writer | defaults are never stored
- generic_api_closed: generic /api/setting stays INTERNAL_ONLY
- setup_one_shot: setup refuses once any admin exists (409) and fixes role admin
- hooks_rethrow: form hooks rethrow after the error toast (AppForm restores the unsaved guard only on a throw)
- list_per_page_order: the admin_list_per_page move keeps its order: stop old writes → task → db:push → db:push:check
read: keys, sections, overrides → Extension | read, save, form hooks → Usage | access, routes, setup → API | storage, migration → Internals | tests → Verification
