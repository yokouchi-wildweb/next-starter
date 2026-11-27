# DOWNSTREAM NOTICE id:20261127-125424-core-approval-drizzle-pin
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261111-153718-claude-md-context.2-content | commit:- (this commit)
date: 2026-11-27T12:54:24+09:00
severity: action-required
checkpoint: core-approval-drizzle-pin
change: (1) CLAUDE.md and core/ change only after the human approves, every character (a typo included); the approval-free usual path is cards, READMEs and service files; core/design.md authoring approval and usual path, CLAUDE.md HEART and words (approval item) say so; a new place's cover line still goes in the same commit, as a core change; (2) new key CLAUDE.md STACK drizzle_kit: drizzle-kit pinned 0.31.8 with patches/drizzle-kit@0.31.8.patch (pnpm.patchedDependencies) is this project's architecture until drizzle 1.0 is GA, then a move is considered; forks never change its version; the root_files version exception (CLAUDE.md root_files, core/ownership.md root_files) now excludes a version STACK pins
why: an agent rewrote CLAUDE.md without approval because "important" was left to its judgment; drizzle-kit outside 0.31.8 loses the patch and db:push may plan a wrong DROP
required_actions:
1. check package.json: devDependencies "drizzle-kit" must be "0.31.8" and pnpm.patchedDependencies must hold "drizzle-kit@0.31.8": "patches/drizzle-kit@0.31.8.patch" | either differs → set both back to upstream's values, then pnpm install | both match → nothing to do
verify: `pnpm check registry` passes (its drizzle-kit pin check)
manual_steps: -
refs: .claude/rules/core/design.md authoring; CLAUDE.md THIS_FILE HEART, STACK drizzle_kit, CORE_FILES root_files; .claude/rules/core/ownership.md root_files; scripts/structure/registry/drizzleKitPin.mjs
notes: key table: no key renamed or removed; new key CLAUDE.md STACK drizzle_kit | a fork's own context that relied on the old usual path (fixing a CLAUDE.md line or adding a core rule without approval) applies to Tier1 only: a fork never edits CLAUDE.md or core/ anyway (/order next-starter)
