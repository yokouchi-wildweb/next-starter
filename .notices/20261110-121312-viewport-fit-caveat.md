# DOWNSTREAM NOTICE id:20261110-121312-viewport-fit-caveat
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:legate/20261023-175358-config-redesign.1 | commit:- (this commit)
date: 2026-11-10T12:13:12+09:00
severity: info
checkpoint: config-viewport-fit-caveat
fixes: 20261108-202604-business-home
resolves: 20261110-100046-viewport-fit-notice-caveat
change: caveat for step 4 of notice 20261108-202604-business-home (viewport moved to src/config/layout/root.config.ts): the override is deep-merged, so keys you leave out keep the upstream default of src/app/_layout/config.ts — viewport { width: "device-width", initialScale: 1, viewportFit: "cover" } | copying only width / initialScale from an old seo.config.ts that had no viewportFit adds viewport-fit=cover to the meta viewport (drawing under the notch / safe areas) — a silent rendering change | comments in src/app/_layout/config.ts and src/config/layout/root.config.ts now say so; the default value is unchanged
why: forks whose old seo.config.ts viewport had no viewportFit render edge-to-edge after the business-home segment unless they write viewportFit: "auto"
required_actions:
1. Find the viewport you had before the business-home segment: `git log --diff-filter=D --format=%h -1 -- src/config/seo.config.ts` gives the deleting commit <sha>; `git show <sha>^:src/config/seo.config.ts` shows its viewport (not merged yet: read your current src/config/seo.config.ts).
2. If that viewport had no viewportFit (or "auto") and you want the same rendering, write it into src/config/layout/root.config.ts: `export default { viewport: { viewportFit: "auto" } } satisfies RootLayoutOverride;` (keep the import type line; add other keys only if they differ from upstream's default). [判断] TriQ, next-vnx, 88-base: their old viewport had only width / initialScale → write viewportFit: "auto" (keeps today's rendering; switching to "cover" is a later choice of the fork, the frame parts already avoid the edges with --app-safe-area-*). oripa-do: already wrote viewportFit: "auto" (c18da15d3). boardgame-site: old viewport had "cover" → nothing to do.
3. If you already merged the business-home segment and wrote root.config.ts without viewportFit, apply step 2 now.
verify: the rendered page's <meta name="viewport"> matches the old one (no viewport-fit=cover unless you had it) | pnpm typecheck
manual_steps: -
refs: src/app/_layout/config.ts, src/config/layout/root.config.ts, notice 20261108-202604-business-home, order 20261110-100046-viewport-fit-notice-caveat (oripa-do railroad2 findings F3), council 20261023-175358-config-redesign L1.40 L1.42, legate:l1 order 44
notes: comment-only change upstream; no code or default value changes. The optional migration check of the order (flag a fork whose old viewport lacked viewportFit) is not built: the check above is one git show.
