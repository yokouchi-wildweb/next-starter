# DOWNSTREAM NOTICE id:20261020-042918-ebb-memory-tidy-skill
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:(change ships in the commit that contains this notice)
date: 2026-10-20T04:29:18Z
severity: action-required
checkpoint: ebb-memory-tidy-skill
change: New user-invoked skill /ebb (.claude/skills/ebb/SKILL.md) tidies the working directory's auto-memory to match CLAUDE.md DOCS `memory` (auto-memory = in-progress handoff only). It collects facts per memory (type / duplicate in repo / referenced paths exist / end condition met / date), applies a fixed decision table (stale → delete, duplicate → delete, finished project → delete, project without end condition → user decides, unfinished project → keep, feedback / user / reference → user decides move or delete), asks approval per verdict, moves deleted memories to `memory-archive/<YYYY-MM-DD>/` next to `memory/` (no rm), and fixes links and the index. CLAUDE.md DOCS `memory` line now also requires the end condition to be checkable by a file, commit or user decision.
why: Fork memories have accumulated durable rules, knowledge and finished progress that per CLAUDE.md belong in the repo (behavior.md / project.md / README / docs/journal) or nowhere. Many fork memories now duplicate rules that arrived upstream in behavior.md and CLAUDE.md, so a first pass mostly deletes duplicates.
required_actions:
1. Merge upstream. No code or file changes are required in the fork.
verify: `ls .claude/skills/ebb/SKILL.md` exists; `grep -n "end condition checkable" CLAUDE.md` matches.
manual_steps: When convenient, run `/ebb` once in this fork's working directory (it needs the user's approvals per verdict, so /flux does not run it). Large memories (30+ files) are split by the skill; pass a batch size as the argument if needed.
refs: .claude/skills/ebb/SKILL.md, CLAUDE.md (ROLE, PER_PROJECT, DOCS memory / durable_info), .notices/20261020-040849-per-project-rules-ownership.md
notes: Apply 20261020-040849-per-project-rules-ownership first (it ships the rules /ebb compares against). /ebb only touches the auto-memory of the current working directory and never edits upstream-owned files in a fork; destinations owned by upstream are reported as /upreq candidates.
