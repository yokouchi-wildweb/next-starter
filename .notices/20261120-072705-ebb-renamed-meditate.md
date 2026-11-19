# DOWNSTREAM NOTICE id:20261120-072705-ebb-renamed-meditate
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:(this commit)
date: 2026-11-20T07:27:05+09:00
severity: info
checkpoint: ebb-renamed-meditate
moved: .claude/skills/ebb -> .claude/skills/meditate
change: The memory-tidy skill /ebb is renamed /meditate (no alias kept) and is now model-invocable (disable-model-invocation removed), so a plain request to meditate or tidy memory starts it; every delete / move / keep still waits for the user's approval.
why: The old name did not say what the skill does; the skill moved, so forks with their own references to /ebb must follow.
required_actions:
1. Find the fork's own references to the old name: `git grep -n -E '/ebb\b|skills/ebb|\bebb\b' -- ':!.notices' ':!docs/journal'` → rewrite each to /meditate (.claude/skills/meditate). None → nothing to do.
verify: `ls .claude/skills/meditate/SKILL.md` exists, `ls .claude/skills/ebb` fails, and the grep above prints nothing.
manual_steps: -
refs: .claude/skills/meditate/SKILL.md, .codex/README.md (Extension), .notices/20261020-042918-ebb-memory-tidy-skill.md
notes: Codex still never auto-selects it (agents/openai.yaml allow_implicit_invocation: false unchanged) and still does not run it.
