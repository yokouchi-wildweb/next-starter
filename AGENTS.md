# AGENTS.md

- source_of_truth: [CLAUDE.md](./CLAUDE.md) (same directory as this file)
- additional_rules: [.claude/rules/](./.claude/rules/) (relative to this file; all Markdown files, including subdirectories)
- required: Before starting any task, read the current CLAUDE.md and discover and read all .claude/rules/**/*.md files in full; follow them as this repository's instructions.
- scope: Honor any applicability conditions declared in rule files (e.g. paths frontmatter); apply unscoped rules to all tasks.
- reload: At each new session and after context compaction, repeat discovery and reading before continuing work; include newly added rule files.
- maintenance: Keep shared rules in CLAUDE.md and additional rules in .claude/rules/; do not duplicate or summarize them here.
