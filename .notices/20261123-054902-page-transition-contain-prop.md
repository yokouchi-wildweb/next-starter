# DOWNSTREAM NOTICE id:20261123-054902-page-transition-contain-prop
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-23T05:49:02+09:00
severity: info
checkpoint: page-transition-contain-prop
resolves: 20261123-054646-page-transition-contain-prop
change: PageTransition (@/components/Animation/PageTransition) takes contain?: boolean (default true = the containment of today, contain: layout paint on the wrapper). contain={false} drops it, so position: fixed overlays inside a transitioned page attach to the viewport again (the containment made the wrapper their containing block); the slide flicker guard of the containment goes with it. FrozenRouter stays inside the part. New README src/components/Animation/PageTransition/README.md and card .claude/rules/items/components/Animation.md (keys fixed_inside, entry_only).
why: A fork with fixed overlays under PageTransition had to keep a copy of the part that reads the inner FrozenRouter (an inner-file import with an eslint-disable). The default does not change, so nothing breaks on merge.
required_actions: none
verify: a page under <PageTransition contain={false}> shows its position: fixed overlay against the viewport; git grep -n "PageTransition/FrozenRouter" -- src prints no fork file once a fork drops its copy
manual_steps: -
refs: src/components/Animation/PageTransition/index.tsx, src/components/Animation/PageTransition/README.md (Usage: when to turn contain off), .claude/rules/items/components/Animation.md, ade18f157 (why the containment exists: the popLayout reflow flicker), order 20261123-054646-page-transition-contain-prop (oripa-do, relayed as quest 20261123-054729-page-transition-contain-prop)
notes: A fork that keeps a copy of PageTransition only to drop the containment (e.g. oripa-do's MyPageTransition with an eslint-disable on the FrozenRouter import) can replace it with <PageTransition contain={false}> and delete the copy (core/extensions.md: a public means first); its temporary permit for that import, if any, ends with this notice's resolves. During the slide itself the motion layer's transform is still the containing block of fixed descendants (README Internals).
