# DOWNSTREAM NOTICE id:20261108-171427-skill-format-flux
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:legate/20261106-194813-tooling-ownership-and-growth.1 | commit:- (this commit)
date: 2026-11-08T08:14:27Z
severity: info
checkpoint: skill-format-flux
change: flux (SKILL.md, relay.md, moved.md) rewritten in the .claude/rules/core/skills.md form with English headings; references by the old Japanese section names updated; scripts/workflow/skills/pending.txt is empty, so pnpm check skills now checks every upstream skill
why: forks read upstream's tip flux right after fetch, so their next /flux runs the new text; no behavior changed
required_actions: none
verify: pnpm check skills passes with 0 pending ; pnpm test .claude/skills/flux/ passes
manual_steps: -
refs: .claude/skills/flux/SKILL.md, .claude/skills/flux/relay.md, .claude/skills/flux/moved.md, .claude/rules/core/skills.md, .notices/20261108-164255-skill-format-rule.md
notes: steps, stop conditions, waits, reply vocabulary (go / go last / いいえ / 再計画 / ここで終える / 再計画 移行は別の依頼) and the flux-stop contract are unchanged; checked by a 1:1 line map, 3 reviews and two independent behavior inventories (old vs new). New section names cited elsewhere: WORK MEMO (.gitignore), FINDING THE UPSTREAM (src/lib/forkOwnership), RELAY NOTICE COMPOSITION / RELAY JUDGMENT (.notices/README.md, relay-check.mjs), STOP CONDITIONS (lineage-touch.mjs), UNAPPLIED JUDGMENT / BUILDING SEGMENTS (incoming.mjs), SPLIT A MIGRATION INTO ANOTHER ORDER (fmt/flux-stop.md), FIXES (scripts/workflow/notices/lib.pickDroppingIndex.mjs). A fork that cites the old Japanese flux section names in its own files may update them. Script output text is unchanged.
