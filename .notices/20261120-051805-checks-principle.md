# DOWNSTREAM NOTICE id:20261120-051805-checks-principle
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261111-153718-claude-md-context.2-content | commit:- (this commit)
date: 2026-11-20T05:18:05Z
severity: info
checkpoint: checks-principle
change: core notices.md checks_in_ship is written as a principle: a check = running the set that judges whether the code is right (tests, lint, typecheck, smoke, golden, pnpm check), only inside the shipping tools; work that reads state, gets information or makes things (read-only git, grep, reading files, pnpm ops inspect, a trial run that writes nothing, generators incl. pnpm forge's own forge:pre / forge:post guards) is not a check; allowed for now: one run of a check tool for work material (reproducing a bug, the new test you write) and, after a failed ship, rerunning only what failed while fixing it. CLAUDE.md TOOLS check says the same in short.
why: it was not written whether read-only commands, codemod trials or generators count as checks; a principle answers the next case too.
required_actions: none
verify: -
manual_steps: -
refs: .claude/rules/core/notices.md checks_in_ship, CLAUDE.md TOOLS check
notes: The segment's items (order numbers = the upstream build steps):
(1) change: core notices.md checks_in_ship rewritten as a principle (what a check is, what work is, the two allowed runs); CLAUDE.md TOOLS check follows  (order 104)
