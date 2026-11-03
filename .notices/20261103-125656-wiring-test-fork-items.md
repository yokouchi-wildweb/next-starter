# DOWNSTREAM NOTICE id:20261103-125656-wiring-test-fork-items
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-03T12:56:56+09:00
severity: info
checkpoint: wiring-test-fork-items
resolves: 20261101-142143-wiring-test-fork-items
change: pnpm test:wiring accepts receptacle items under src/wiring/: the generated src/wiring/<name>.ts may import items inside the receptacle dirs declared in src/wiring/<name>/extensionPoints.ts (fork dot-named items included), and files of one item may import each other inside the same receptacle. The exact list of data-reaching wiring files is checked on Tier1 only; a fork checks that the upstream ones still reach the data and may add more through receptacle items (where those may be imported stays checked as before).
why: A fork item such as src/wiring/dbAgent/promptFragments/<name>.<fork>.ts made the generated dbAgent.ts trip "wiring does not import wiring" and join the data-reaching list, so test:wiring failed in every fork with a dbAgent item.
required_actions: none
verify: `pnpm test:wiring`
manual_steps: -
refs: src/wiring/wiring.test.mjs (isReceptacleImport, receptacleDirsOf)
notes: Checked on a scratch copy shaped like a fork (fork_id acme, promptFragments/rules.acme.ts importing a services/server module, generated dbAgent.ts importing it): new test 9 pass, the old test failed the direction and data-reaching tests as the order reports. Not run on a real fork. Backward compatible: nothing changes for forks without wiring receptacle items.
