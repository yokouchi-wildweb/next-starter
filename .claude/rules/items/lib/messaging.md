---
paths:
  - "src/lib/messaging/**"
---
# lib/messaging
what: the mechanism side of one-way messages (mail, in-app, LINE, fork channels): definition / override / layout / receptacle item types, definition checks, ChannelError | no tables (records, recipients, opt-outs = domain messaging) | entry @/lib/messaging
use: always
change: overlay = features/**/messages/<name>.override.ts (`export const messageOverride`) | add channels, categories, layouts, templates → receptacles of features/core/messaging
rules:
using:
- definition_data_only: one message = `export const message = defineMessage({…})` in the raising domain's messages/<name>.ts, data only | key = `<domain folder>.<file>` as a literal
- category_not_kind: a definition writes `category` only (kind and channels come from it) | a category = one event as the user sees it, never a domain or feature
- no_recategorize: an override never changes category, kind, key, vars, required or layout | another category → disable the upstream message and add your own
- functional_unstoppable: functional messages are never disabled, lose email, get admin text or throttle
- secret_vars: token URLs and one-time codes use secretVar
- guard_literals: required, category, adminEditableOnly, enabled, kind, channels, group are literals
- admin_free_text: admin-written messages have no definition → system template or DB template
- fixed_vocabulary: field types are fixed in the lib | a fork registers input parts in src/wiring/formInputs
editing:
- layout_revisions: changing or removing a layout field key bumps `version` and writes a `revisions` step for every version
- error_vocabulary: ChannelError kinds stay the MailSendError vocabulary (transient / permanent / unknown)
- idempotent_items: channel `remove` and subscriber `handle` give the same result when called again
read: define, override → Usage | fields, embedding, checks, layouts → API | receptacle items → Extension | guards, design intent, registry → Internals
