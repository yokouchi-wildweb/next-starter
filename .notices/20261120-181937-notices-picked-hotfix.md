# DOWNSTREAM NOTICE id:20261120-181937-notices-picked-hotfix
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261106-194813-tooling-ownership-and-growth.2 | commit:- (this commit)
date: 2026-11-20T18:19:37+09:00
severity: info
checkpoint: notices-picked-hotfix
fixes: 20261120-123806-hotfix-apply
pick: -
change: the notices contract test (pnpm check notices, scripts/workflow/notices/notices.test.mjs) no longer checks "a hotfix: notice is one commit with its body" for notices the fork's ledger (.notices/applied/<repo_id>.md) records with picked: (scripts/workflow/notices/hotfixApply.mjs ledgerPickedIds); the body of notice 20261103-161212-domain-json-comment-key is corrected (description fix): its verify and notes grep the key form only, '"description"[[:space:]]*:'
why: a fork that picked a hotfix ahead with hotfixApply skips (left-out) the body files its tree lacks, so its pick commit can hold the notice alone and the check failed (28/30 on a fork without scripts/workflow); the old verify `git grep -n '"description"'` also matched field names given as values ("name": "description", searchFields lists), so "lists nothing" could not hold
required_actions: none
verify: pnpm check notices passes on a fork whose ledger has picked: lines for hotfix notices whose pick commit holds only the notice
manual_steps: -
refs: scripts/workflow/notices/hotfixApply.mjs (ledgerPickedIds), scripts/workflow/notices/notices.test.mjs, scripts/workflow/notices/hotfixApply.test.mjs, .notices/README.md (緊急修正(hotfix)), .notices/20261103-161212-domain-json-comment-key.md
notes: no fork action. A fork that renames its "description" note keys to "$comment" (optional, notice 20261103-161212-domain-json-comment-key) checks with the corrected verify: the word as a value is a name and stays
