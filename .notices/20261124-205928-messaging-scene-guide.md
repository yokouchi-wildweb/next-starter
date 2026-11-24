# DOWNSTREAM NOTICE id:20261124-205928-messaging-scene-guide
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261026-152333-shared-shelf.4r | commit:- (this commit)
date: 2026-11-24T20:59:28Z
severity: info
checkpoint: messaging-scene-guide
resolves: 20261125-055113-messaging-docs-scene-guide
change: docs only, src/domains/core/messaging/README.md for a first-time reader: what messaging is (never lib/mail send() for messages) and the reading order, glossary rows (renderer parts, the 3 rendering levels, gates), Usage「はじめての連絡を送る」(category → pnpm generate message → text → sendMessage → check), 「全体の地図」(each part and the README that holds it) and 「場面別の解き方」 | scenes: add a message, send to many, choose channels, preview / test, open a feature, the look of upstream mail (all = MailFrame.replace / one layout = <X>Email.replace / admin sends only = a fork layout with adminSelectable: true + initialLayout and the upstream simple / notice layout.override adminSelectable: false, so definition messages keep their look), add / remove admin-selectable layouts, change a definition message's text (override; a value not in vars = enricher; e.g. adjustmentNotice amount / reason), add a value to a sending call, let the admin edit the text (messagingOverrides), the recipient's name (text {{recipientName}}, mail renderer recipient?.displayName), and the old notification → messaging table | stale receptacle paths in the messaging READMEs corrected (categories/ layouts/ channels/ enrichers/ categoryGroups/ sources/ subscribers/ → <domain>/plugs/messaging*/, recordTargets/ → plugs/recordTargets/, the message generator's messages/ → plugs/messages/)
why: messaging's means were spread over per-point READMEs with no entry, so readers could not tell which receptacle fits a need (oripa-do's admin mail look)
required_actions: none
verify: -
manual_steps: -
refs: src/domains/core/messaging/README.md (Overview, Usage, Extension) | src/domains/core/messaging/Internals.md, components/README.md, services/server/admin/README.md | src/lib/messaging/README.md | scripts/structure/message/README.md | order 20261125-055113-messaging-docs-scene-guide
notes: no code change
