# DOWNSTREAM NOTICE id:20261024-153414-claude-md-core-rules
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-10-24T15:34:14+09:00
severity: info
checkpoint: claude-md-core-rules
change: CLAUDE.md is split in two (199 → 158 lines, 34.7k → 26.0k chars). Edit-time detail of COMPONENTS, SCREENS, CRUD_SERVICE, DIRECTORY_STRUCTURE code_generation, API_ROUTES, AUDIT, ROLES flow, PROXY, SERVERS, STORES and STYLE_OWNERSHIP moved verbatim into path-scoped rule files .claude/rules/core/*.md (`paths:` frontmatter → Claude Code loads each file when a matching file is read). CLAUDE.md keeps each section's design-time essentials + a pointer line, and a new header line CORE_RULES. CORE_FILES now lists CLAUDE.md and .claude/rules/core/ as core. New test `pnpm test:core-rules` (scripts/claude-rules/coreRules.test.mjs): every `paths:` pattern still points at an existing file/dir, every rule file is referenced from CLAUDE.md and vice versa, CLAUDE.md < 200 lines.
why: CLAUDE.md sat at the 200-line warning limit. A before/after comprehension test (fresh `claude -p` sessions, 3 runs each, blind grading) showed equal scores: questions answered after opening a file 33/33 both, design-time questions with no file opened 27 correct / 3 partial (old) vs 30 / 0 (new). .claude/rules/core/ is upstream-owned like CLAUDE.md; per-project files (project.md, behavior.md, marker files) are unchanged.
required_actions:
1. Merge upstream. CLAUDE.md conflicts only if the fork edited it (it should not): take upstream's version and move any fork-specific line to .claude/rules/project.md.
2. Run `pnpm test:core-rules`. A "が存在しません" failure means the fork moved or deleted a core directory a rule points at: restore it, or file /upreq with the new path. Never edit .claude/rules/core/ in the fork.
verify: `pnpm test:core-rules` passes | `ls .claude/rules/core/` lists 10 files
manual_steps: -
refs: CLAUDE.md (CORE_RULES, CORE_FILES), .claude/rules/core/, scripts/claude-rules/coreRules.test.mjs
notes: Fork-specific impact: not checked.
