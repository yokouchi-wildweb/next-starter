# DOWNSTREAM NOTICE id:20261105-110502-feature-map-intake-pick
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:fix/bundle5 | commit:- (this commit)
date: 2026-11-05T11:05:00+09:00
severity: info
checkpoint: feature-map-intake-pick
fixes: 20261029-223045-feature-map
resolves: 20261103-171644-feature-map-intake-fix-notice
change: the intake.txt line of 274f55f8 as its own commit, based on the feature-map checkpoint (6f1fda76d) so /flux can pick it right after that segment: src/lib/forkOwnership/intake.txt gains `generated src/features/feature-map.txt  # pnpm dc:feature-map(forge・dc:generate が書き直す)`. It also carries the 2 JSDoc lines of src/lib/domain/fields/presenterFor.mjs (same as notice 20261105-110501-presenterfor-readonly-pick): the feature-map checkpoint tree still has that TS2345 and pick-check typechecks it without other notices' picks; a fork that already picked 20261105-110501 gets an identical change (no conflict)
why: the feature-map notice tells forks to run pnpm dc:feature-map and commit the result, but at that checkpoint intake.txt did not list src/features/feature-map.txt, so the regenerated file was [outside-intake] and ownership:check exited 1 (push blocked) until the line arrived ~14 checkpoints later
required_actions: none
verify: at the feature-map segment, after pnpm dc:feature-map and the pick, pnpm ownership:check passes
manual_steps: -
refs: src/lib/forkOwnership/intake.txt | commit 274f55f8 | order 20261103-171644-feature-map-intake-fix-notice
notes: side commit on 6f1fda76d merged --no-ff into main; the line is already on main (hand-written row, outside the generated block). A fork already past 274f55f8 has nothing to apply
