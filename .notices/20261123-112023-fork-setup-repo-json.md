# DOWNSTREAM NOTICE id:20261123-112023-fork-setup-repo-json
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:qc/kagerou/o/20261123-111525-fork-setup-repo-json-guide | commit:(this commit)
date: 2026-11-23T11:20:23+09:00
severity: info
checkpoint: fork-setup-repo-json
resolves: 20261118-095203-fork-setup-repo-json-guide
change: docs/setup/新規プロジェクトの立ち上げ_フォークからデプロイまで.md section 4 gets a repo.json subsection: repo_id / tier written by /fork-init, agent.* policy values (auto / manual / off), unwritten keys = manual, write the policy with /repo-policy, pointers to src/lib/forkOwnership/README.md and scripts/workflow/devcheck/README.md
why: info only (doc); a fork that never wrote agent.* runs every agent check after a one-time /allow — /repo-policy writes the policy
required_actions: none
verify: grep -n "repo.json" "docs/setup/新規プロジェクトの立ち上げ_フォークからデプロイまで.md"
manual_steps: -
refs: docs/setup/新規プロジェクトの立ち上げ_フォークからデプロイまで.md, order 20261123-111525-fork-setup-repo-json-guide
notes: -
