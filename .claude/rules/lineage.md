# lineage
> **ROLE**: rules a middle tier passes to its downstream forks | always loaded (no paths:) | Tier1 ships this preamble only, never a section of its own | format follows CLAUDE.md FORMAT_RULE
> **SECTIONS**: a repo with repo.json `tier` root or middle appends `## <repo_id>` at the end only when it has rules to pass, closed by `<!-- end <repo_id> -->` | order = oldest ancestor first, this repo last | `tier` leaf with a section = check fails
> **CONTENT**: a section holds only rules that apply to this repo and its downstream | self-description → project.md | state / values → config (source of truth)
> **KEYS**: a key = a line `- <key>: <rule>` or `- <key> (default): <rule>` inside a section | unique within its section | other prose and ### subheadings are contract text, not keys
> **OVERRIDES**: only a `(default)` key can be overridden | in project.md: `overrides: <repo_id>.<key> = <value> | why: <reason>` (1 key per line, this repo only) | to pass it downstream too, the same line in this repo's own section
> - name the key's original owner repo_id | several layers override the same key → the nearest layer wins, this repo's project.md last | unsure whether downstream may change a rule → mark it (default)
> - fails: the named key is missing, or not (default), or the same target twice in one section / one project.md | warns: a project.md key with an ancestor key's name and no overrides line
> **LIMITS**: core rules and CLAUDE.md are never overridden here | an ancestor's section is its contract to downstream: never edit it, not even a typo → /order <its owner> | files a middle tier added (outside this file) may be fixed below it, except the parent's .default files
<!-- end preamble -->
