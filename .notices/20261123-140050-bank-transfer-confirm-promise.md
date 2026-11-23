# DOWNSTREAM NOTICE id:20261123-140050-bank-transfer-confirm-promise
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:qc/kagerou/o/20261123-135923-bank-transfer-confirm-promise | commit:- (this commit)
date: 2026-11-23T14:00:50+09:00
severity: info
checkpoint: bank-transfer-confirm-promise
fixes: 20261108-170003-admin-screen-hooks
resolves: 20261123-135842-bank-transfer-confirm-promise
change: the approve dialog of the admin bank-transfer review (src/app/admin/(protected)/bank-transfer-reviews/[status]/_screen/BankTransferReviewDetailModal.tsx) passes a Promise to Dialog onConfirm again (`async () => { await confirm(); }` instead of `() => void confirm()`), so Dialog shows its pending state and locks the button until the approve request ends
why: the void wrapper from admin-screen-hooks gave Dialog no Promise: a fast double click sent the approve API twice (the second failed on the state check with an error toast; no double approval)
required_actions: none (a fork that copied this Screen into _components/ applies the same one-line change: `git grep -n 'onConfirm={() => void ' -- 'src/app/**/_components/**'`)
verify: double click on 承認する in the approve dialog sends one request (network panel), the button shows its loading state meanwhile
manual_steps: -
refs: src/components/Overlays/Dialog.tsx (runAction), src/domains/core/bankTransferReview/hooks/useAdminBankTransferReviewDecision.ts (confirm)
notes: the other onConfirm in src was checked: Unsubscribe passes `() => void submit()` to UnsubscribeConfirm, whose onConfirm is `() => void` on a Button with loading={pending} (guarded by isSubmitting), not a Dialog: left as is
