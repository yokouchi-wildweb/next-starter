# DOWNSTREAM NOTICE id:20261126-113934-activity-once-init
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:(this commit)
date: 2026-11-26T11:39:34+09:00
severity: action-required
checkpoint: activity-once-init
resolves: 20261126-111800-activity-once-init-ref-sweep
hotfix: pages kept in <Activity> (cacheComponents) skip a ref-guarded once-only init on return (pandora production: the rush gacha showed the previous finished screen and could not be played); sweep your own code first
change: new lib src/lib/pageLeave (useOnPageLeave: runs only when a page is really left — hidden by <Activity> or unmounted, never on StrictMode's simulated remount); new lint activity/once-ref-guard (Tier1 error, forks warn) and rule key core/client.md activity_state; upstream per-visit fixes in useTransitionGuard, useAutoLogout, useStartDevicePairing, usePurchaseStatusPolling, and useInfiniteScrollQuery no longer resets the list / scroll on return
why: cacheComponents keeps a left page's state and refs and re-runs its effects on return; an effect made once-only by a ref guard (if (doneRef.current) return; doneRef.current = true) never runs again, so the page shows its previous end state; the same pattern exists in fork code (oripa-do / pandora gachaMachine useRushSession, useLoopSession)
required_actions:
1. list the hits in your own code: `pnpm exec eslint --no-warn-ignored --rule '{"activity/once-ref-guard":"error"}' src` (the rule ships with this notice; forks get it as warn in eslint.config.core.mjs)
2. for each hit, decide by what the page must do on a return visit: an init that must run per visit (start a session, validate, auto-start, resume polling, re-check state) → keep the guard and reset the ref and its state with `useOnPageLeave(() => { doneRef.current = false; /* reset state */ })` from @/lib/pageLeave | state that should stay on return (drafts, form values, scroll, double-submit locks, once-only analytics firing) → keep it and add `// eslint-disable-next-line activity/once-ref-guard -- <reason>` above the `= true` line
3. also review polling loops whose cleanup blocks a ref (e.g. isPollingRef.current = true in cleanup) without resetting it at the effect's start, and effects that skip their first run with a ref: they resume or reset wrongly on return (see the upstream fixes in usePurchaseStatusPolling and useInfiniteScrollQuery)
4. known fork example: oripa-do src/domains/gachaMachine/hooks/useRushSession.ts resumeCheckedRef and useLoopSession.ts (pandora takes oripa-do's fix; oripa-do has its own order for it)
verify: the command of step 1 prints no hit (every remaining case carries a reasoned disable); open the fixed page, navigate away and back: the per-visit init runs again (e.g. a finished gacha shows its start screen again)
manual_steps: -
refs: src/lib/pageLeave/README.md; eslint-rules/activity.mjs; .claude/rules/core/client.md activity_state; node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md; next.config.core.ts cacheComponents (66eb56835)
notes: new rule key .claude/rules/core/client.md activity_state (no key renamed or removed); new lib card .claude/rules/items/lib/pageLeave.md; intended keeping upstream left as is with reasoned disables: useInviteCodePrefill (form value), useInView once (frozen), useInfiniteScrollQuery first-run skip; double-submit locks (lockRef, reset in finally) are not hits; a lagging fork without some upstream file (e.g. still on src/features) gets those parts reported as left-out by hotfixApply
