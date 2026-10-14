# DOWNSTREAM NOTICE id:20261014-160000-starter-home-switch
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:(change ships in the commit that contains this notice)
date: 2026-10-14T07:00:00Z
severity: action-required
change: `src/app/(user)/page.tsx` is now a 1-line switch (`export { StarterHome as default } from "./_components/StarterHome"`). The upstream demo top page moved to `src/app/(user)/_components/StarterHome/` (Server Component, single viewport via `<UserPage fill>`: full-viewport CSS-only backdrop via `<FullScreen layer="background">` + hero + capability cards; Three.js scene, Next logo, signup/login buttons, demo link list and the "edit page.tsx" notice were removed). Upstream will NEVER edit `(user)/page.tsx` again. Demo page list is now a single source `src/app/(user)/demo/_data/demoPages.ts` (with category); `/demo` index renders grouped by category.
why: Nearly every fork replaces the top page. With a one-line switch owned by downstream and the upstream demo living in a directory downstream never touches, future upstream changes to the demo top merge without conflicts.
required_actions:
1. On merge, `src/app/(user)/page.tsx` will conflict ONCE if the fork already customized it. Resolve by keeping the fork's version (`git checkout --ours -- "src/app/(user)/page.tsx"` from the fork's side, then verify it still compiles).
2. Recommended (one-time): move the fork's top page body into `src/app/(user)/_components/<Name>/` and reduce page.tsx to `export { <Name> as default } from "./_components/<Name>";` (keep any `metadata` / `dynamic` exports in page.tsx). Procedure: src/app/(user)/_components/StarterHome/README.md.
3. Do NOT delete or edit `src/app/(user)/_components/StarterHome/` — unreferenced code is excluded from the bundle; deleting it causes modify/delete conflicts on future upstream merges.
4. If the fork added demo pages under /demo, register them in `src/app/(user)/demo/_data/demoPages.ts` (path/label/description/category) — the old `DEMO_PAGES` array inside demo/page.tsx no longer exists.
verify: `npx tsc --noEmit` green; `/` renders the fork's own top page (or StarterHome if not customized); `/demo` lists every demo page grouped by category.
manual_steps: -
refs: src/app/(user)/page.tsx, src/app/(user)/_components/StarterHome/*, src/app/(user)/demo/_data/demoPages.ts, src/app/(user)/demo/page.tsx, src/app/README.md
notes: `src/components/Three/*` and the three / @react-three deps are left in place (no longer referenced by upstream pages). Downstream using them is unaffected.
