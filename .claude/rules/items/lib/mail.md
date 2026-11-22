---
paths:
  - "src/lib/mail/**"
  - "src/config/lib/mail.config.ts"
---
# lib/mail
what: email sending (Resend / SendGrid) via send(), MailSendError, provider webhook verify + normalize, React Email frame parts and generated colors (@/lib/mail)
use: always (provider = env MAIL_PROVIDER)
change: counterpart = src/config/lib/mail.config.ts (defaultFrom, defaultFromName) | replace = frame/MailFrame.replace.tsx (switch frame/MailFrame.tsx)
rules:
using:
- via_messaging: mail to users goes through messagingService; send() is called only by the email channel item and system mail outside messaging (CLAUDE.md PROHIBITED)
- retry_by_kind: MailSendError kind transient → retry later | permanent → never retry | unknown → retry only with idempotencyKey
- sendgrid_dedupe: SendGrid drops idempotencyKey → the resender prevents duplicates itself
- raw_body: verify webhook signatures on the raw body, never on re-serialized JSON
- frame_parts: templates are built from the frame parts, never by copying styles
- generated_colors: generated/themeColors.ts is pnpm generate styles output, never hand-edited, read via @/lib/mail | changed colors → regenerate and commit | mail colors go in palette.css :root
editing:
- no_context: no React context in the lib (server module, Next build breaks)
- no_env: webhook code never reads env; secrets and keys come as arguments
- theme_required: parts keep theme a required prop (render swallows errors)
read: setup, webhook, compose → Usage | send, errors, events, parts → API | provider switch → Extension | tests → Verification
