---
paths:
  - "src/domains/core/purchaseRequest/**"
  - "src/config/domains/purchaseRequest.config.ts"
  - "src/**/plugs/{purchaseRequestCompleteHooks,purchaseRequestCompletionStrategies}/**"
---
# domains/purchaseRequest
what: external-payment purchases (purchase_requests): sessions, transitions, double-purchase guards | fulfilment = a strategy per purchase_type (built-in wallet_topup)
use: payment
change: counterpart = src/config/domains/purchaseRequest.config.ts (payment, purchaseType) | add = purchaseRequestCompletionStrategies, purchaseRequestCompleteHooks (<domain>/plugs/<point>/) | replace = payment/sessionEnricher.ts
rules:
using:
- new_type: purchase_type = config purchaseType + a strategy item + pnpm generate extensions + db:push
- null_wallet_urls: a type with wallet_type null implements buildCallbackUrls
- strategy_hooks: onFail / onExpire are idempotent, onFail never throws
- metadata: validate it yourself (core does not) | not the bankTransferImageJudgment key | FK / search / aggregate axes → a side table
- wallet_hook: a wallet-only post hook returns early unless purchase_type is wallet_topup
- polling_values: usePurchaseStatusPolling takes paths, never functions or parts
- prod_log: payment.debugLog stays false in production (PII)
editing:
- transitions: allowed transitions only in ALLOWED_TRANSITIONS | status-only moves via transitionStatus()
- grant_paths: balances move only in completePurchase (webhook, polling, confirm API)
- fatal_failure: an error a retry cannot fix → markAsFatalFailure before throwing
- amounts: server-authoritative (package, ≤ 0, paidAmount checks) | validateInitiation re-runs on reuse-pending
- user_scope: idempotency lookups always by user_id
- provider_contract: differences stay in PaymentProvider (no name branches) | createSession idempotent | unmapped method → throw | timingSafeEqual | no secrets in client_sdk config
read: model, transitions → Overview | screens, new type → Usage | columns, hooks → API | config, receptacles → Extension | flows, guards → Internals | providers → src/domains/core/purchaseRequest/services/server/payment/README.md Usage
