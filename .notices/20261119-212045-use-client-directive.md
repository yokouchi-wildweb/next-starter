# DOWNSTREAM NOTICE id:20261119-212045-use-client-directive
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:(this commit)
date: 2026-11-19T21:20:45+09:00
severity: action-required
checkpoint: use-client-directive
fixes: 20261119-024228-v2-content
pick: -
change: new lint rule use-client/hooks-need-directive (all tiers error, in the required rules): a src file that calls a hook (useState, useEffect, any useXxx; not React's use()) must start with "use client"; 34 upstream component and hook files gain the directive
why: since the v2-content segment (commit 191299dd0, tableSuite BulkActionBar importing the Form/Input/Manual entry) `pnpm build` fails: PasswordInput.tsx calls useState without "use client" and is reached from a server component; only a production build showed it
required_actions:
1. Take this in; the upstream files are fixed by the merge.
2. Find your own files the rule now stops: `pnpm exec eslint src` → for each `use-client/hooks-need-directive` error, add `"use client";` as the first statement of that file (after the header comments). No behavior changes: those files only run on the client.
3. If such a file also exports a plain function or constant that server code imports (`git grep -n "<name>" -- src` shows an importer without "use client"), move that function or constant to its own file outside hooks/ and import it from there in both places.
verify: `pnpm exec eslint src` shows no use-client/hooks-need-directive error | `pnpm check eslint` passes | `pnpm build` passes | pnpm typecheck passes including upstream _screen/* default screens even where your page.tsx points to _components/; a failure there = your fork's core edit is not backward compatible (CLAUDE.md CORE_FILES fork_core_edit_compat) — fix the core side, do not edit the upstream Screen
manual_steps: -
refs: eslint-rules/use-client.mjs | eslint-rules/required-rules.mjs | .claude/rules/core/client.md use_client | .claude/rules/core/components.md use_client | commit 191299dd0
notes: test files (*.test.*) and src/featureGate/checks/ (test-only helpers) are outside the rule. A test that imports a "use client" file still runs (the directive is only a string under node).
