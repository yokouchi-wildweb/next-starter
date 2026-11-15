# DOWNSTREAM NOTICE id:20261115-152748-user-group-readme-finish
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-15T15:27:48+09:00
severity: info
checkpoint: user-group-readme-finish
change: (1) src/features/core/messaging/README.md is rewritten in the README form (Overview / Usage / API / Extension / Internals / Verification / Related): how to send, the four targets (all / role / group / selected users; a group is frozen at send start into message_dispatch_recipients by one statement, all / role stop at the send-start time line), what to use instead of the removed audiences (a userGroup criteria item or a static group filled by the fork's own task), the operator lines, config keys and every receptacle. Detail moved into new READMEs beside the code: services/server/{sendMessage,admin,templates,overrides,preferences,unsubscribe,inbox,endpoints,webhooks,subscribers,sweep}/README.md, channels/README.md, components/README.md, entities/README.md. History sections (legacy send path, legacy notification copy, table plans) and the file list are gone. (2) src/features/core/userGroup/README.md is rewritten (criteria items, static groups from a fork's task, event-driven recipients are not groups, heavy criteria and scheduled evaluation, index requirements, member and time limits, admin screens and API).
why: Both READMEs had stale sections and old names after the group-target change; forks read them to decide how to target sends.
required_actions:
1. Merge upstream up to this checkpoint (documentation only, no code or DB change).
verify: pnpm check notices passes; git grep -il audience -- src/features/core/messaging/README.md 'src/features/core/messaging/**/README.md' finds nothing
manual_steps: -
refs: src/features/core/messaging/README.md, src/features/core/userGroup/README.md, council 20261108-120538-system-messaging-templates (legate l2, order 52)
notes: No code change. The look finishing of the same segment adds its own change: lines to this notice later.
