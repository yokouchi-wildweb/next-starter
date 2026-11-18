---
paths:
  - "src/features/core/couponAttributionReward/**"
  - "src/config/features/couponAttributionReward.config.ts"
---
# features/couponAttributionReward
what: pays the attribution user of a redeemed coupon a wallet reward once per redemption and keeps the ledger coupon_attribution_rewards | server couponAttributionRewardService, client hooks/useMyAttributionRewards
use: couponAttributionReward (dependsOn wallet)
change: placement = src/config/features/couponAttributionReward.config.ts (recipientVisibleMetadataKeys) | the payout itself = a downstream coupon category handler calling grant
rules:
using:
- amount_by_handler: amount, currency and rate are decided by the downstream coupon category handler
- grant_in_redeem_tx: call grant from the handler's onRedeemed with its `tx`
- crud_no_payout: generic create / update only edit ledger rows, never pay | payouts go through grant / retry
- notify_after_commit: notify the recipient only after the tx commits, never inside grant
- recipient_metadata_keys: never register a key that leads to the redeemer's purchase (purchaseRequestId) in recipientVisibleMetadataKeys
- retry_route_downstream: upstream ships no retry route | a fork needing one builds it with createApiRoute + admin access
- no_issuance_source: never register this table as a coin issuance summary source (double count)
- no_ui_parts: the domain ships no UI parts (screens = downstream, from the hooks)
editing:
- recipient_dto_not_hidden: hide redeemer data from recipients in the DTO (toCouponAttributionRewardForRecipient), never with hiddenColumns (admin reads raw)
- grant_isolated: grant never throws on payout failure: failed row, outer tx kept
- self_attribution_guard: grant keeps the redeemer === recipient skip as a second guard behind coupon's self_redeem_forbidden
read: wire a handler, notify, my page → Usage | ledger columns, service, DTO, me API → API | metadata keys → Extension | guarantees, wallet, analytics → Internals | other domains → Related
