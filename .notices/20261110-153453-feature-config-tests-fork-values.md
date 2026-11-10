# DOWNSTREAM NOTICE id:20261110-153453-feature-config-tests-fork-values
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:quest/wayfarer | commit:- (this commit)
date: 2026-11-10T15:34:53+09:00
severity: info
checkpoint: feature-config-tests-fork-values
fixes: 20261109-142403-config-district-wallet-b, 20261109-143705-config-district-user, 20261109-223134-account-editable-items, 20261109-135223-config-district-wallet-a
resolves: 20261110-121329-feature-config-tests-fork-override-independent
change: feature config tests (purchaseRequest paymentMethods, user accountItems / bulkUpdateFields / nameAvailability, wallet reasonKey) check upstream defaults via <name>ConfigDef.compose({}) and check behavior against the loaded config (upstream + your override)
why: a fork that wrote its own values into src/config/features/<name>.config.ts (as those notices tell it to) failed pnpm test on these files, the verify step of those notices
required_actions: none
verify: pnpm test src/features/core/purchaseRequest src/features/core/user src/features/core/wallet passes with your own values in src/config/features/
manual_steps: -
refs: src/features/core/purchaseRequest/utils/paymentMethods.test.ts, src/features/core/user/utils/accountItems.test.ts, src/features/core/user/services/server/helpers/bulkUpdateFields.test.ts, src/features/core/user/services/server/helpers/nameAvailability.test.ts, src/features/core/wallet/services/server/wrappers/reasonKey.test.ts, notice 20261110-100118-lib-config-tests-fork-values (same fix for src/lib)
notes: tests only; no config shape or function change. A fork that kept these test failures as known can drop them. Sweep: every feature / district override (src/config/features, layout, proxies) filled with changed numbers, flipped booleans, changed free text and reversed arrays; enum strings and removed list items were not tried.
