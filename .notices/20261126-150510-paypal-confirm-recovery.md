# DOWNSTREAM NOTICE id:20261126-150510-paypal-confirm-recovery
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:(this commit)
date: 2026-11-26T15:05:10+09:00
severity: info
checkpoint: paypal-confirm-recovery
resolves: 20261126-142835-paypal-confirm-failure-recovery
change: CANCELLED — do not apply. This PayPal confirm-recovery change (commit b7abfeb17) is reverted by .notices/20261126-194531-paypal-revert.md (D350); taken in together with that revert it is zero diff. The old body (re-read on confirm failure, completion from expired and failed incl. bank-transfer approval, reconcile of stale client_sdk rows on initiate and in cron expire-pending-purchases, wallet balance refresh) no longer holds
why: the accident it answered did not happen (pandora: every PayPal confirm failure was INSTRUMENT_DECLINED and the capture webhooks arrived), and the change, with no off switch, reconciles and grants over every past expired / processing row = a double-grant risk
required_actions: none (do not pick it ahead and do not follow its old steps; a fork that already took it follows .notices/20261126-194531-paypal-revert.md)
verify: -
manual_steps: -
refs: .notices/20261126-194531-paypal-revert.md; commit b7abfeb17 (the change) and its revert; D350
notes: kept (not deleted) so every fork reads this cancelled body: a deleted body would leave the old one live. No DB change either way. Its hotfix: line is removed, so /flux no longer picks b7abfeb17 ahead; the revert's skip_checkpoint lets a fork that has not taken it pass this checkpoint without stopping on the change
