# lineage
> **ROLE**: rules a middle tier passes to its downstream forks | always loaded (no paths:) | Tier1 ships this preamble only, never a section of its own | format follows core/design.md format
> **SECTIONS**: a repo with repo.json `tier` root or middle appends `## <repo_id>` at the end only when it has rules to pass, closed by `<!-- end <repo_id> -->` | order = oldest ancestor first, this repo last | `tier` leaf with a section = check fails
> **CONTENT**: a section holds only rules that apply to this repo and its downstream | self-description → project.md | state / values → config (source of truth)
> **KEYS**: a key = a line `- <key>: <rule>` inside a section | unique within its section | other prose and ### subheadings are contract text, not keys
> **CHANGING BELOW**: a repo below changes an ancestor's key by writing the same key marked `(priority)` in its own context (project.md, behavior.md, own rules; in its own section to pass it further down) | the nearer mark wins (core/design.md priority) | no mark → the ancestor's line wins
> **LIMITS**: an ancestor's section is its contract to downstream: never edit it, not even a typo → /order <its owner> | files a middle tier added (outside this file) may be fixed below it, except the parent's .default files
<!-- end preamble -->
