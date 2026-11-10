# DOWNSTREAM NOTICE id:20261110-185623-messaging-lib-foundation
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-10T18:56:23+09:00
severity: info
checkpoint: messaging-lib-foundation
change: messaging rebuild step S1 (lib foundation, additive): lib/mail send() returns { provider, providerMessageId }, takes headers and idempotencyKey (Resend only), throws MailSendError (kind transient / permanent / unknown, message text unchanged) | lib/mail webhooks: verify + normalize for Resend (Svix) and SendGrid (ECDSA) into MailWebhookEvent | lib/mail frame: MailFrame and parts (theme prop, createMailParts) | new closed lib src/lib/messaging: defineMessage / MessageContent / MessageOverride / validateMessageDefinition / ChannelError, override point messages (src/features/**/messages/<name>.override.ts, export const messageOverride) with the required-message guard in pnpm check extensions, generated src/registry/messageRegistry.ts (empty), receptacle item types | messaging receptacles channels / enrichers / categories / audiences / sources / subscribers (empty lists) | lib/structuredDocument listVariables, wallet expiration notices use replaceVariables (same text)
why: forks get the new entries early; nothing reads the definitions or receptacles yet and every current sender behaves as before
required_actions: none
verify: pnpm typecheck && pnpm check extensions && pnpm check registry
manual_steps: -
refs: src/lib/mail/README.md, src/lib/messaging/README.md, src/features/core/messaging/README.md「受け口」, commits 2233f582b 1472de253 d78665c50 50f9c3c88 ecd672116 3942f315c 646ec6dff 5ba17efce 68be97735, council 20261108-120538-system-messaging-templates legate:l2 sheet 01
notes: next step S2 rebuilds messaging as the one messaging domain (notification and notificationTemplate folded in, core/mail and createMailTemplate removed, upstream messages become messages/<name>.ts definitions) as a breaking notice with a codemod; until then do not put items in the messaging receptacles or messages/ definitions (no reader yet) | using send()'s return value and MailSendError now is fine | fork-local senders that copy lib/mail can keep running until S2 says how to move
