# DOWNSTREAM NOTICE id:20261022-160000-rules-marker-files
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-10-22T16:00:00+09:00
severity: action-required
checkpoint: rules-marker-files
change: New always-loaded .claude/rules/shortcuts.md (one-line keyword shortcuts; a message that is only the keyword runs it, e.g. `short`). shortcuts.md and term-aliases.md now end with the marker `<!-- fork entries below (upstream never edits below this line) -->`: upstream owns the lines above it, the fork owns the lines below it. Stated in CLAUDE.md PER_PROJECT, .claude/README.md and /flux merge rules (conflict → above = upstream side, below = fork side).
why: term-aliases.md had no owner rule, so a fork that added aliases conflicted with every upstream edit and had no fixed way to resolve it.
required_actions:
1. Merge upstream. On a conflict in .claude/rules/term-aliases.md or shortcuts.md: take upstream's lines above the marker, put every fork-added line below the marker.
2. If the fork had added lines to term-aliases.md that merged cleanly above the marker, move them below the marker (`git diff <merge-base> HEAD -- .claude/rules/term-aliases.md` shows them). Do not change upstream's lines.
verify: both files contain the marker exactly once (`grep -c "fork entries below" .claude/rules/term-aliases.md .claude/rules/shortcuts.md` = 1 each) | lines above the marker equal upstream's (`git diff <upstream>/main -- .claude/rules/term-aliases.md .claude/rules/shortcuts.md` shows changes only below the marker)
manual_steps: -
refs: .claude/rules/shortcuts.md, .claude/rules/term-aliases.md, CLAUDE.md (PER_PROJECT), .claude/README.md, .claude/skills/flux/SKILL.md (step 5)
notes: docs only. Rules files load at session start, so shortcuts work from the next session.
