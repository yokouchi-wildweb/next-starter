# DOWNSTREAM NOTICE id:20261108-164255-skill-format-rule
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:legate/20261106-194813-tooling-ownership-and-growth.1 | commit:- (this commit)
date: 2026-11-08T07:42:55Z
severity: info
checkpoint: skill-format-rule
change: skills follow a new core rule .claude/rules/core/skills.md (English agent form, description "what | when [| requires: KEY=value]"), checked by the new ship gate target pnpm check skills; 11 upstream skills rewritten in that form (flux follows in a later segment)
why: forks receive the rule, the check and the rewritten upstream skill text; no behavior of any skill changed
required_actions: none
verify: pnpm check skills passes (upstream skills: errors; fork-added skills: warnings only, exit 0; exit 2 when the fork base in .notices/applied/<fork_id>.md cannot be read) ; pnpm check rules passes
manual_steps: -
refs: .claude/rules/core/skills.md, scripts/workflow/skills/README.md, scripts/workflow/skills/pending.txt, CLAUDE.md CORE_RULES line
notes: rewritten skills = ebb, recon, journal, wen, worktree, route-map, inbox, order, fmt (brief, ask, flux-stop), fork-init (project.template.md comment), ship; meaning unchanged, Japanese user-facing wording kept verbatim. ship headings renamed (STOP CASES, NOTICE COMPOSITION, CLEANING UP BODIES); references in flux/relay.md, inbox and .notices/README.md updated. A fork that edited upstream skill text gets merge conflicts in those files: take upstream's text (skills are upstream-owned). Fork-added skills may adopt the form at will; the check only warns. scripts/workflow/skills/pending.txt is upstream-owned and empties over time.
