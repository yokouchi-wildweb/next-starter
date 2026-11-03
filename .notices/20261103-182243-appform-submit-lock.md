# DOWNSTREAM NOTICE id:20261103-182243-appform-submit-lock
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-03T18:22:43+09:00
severity: info
checkpoint: appform-submit-lock
resolves: 20261103-072925-appform-double-submit-lock
change: AppForm now drops a second submit while one is in flight with a synchronous ref lock (src/components/Form/submitLock.ts); the lock is held through validation, onSubmit and the media commit and released on success and failure.
why: isSubmitting / pending are state and apply on the next render, so two clicks in one frame called onSubmit twice (generated Create* forms could insert a record twice). Behaviour change is limited to dropping that duplicate call; props and API are unchanged.
required_actions: none
verify: pnpm test:form-submit-lock passes; pnpm typecheck passes
manual_steps: -
refs: src/components/Form/AppForm.tsx, src/components/Form/submitLock.ts, src/components/Form/submitLock.test.ts, src/components/Form/README.md, order 20261103-072925-appform-double-submit-lock
notes: ref locks a fork added to its own screens around AppForm's onSubmit stay harmless; they may be removed when the screen submits only through AppForm. Locks around other actions (useAsyncAction) are unrelated and stay.
