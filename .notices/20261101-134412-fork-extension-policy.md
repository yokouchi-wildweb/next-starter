# DOWNSTREAM NOTICE id:20261101-134412-fork-extension-policy
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-01T04:44:12Z
severity: action-required
checkpoint: fork-extension-policy
hotfix: forks file orders against an old rule and defer migration in /flux; the policy must reach them before new receptacles are built (owner's decision)
change: New fork extension policy: CLAUDE.md FORK_EXTENSION (principle + 3 questions), .claude/rules/core/extensions.md (procedure), a human doc, contradicting docs fixed; /order gets tried:, /inbox (Tier1) returns existing means, /flux limits what a segment may leave open and lists copied-from origins.
why: Copying is now judged by what the copy holds, and a copy holding unchanged behavior or a guard is not allowed. Forks must follow it for new copies and orders. Docs and skills only; no code, DB or env change.
required_actions:
1. 88-base, TriQ, next-vnx only: take the hotfix cae0cc7c first (history order) so /flux reads the newest procedure.
2. If the pick conflicts in CLAUDE.md or another upstream doc: stop and let the human supervise the resolution. Keep the fork's lines and add upstream's new lines; where the old line is absent (an old CLAUDE.md), skip that edit: .claude/rules/core/extensions.md wins over older text.
3. Run `pnpm ownership:check` after committing the pick. For each file of this commit it reports as a violation (conflicted or not), add its draft line to .fork-ownership/<fork name>.permits.txt with upreq:20261101-133210-extension-policy-hotfix and the reason "hotfix pick"; if the file already has a permit line, re-take that line and keep its existing upreq alongside. Hand-resolved files are violations even on the newest check; an old check also rejects cleanly picked files. Do not edit the check. Commit, then re-run until those lines read permitted.
4. Until a later in-order merge brings this commit, a segment that touches a permitted file makes its line expired-base: take the draft line again, commit, re-check, then push. On a merge conflict in these files with no fork edit of your own, take upstream's side.
5. When a later in-order merge brings this commit, delete the lines added here (the check reports them as leftovers). Keep lines for the fork's own edits.
6. From now on: new copies follow extensions.md and carry line 1 `// copied-from: <upstream path>`. Do not backfill existing copies.
verify: `pnpm test:core-rules` passes once CLAUDE.md holds the pointer to extensions.md (the new files alone fail it); `pnpm ownership:check` exits 0.
manual_steps: -
refs: .claude/rules/core/extensions.md | docs/!must-read/フォークでの拡張の方針_コピーと受け口の使い分け.md | council 20261020-195854 D35-D41
notes: The old core_domain_ui_boundary rule ("core is data layer only") is gone; do not repeat it in orders. Pick results in isolated copies of this content: oripa-do 5 conflicting files and 10 violating files (permits made the 5 tried pass; the other 5 were not re-run); 88-base, TriQ, next-vnx 7 conflicting files after cae0cc7c. New files do not conflict. 88-base, TriQ, next-vnx have no fork_id yet, so the newest check reports unverified (exit 2) until it is declared. A multi-tier fork takes this from its direct parent after the parent's pick and relay, and its permit upreq names an order in its direct parent's inbox.
