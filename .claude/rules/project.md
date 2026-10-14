# project

## scope (keep this section; it defines what this file is)
purpose: per-fork delta from upstream CLAUDE.md. loaded every session → every line costs context every time
write: (1) architecture where this fork differs from upstream conventions (2) map: domains + where key files/docs live (3) decision rules not derivable from code (feature-addition criteria, external constraints, business intent)
never: implementation details of a change, per-screen UI/style changes, verification results, incident narratives, dated status/progress, ideas under consideration
instead: change details → commit body | feature spec/lesson → README next to code | dated record (incident, verification, decision history) → docs/journal/<YYYY-MM-DD>-<slug>.md (not auto-loaded)
distill: incident → 1 rule line here only if fork-specific; the story → journal | lesson about upstream core component → /upreq, not here
budget: ~100 lines. over budget → re-ask "needed every session?" and move content out
edit: only when the user asks to add/change a rule or map entry. never append as part of finishing a task

## ROLE
type: upstream template (base for many forked projects)
direct_users: minimal — this repo itself has few end users
downstream: many derivative projects depend on this as their base

## IMPLICATIONS
- changes propagate to all downstream forks; high blast radius
- favor generality and extensibility over project-specific shortcuts
- preserve extension points; avoid hardcoding for any single use case

## TIER (multi-tier hierarchy)
this_repo: Tier1 (canonical upstream). Hierarchy: Tier1 → Tier2 → Tier3.
note: downstream forks maintain their OWN project.md and overwrite this declaration per-fork.
rule: generic/foundational capabilities live HERE (Tier1); downstream must not hardcode them locally — escalate instead.
request_protocol (shared mailbox: ~/.team/upstream-requests/ — NOT under ~/.claude/: Claude Code hard-gates Write/Edit there as "sensitive files", forcing permission prompts no allow-rule can suppress; moved 2026-07-12):
- downstream: file a generic-capability request with /upreq (writes a structured ticket to the mailbox)
- Tier1 (here): handle incoming tickets with /inbox → record a RESOLUTION, then move to done/
- downstream: track status of its own filed requests with /wen (open vs resolved)
