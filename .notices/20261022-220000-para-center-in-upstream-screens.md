# DOWNSTREAM NOTICE id:20261022-220000-para-center-in-upstream-screens
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:(change ships in the commit that contains this notice)
date: 2026-10-22T22:00:00+09:00
severity: info
checkpoint: para-center-in-upstream-screens
change: Visual fix only. 17 `<Para>` without `align` inside a `text-center` parent in upstream-owned files now carry `align="center"` (they rendered left-aligned because Para defaults to `align="left"` = `text-left`; TextBlocks trap 2 of notice 20261019-124714). Files: `src/app/(user)/(auth)/demo-login/_screen/DemoLoginSection.tsx`, `(user)/(auth)/reactivate/complete/_screen/ReactivateCompleteScreen.tsx`, `(user)/(auth)/restricted/_screen/RestrictedScreen.tsx`, `(user)/(auth)/signup/email-sent/_screen/SignupEmailSentScreen.tsx`, `(user)/(auth)/signup-closed/_screen/SignupClosedScreen.tsx`, `(user)/maintenance/_screen/MaintenanceScreen.tsx`, `src/features/core/auth/components/ForgotPassword/index.tsx` (success view), `PhoneVerification/CompleteStep.tsx`, `ResetPassword/index.tsx` (validating / invalid-link / completed views). No prop / API change.
why: Every fork renders these default screens and core auth components; forks must not edit them. Reported by oripa-do (AST scan of JSX ancestors). Notice 20261019-124714 stated that upstream had no instance of trap 2, which was wrong (its notes are corrected in this commit).
required_actions:
1. Merge upstream. No conflicts expected unless your fork edited the files above (keep upstream's `align="center"`).
2. Optional: if your fork copied any of these Screens / components into its own files (e.g. `src/app/<route>/_components/<X>Screen.tsx`), the copy is not fixed by the merge. Add `align="center"` (or `align="inherit"`) to each `<Para>` without `align` inside a `text-center` parent there, the same way.
verify: `npx tsc --noEmit` passes; manual: /signup-closed or /restricted shows the body text centered under the centered title.
manual_steps: -
refs: src/components/TextBlocks/README.md (traps), src/components/TextBlocks/textVariants.ts (align), .notices/20261019-124714-text-blocks-inherit.md, upstream-request 20261020-133404-para-align-trap-in-upstream-screens
notes: No lint added for this trap: the parent's text-align is a className on another component (static detection needs JSX ancestry analysis across cn() / conditional classes), out of scope here. Para outside the centered blocks in the same files (form views of ForgotPassword / ResetPassword) are left-aligned by design and unchanged.
