# DOWNSTREAM NOTICE id:20261123-111856-acquisition-reverse-case
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-23T11:18:56+09:00
severity: action-required
checkpoint: acquisition-reverse-case
fixes: 20261111-141433-acquisition-config-home
pick: -
resolves: 20261119-112400-acquisition-notice-reverse-case
change: notice 20261111-141433-acquisition-config-home now names the reverse case (body corrected): a fork with the rule userAcquisition open and the old ACQUISITION_CONFIG.enabled false starts recording by that merge alone; no code change
why: since that notice, recording (touch cookie in the proxy, signup attribution, GA4 channel table) follows the gate rule userAcquisition only; its step 2 said "enabled: false → nothing to do", true only while the rule is closed, so a fork that kept the rule open (switches userAcquisition: true) with enabled: false began recording signup attribution without deciding to
required_actions:
1. Is the rule open in this fork? `git grep -n "userAcquisition" -- src/config/featureGate/switches.config.ts` | no `userAcquisition: true` line → nothing to do, stop here.
2. Did the fork have recording off before? `sha=$(git log --diff-filter=D --format=%H -1 -- src/config/app/acquisition.config.ts)` then `git show "$sha^:src/config/app/acquisition.config.ts" | grep -n "enabled"` | `enabled: true` (or the file never existed in the fork's history with a differing value) → nothing to do, stop here.
3. Rule open + old `enabled: false`: recording has been on since the fork took 20261111-141433-acquisition-config-home. Ask the human (once) whether signup attribution recording should stay on. Keep → nothing to change (write the decision in the ledger line's notes:). Stop → `pnpm ops features set userAcquisition off` (writes src/config/featureGate/switches.config.ts); rows already recorded stay (user_acquisitions etc.; delete them only on the human's word).
verify: `pnpm ops features list` shows userAcquisition as the human decided | pnpm typecheck
manual_steps: -
refs: .notices/20261111-141433-acquisition-config-home.md (step 2, why), src/featureGate/rules/userAcquisition.ts, src/proxies/extensions/proxyDecorators.ts | order 20261123-111523-acquisition-notice-reverse-case
notes: a fork that has not taken 20261111-141433-acquisition-config-home yet reads the corrected step 2 there and decides at that merge; this notice is for forks that already took it | the rule's upstream default stays closed
