# DOWNSTREAM NOTICE id:20261111-141433-acquisition-config-home
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:legate/20261023-175358-config-redesign.1 | commit:- (this commit)
date: 2026-11-11T14:14:33+09:00
severity: breaking
checkpoint: config-acquisition-home
moved: src/config/app/acquisition.config.ts -> src/features/core/userAcquisition/config.ts
change: the acquisition values live in their owner (decision D67, sheet 04): src/features/core/userAcquisition/config.ts exports userAcquisitionConfig (type UserAcquisitionConfig, override type UserAcquisitionOverride) with the fork override src/config/features/userAcquisition.config.ts (shipped empty) | old -> new: ACQUISITION_CONFIG.cookieMaxAgeDays / maxTouches / referralParam / clickIdParams -> userAcquisitionConfig.<same key> (same values) | ACQUISITION_CONFIG.enabled is gone: recording (proxy cookie, register, signup save, GA4 channel table) follows the gate rule userAcquisition only (L1.56, like fingerprint D120); isAcquisitionRecordingEnabled() is removed — callers check gate.enabled("userAcquisition") | the rule's upstream default stays closed (notice 20261110-173039-tier1-close-addons)
why: a fork's src/config/app/acquisition.config.ts (an old upstream file) is deleted by the merge; fork code importing ACQUISITION_CONFIG or isAcquisitionRecordingEnabled fails pnpm typecheck; a fork that set enabled: true without opening the rule would stop recording
required_actions:
1. Merge upstream up to this checkpoint. If src/config/app/acquisition.config.ts held values that differ from the upstream defaults (cookieMaxAgeDays 30, maxTouches 15, referralParam invite/invite, the 9 clickIdParams), write only those into src/config/features/userAcquisition.config.ts (`export default { cookieMaxAgeDays: 60 } satisfies UserAcquisitionOverride;`, import type from "@/features/userAcquisition/config"). A leftover `referralParam.param` key is not needed (the parameter name belongs to referral since notice of 5c5aa0ab).
2. If the fork had enabled: true (recording on): `pnpm ops features set userAcquisition on` (writes src/config/featureGate/switches.config.ts). With enabled: false nothing to do (the rule is closed by default).
3. Fork code: `git grep -n "ACQUISITION_CONFIG\|config/app/acquisition\|isAcquisitionRecordingEnabled" -- src scripts` → read userAcquisitionConfig from "@/features/userAcquisition/config" inside the domain only, replace isAcquisitionRecordingEnabled() with gate.enabled("userAcquisition").
4. [判断] none of the five forks changed these values or set enabled: true (boardgame-site, oripa-do equal upstream; 88-base, TriQ, next-vnx differ only by the old referralParam.param line) → step 1 and 2 write nothing.
5. `pnpm check config-overrides`, `pnpm generate district-map`, `pnpm typecheck`.
verify: git grep -n "ACQUISITION_CONFIG\|isAcquisitionRecordingEnabled" -- src prints nothing | pnpm check config-overrides passes (features/userAcquisition paired)
manual_steps: -
refs: src/features/core/userAcquisition/README.md, src/config/README.md, council 20261023-175358-config-redesign decisions D67 D92 D101 D120 L1.56, legate:l1 order 57
notes: the last district value move of the config redesign; the old-place shells (src/config/app, ui, business.config.ts) go in closing step 2.
