---
paths:
  - "src/lib/messaging/**"
---
# lib/messaging
what: the mechanism side of one-way messages (mail, in-app, LINE, fork channels): definition / override / layout / receptacle item types, definition checks, ChannelError | no tables (records, recipients, opt-outs = domain messaging) | entry @/lib/messaging
use: always
change: override = domains/**/messages/<name>.override.ts (`export const messageOverride`) | add channels, categories, layouts, templates → receptacles of domains/core/messaging
rules:
using:
- definition_data_only: one message = `export const message = defineMessage({…})` in the raising domain's messages/<name>.ts, data only | key = `<domain folder>.<file>` as a literal
- category_not_kind: a definition writes `category` only (kind and channels come from it) | a category = one event as the user sees it, never a domain or feature
- no_recategorize: an override never changes kind, key, vars, varNames, required or layout | it may move the message to another category (a fork's own too, any kind, functional included) and replace channelModes as a whole | kind trait checks run on the overridden values
- functional_unstoppable: functional messages are never disabled, lose email, get admin text or throttle | judged on the category after the override (a moved message follows its new kind)
- secret_vars: token URLs and one-time codes use secretVar
- guard_literals: required, category, adminEditableOnly, enabled, kind, channels, group are literals
- admin_free_text: admin-written messages have no definition → a layout or a DB template (sendFreeMessage)
- fixed_vocabulary: field types are fixed in the lib | a fork registers input parts in src/wiring/formInputs
- required_for: a layout field required only when some channels are sent (the upstream subject = email) uses requiredFor, never a channels mark (channels hides the field from the other channels) | whether a field is required is read only through fieldRequiredIn(spec, channels) (forms, marks, checks)
- summary_title: a layout whose subject may be absent builds its summary title with summaryTitle(subject, body) (the body's first line when there is no subject)
editing:
- layout_revisions: changing or removing a layout field key bumps `version` and writes a `revisions` step for every version
- error_vocabulary: ChannelError kinds stay the MailSendError vocabulary (transient / permanent / unknown)
- idempotent_items: channel `remove` and subscriber `handle` give the same result when called again
read: define, override → Usage | fields, vars, checks, layouts → API | receptacle items, record targets → Extension | guards, design intent, registry → Internals
