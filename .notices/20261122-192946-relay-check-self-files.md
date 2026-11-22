# DOWNSTREAM NOTICE id:20261122-192946-relay-check-self-files
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-22T19:29:46+09:00
severity: info
checkpoint: relay-check-self-files
resolves: 20261122-003958-relay-check-exclude-repo-json
change: /flux relay check (.claude/skills/flux/relay-check.mjs) leaves out every type-5 self file (SELF_FILES of src/lib/forkOwnership: .claude/rules/project.md, behavior.md, repo.json) instead of its own list of the two rule files; repo.json no longer gives overlap / outside lines (relay.md excluded list updated)
why: repo.json holds each repo's own identity and agent policy and never reaches downstream, yet an upstream change to it made a middle tier judge "relay needed"
required_actions: none
verify: node .claude/skills/flux/relay-check.mjs on a segment where upstream and the fork both changed repo.json → no overlap: / outside: line for repo.json
manual_steps: -
refs: .claude/skills/flux/relay-check.mjs, .claude/skills/flux/relay-check.test.mjs, .claude/skills/flux/relay.md, src/lib/forkOwnership/self.mjs (SELF_FILES) | order 20261122-190307-quest-relay-check-exclude-repo-json
notes: the export FORK_RULES_FILES of relay-check.mjs is gone (no importer); the one list of self files is SELF_FILES | /flux runs relay-check from the fork's tree after the merge, so the fix acts once this notice is merged
