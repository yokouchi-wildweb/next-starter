---
paths:
  - "src/domains/core/bankTransferReview/**"
---
# domains/bankTransferReview
what: the self-report and admin review of in-house bank transfers (inhouse provider, no webhook) | entry @/domains/core/bankTransferReview, admin hooks @/domains/core/bankTransferReview/hooks/<name>
use: bankTransferReview (dependsOn payment; open only while payment method bank_transfer_inhouse is selectable)
change: counterpart → src/config/domains/purchaseRequest.config.ts (payment.paymentMethods bank_transfer_inhouse status, payment.bankTransfer autoComplete / account, payment.providers.inhouse) | add → items in your own domain's plugs/adminBulkActions/ (<name>.override.ts = enabled, order)
rules:
using:
- account_production: payment.bankTransfer.account ships sample values → set the business's real account before a production release
- admin_ui_hooks: admin parts call the public hooks, never the client functions | a fork changing the admin look writes its own _components/ Screen over those hooks, never adds args to or copies the upstream _screen parts
- bulk_action_items: list bulk actions = items in plugs/adminBulkActions/ | upstream items are removed or reordered only by <name>.override.ts | `access` only shows / hides (authz = the API) | `onDone` only on success
- shared_values: status slugs and presenters come from @/domains/core/bankTransferReview, not the _screen re-exports
editing:
- review_mode_fixed: a review's mode is fixed at creation | never re-read autoComplete for an existing review
- review_audit_tx: a review status update and its audit record share one transaction
- review_keys_limits: admin SWR keys only in hooks/adminBankTransferReviewKeys.ts | input limits only in constants/limits.ts, parts read the same values | the general rule = core/client.md swr_keys
read: enable, flows, screens, operations → Usage | data, HTTP, hooks → src/domains/core/bankTransferReview/API.md API | config keys, bulk actions → Extension | states, proof image guard, audit → Internals | tests → Verification
