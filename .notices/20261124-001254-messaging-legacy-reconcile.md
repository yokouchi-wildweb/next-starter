# DOWNSTREAM NOTICE id:20261124-001254-messaging-legacy-reconcile
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261026-152333-shared-shelf.4r | commit:- (this commit)
date: 2026-11-24T00:12:54Z
severity: info
checkpoint: messaging-legacy-reconcile
fixes: 20261111-170853-messaging-drop-legacy
pick: -
resolves: 20261124-083251-messaging-copy-legacy-reconcile
change: the body of notice 20261111-170853-messaging-drop-legacy is corrected (no code change): step 1 = the hard two-push order (push the messaging-switch schema alone, answering drizzle-kit's "created or renamed" with "created"; then notice 20261122-193048-legacy-read-states-fix and the copy at that checkpoint; only then drop-legacy and its push) | step 4 = the real 20 statements on a database at the messaging-switch schema (4 DISABLE ROW LEVEL SECURITY, 4 DROP TABLE, DROP INDEX idx_message_deliveries_user + CREATE INDEX idx_message_deliveries_user_created, 7 DROP COLUMN, 3 DROP TYPE; 18 where the index already exists) | notes = why no push guard
why: the old step 4 said exactly 14 statements and "anything else → stop", so a careful operator stopped on the right list (pandora's rehearsal on a copy of production: 20); the two-push order and the copy fix were not written as hard steps; a fork that has not taken drop-legacy reads the corrected body when it reaches it (/flux reads every body's last version)
required_actions: none
verify: -
manual_steps: -
refs: .notices/20261111-170853-messaging-drop-legacy.md (steps 1, 4, notes) | .notices/20261122-193048-legacy-read-states-fix.md | src/domains/core/messaging/services/server/inbox/README.md (静かな行) | order 20261124-083251-messaging-copy-legacy-reconcile
notes: a fork past drop-legacy has nothing to do | a copy that ends failed "照合が合いません: readStates" = notice 20261122-193048-legacy-read-states-fix not taken at the messaging-switch checkpoint: apply its codemod there and rerun the copy (rows already copied are corrected by GREATEST) | no push guard is added: pnpm db:push shows the statements and drizzle-kit's row counts of the tables it drops and asks y/N (stops without a TTY); a generic push reading one task's record would be a special case for a task gone from this tree, so drop-legacy step 2's task_runs query stays the guard | inboxUnreadCount lower than the read=false rows of the inbox list = by design: silent rows (metadata.silent = true, copied from the old is_silent) are shown in the list and never counted
