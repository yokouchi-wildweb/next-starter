# DOWNSTREAM NOTICE id:20261109-003730-appform-submit-reject-boundary
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-09T00:37:30+09:00
severity: info
checkpoint: appform-submit-reject-boundary
resolves: 20261108-172032-appform-rethrow-unhandled-reject, 20261108-202459-appform-submit-reject-boundary
change: AppForm catches a failed submit at the DOM form onSubmit boundary (no unhandled promise rejection) and restores the unsaved guard also when the media commit after onSubmit fails
why: a failing onSubmit (failure = throw, unsavedGuard contract) leaked as an unhandled HttpError in the browser console and the Next dev indicator; a media commit failure released the guard as if the save had succeeded
required_actions: none
verify: pnpm test src/components/Form/submitFailure.render.test.tsx; pnpm typecheck passes including upstream _screen/* default screens even where your page.tsx points to _components/; a failure there = your fork's core edit is not backward compatible (CLAUDE.md CORE_FILES fork_core_edit_compat) — fix the core side, do not edit the upstream Screen
manual_steps: -
refs: src/components/Form/AppForm.tsx (handleSubmitWithMediaCommit, handleDomSubmit), src/components/Form/README.md, src/components/Form/submitFailure.render.test.tsx, notice 20261108-170003-admin-screen-hooks
notes: no props or public names changed. onSubmit handlers keep throwing on failure and keep their own error toast; AppForm prints nothing. Callers that await inside onSubmit (customSubmit of AdminManagerialUserCreateForm, useAdminSetup().submit) still receive the rejection. The guard now stays released only after both onSubmit and the media commit succeed. A fork that wrapped AppForm's onSubmit in try/catch only to silence the console may drop that wrapper.
