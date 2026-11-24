# DOWNSTREAM NOTICE id:20261125-054246-email-layout-recipient
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:qc/kagerou/o/20261125-053905-email-layout-recipient-name | commit:- (this commit)
date: 2026-11-25T05:42:46+09:00
severity: info
checkpoint: email-layout-recipient
resolves: 20261125-053822-email-layout-recipient-name
change: a layout's mail renderer (layouts/<name>/email.tsx Component, and so a fork's <X>Email.replace.tsx) now also gets an optional `recipient?: MessageLayoutEmailRecipient` (`{ displayName: string | null }` from users.name; new type exported from @/lib/messaging); the six upstream props types (SimpleEmailProps, NoticeEmailProps, AlertEmailProps, LinkEmailProps, StatementEmailProps, WelcomeEmailProps) carry it. The email channel looks the names up once per send (deps.findRecipients) and passes it only for a user's address; preview, addresses without a user, and the generic / summary renderings get none. The upstream looks do not use it: their output is unchanged. A failed name lookup sends nothing in that call and returns transient `recipient_lookup_failed` (retried like other transient results).
why: a fork's .replace could not put the recipient's name ("◯◯ 様") into its mails: the renderer got only values, summary, theme and unsubscribeUrl
required_actions: none (optional prop). To show the name: in your `<X>Email.replace.tsx` read `recipient?.displayName` from props (type `MessageLayoutEmailRecipient` from @/lib/messaging, or the upstream `<X>EmailProps`) and fall back when it is undefined or null (preview, no user, name not set).
verify: a mail sent to a user through a layout whose .replace reads `recipient?.displayName` shows the user's name; the upstream layouts' HTML is the same as before
manual_steps: -
refs: src/lib/messaging/receptacles/types.ts (MessageLayoutEmailRenderer, MessageLayoutEmailRecipient), src/domains/core/messaging/plugs/messagingChannels/email/createEmailChannel.tsx (findRecipients, emailElement), src/domains/core/messaging/plugs/messagingChannels/email/index.tsx, src/domains/core/messaging/plugs/messagingLayouts/README.md
notes: a fork with its own email channel built on createEmailChannel gets no recipient until it passes findRecipients (optional dep).
