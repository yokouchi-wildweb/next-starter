# DOWNSTREAM NOTICE id:20261024-184245-legal-enacted-at-format
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-10-24T18:42:45+09:00
severity: info
checkpoint: legal-enacted-at-format
change: LegalDocumentRenderer (@/lib/structuredDocument/legal) takes a new optional prop `enactedAtFormat: LegalEnactedAtFormat` = `{ both?, enactedOnly?, updatedOnly? }`, string templates for the enacted / last-updated line with `{enactedAt}` / `{lastUpdatedAt}` placeholders. Omitted keys keep the previous wording ("制定日：… / 最終改定日：…", "【…制定】", "最終改定日：…"). Strings only, so a server-component Screen can pass it (a function prop could not cross into this "use client" renderer).
why: The wording of this line was hard-coded; forks changed it by editing the renderer in lib.
required_actions:
1. Merge upstream up to this checkpoint. If the fork edited src/lib/structuredDocument/legal/Renderer/index.tsx only to change this line (find: `git diff upstream/main -- src/lib/structuredDocument/legal`), take upstream on conflict and pass `enactedAtFormat` from the fork's Screen (replacement Screens under src/app/(user)/(legal)/*/_components/).
verify: `pnpm typecheck` | /terms, /privacy-policy, /tradelaw show the same date line as before when enactedAtFormat is not passed
manual_steps: -
refs: src/lib/structuredDocument/legal/definition.ts (LegalEnactedAtFormat) | src/lib/structuredDocument/legal/Renderer/index.tsx | src/lib/structuredDocument/legal/README.md | order 20261019-122328-fork-extension-points-bundle item (22)
notes: No DB change, no db:push. | The date values themselves stay free-form strings from business.config.ts (legal.*.enactedAt / launchedAt); change those to change the date format.
