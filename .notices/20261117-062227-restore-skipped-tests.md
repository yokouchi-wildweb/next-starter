# DOWNSTREAM NOTICE id:20261117-062227-restore-skipped-tests
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-17T06:22:27+09:00
severity: info
checkpoint: restore-skipped-tests
change: Test cases that were skipped while sheet 05 was built (marked '// D69: restore before ship', 39 files across messaging, userGroup, admin menu, auth, featureGate checks, lib/messaging and scripts/structure) are restored. Failing expectations were updated to the shipped behavior (kind key promotion, labels, every field editable by default with adminEditableOnly, dispatch delete, selectionMode, menu item メッセージ管理, criteria set, gate domainOpen). No source code changed: tests and test helpers only.
why: The skipped cases had to come back before the next ship so the messaging rebuild starts from a green base.
required_actions: none
verify: pnpm check notices passes; git grep -n "D69: restore before ship" -- src scripts finds nothing
manual_steps: none
refs: council 20261108-120538-system-messaging-templates (legate l2, order 53)
notes: Tests only; nothing for forks to change.
