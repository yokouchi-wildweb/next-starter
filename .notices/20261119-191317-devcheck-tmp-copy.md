# DOWNSTREAM NOTICE id:20261119-191317-devcheck-tmp-copy
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261106-194813-tooling-ownership-and-growth.2 | commit:(this commit)
date: 2026-11-19T10:13:17Z
severity: info
checkpoint: devcheck-tmp-copy
change: the devcheck permission hook (scripts/workflow/devcheck/lib.grant.mjs) no longer stops writes to a repo.json under the system temp dir (os.tmpdir() and TMPDIR, real path): throwaway copies made for checks; relative targets resolve from the tool call's cwd, and a command that cds inside itself is judged by absolute paths only
why: the fixed stop hit every file named repo.json, so an agent could not set up a scratch copy for a check; the checkout's own repo.json, other repos' repo.json, production env files and the one-time permit file are still stopped as before
required_actions: none
verify: node --test scripts/workflow/devcheck/devcheck.grant.test.mjs
manual_steps: -
refs: scripts/workflow/devcheck/lib.grant.mjs, scripts/workflow/devcheck/README.md (許可の層)
notes: no fork work; the hook reads the PreToolUse input's cwd (Request.cwd)
