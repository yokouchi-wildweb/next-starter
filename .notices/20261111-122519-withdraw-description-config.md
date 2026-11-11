# DOWNSTREAM NOTICE id:20261111-122519-withdraw-description-config
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:qc/akatsuki/o/20261110-170714-withdraw-description-config | commit:- (this commit)
date: 2026-11-11T12:25:19+09:00
severity: action-required
checkpoint: withdraw-description-config
resolves: 20261101-111956-intake-withdraw-early-reg-mail
change: withdrawal screen text (WithdrawDescription) now comes from accountLifecycle config key withdraw.description; new owner src/features/core/accountLifecycle/config.ts + empty override src/config/features/accountLifecycle.config.ts
why: forks that edited WithdrawDescription.tsx (a core file, under a temporary permit) can now change the text in config only; the permit citing 20261101-111956-intake-withdraw-early-reg-mail expires with this resolves
required_actions:
1. find a fork edit of the component: `git diff --name-only $(git merge-base HEAD <upstream remote>/main) HEAD -- src/features/core/accountLifecycle/components/Withdraw/WithdrawDescription.tsx src/features/core/user/components/Withdraw/WithdrawDescription.tsx` | empty → nothing more to do (steps 2-3 skipped)
2. move the fork's text into src/config/features/accountLifecycle.config.ts as a literal: `export default { withdraw: { description: "<text>" } } satisfies AccountLifecycleOverride;` (keep the import line of the upstream file) | "\n" renders as a line break (whitespace-pre-line); a bulleted list → one line per item starting with "・" | the fork already has this file with its own keys → add withdraw.description into its object, do not make a second default export
3. restore the component to upstream: `git checkout <upstream remote>/main -- src/features/core/accountLifecycle/components/Withdraw/WithdrawDescription.tsx` | drop the permit row of .fork-ownership/<fork>.permits.txt that names WithdrawDescription.tsx with upreq:20261101-111956-intake-withdraw-early-reg-mail (it expires as expired-resolved anyway)
verify: pnpm typecheck | pnpm test src/features/core/accountLifecycle | pnpm check config-overrides | pnpm workflow ownership check shows no edit of WithdrawDescription.tsx and no live permit on it | /mypage/withdraw shows the fork's text
manual_steps: -
refs: src/features/core/accountLifecycle/config.ts | src/features/core/accountLifecycle/README.md (設定) | precedent src/features/core/coupon/config.ts (5526b0d6) | order 20261110-170714-withdraw-description-config | messaging council D58
notes: forks edits counted (fleet.conf, git show HEAD:<WithdrawDescription.tsx> still has the upstream text?): 88-base yes, triq yes, boardgame-site yes, next-vnx yes, oripa-do no (edited: list of 3 items between 2 paragraphs, 14+/4- vs merge-base) | oripa-do's <ul> markup cannot be kept as config text; the "・" lines keep the content, the exact list look needs a copy of the screen part in _components/ (FORK_EXTENSION: looks only) | default text unchanged (same 2 sentences, joined by a space as the old JSX rendered)
