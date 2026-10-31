# DOWNSTREAM NOTICE id:20261031-161509-flux-follow-upstream
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-10-31T16:15:09+09:00
severity: info
checkpoint: flux-follow-upstream
hotfix: a fork behind upstream runs an outdated /flux for every segment until the segment with a fix is merged; once this rule is in the fork, every later /flux change (the new stop report included) applies from the next /flux without a pick
change: /flux reads the direct upstream tip's .claude/skills/flux/ and .claude/skills/fmt/ right after fetch and follows that text instead of the fork's merged copy (the same rule fleet workers already have: LATEST /FLUX). Tools the upstream procedure needs that the fork lacks are skipped and reported, never a halt. One hunk in .claude/skills/flux/SKILL.md (section 上流の最新の手順に従う)
why: the stop report rewrite shipped in 20261031-155408-flux-stop-format-memo would otherwise reach a fork only when it merges that segment, many segments away for the forks furthest behind — the forks that need the clearer report most
required_actions: none
verify: `pnpm test:flux-relay` passes | the next /flux prints `/flux: upstream <sha> の手順で実行` when the fork's copy differs from upstream's
manual_steps: -
refs: .claude/skills/flux/SKILL.md (上流の最新の手順に従う), ~/.team/_bin/fleet.d/roles/worker.md (LATEST /FLUX), .notices/20261031-155408-flux-stop-format-memo.md
notes:
- Taking this by hand (the /flux you have may not know hotfix: yet): `git cherry-pick -x <this commit>`, then a ledger line `- id:20261031-161509-flux-follow-upstream | date:<ISO8601> | commit:<pick short sha> | upstream:<output of git merge-base HEAD upstream/main> | picked:<full source sha> | notes:-` in a separate commit. Never write the source sha in upstream:
- If .claude/skills/flux/SKILL.md conflicts, keep the upstream hunk (the new section between 付属ファイル and 大原則) and your side elsewhere; the text itself is replaced by upstream's at the next /flux anyway
- The pick brings only the rule. brief / ask and the /fmt skill arrive with their segment (20261031-155408); /flux reads fmt/flux-stop.md from upstream until then
- Nothing to pick for a fork that already merged this segment. No db:push
- Fork state: not checked (no trial picks this time; the hunk sits in a region no earlier notice changed)
