# DOWNSTREAM NOTICE id:20261122-192808-relay-check-permits
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-22T19:28:08+09:00
severity: info
checkpoint: relay-check-permits
resolves: 20261118-101252-relay-check-exclude-permits
change: /flux relay check (.claude/skills/flux/relay-check.mjs) no longer counts per-repo temporary permit files .fork-ownership/<repo_id>.permits.txt in ① overlap / ② outside (listed under excluded in relay.md)
why: a permit line goes each time its order ships as resolves:, so a middle tier got a false result: needed on such segments; each repo reads only its own permit file, so a relay notice for it has no content
required_actions: none
verify: node .claude/skills/flux/relay-check.mjs on a segment whose only fork-side change is a removed permit line → exit 0 (no outside: line)
manual_steps: -
refs: .claude/skills/flux/relay-check.mjs, .claude/skills/flux/relay-check.test.mjs, .claude/skills/flux/relay.md | order 20261122-190306-quest-relay-check-exclude-permits
notes: /flux reads the tool from the upstream tip, so the fix acts from the next intake | other files under .fork-ownership/ still count
