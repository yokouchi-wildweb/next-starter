# DOWNSTREAM NOTICE id:20261106-191203-switch-input-label-once
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-06T19:12:03+09:00
severity: info
checkpoint: switch-input-label-once
fixes: 20261102-222255-frame-mobile-a11y
resolves: 20261105-190039-switch-input-label-read-twice
change: SwitchInput: the track <label> is aria-hidden="true" and no longer carries an sr-only copy of `label`, so a screen reader reads the label text once (the input keeps its name from the visible text via aria-labelledby); the track stays clickable; no visual change; with no `label` the track is also out of the accessibility tree (no nameless label)
why: since 20261102-222255 every SwitchInput with `label` was read twice in a row in browse / virtual-cursor mode
required_actions: none
verify: pnpm test:form-a11y-contract passes (includes SwitchInput.a11y.test.tsx); pnpm typecheck passes
manual_steps: -
refs: src/components/Form/Input/Manual/SwitchInput.tsx | src/components/Form/Input/Manual/SwitchInput.a11y.test.tsx | order 20261105-190039-switch-input-label-read-twice
notes: not checked with a real screen reader (DOM accessibility-tree check in tests)
