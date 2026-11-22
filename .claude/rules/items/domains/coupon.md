---
paths:
  - "src/domains/core/coupon/**"
  - "src/config/domains/coupon.config.ts"
---
# domains/coupon
what: coupon codes: issue, limits, validity, redeem and history; effects live in consumer handlers by category | entry couponService (services/server/couponService), hooks in hooks/
use: coupon
change: add = an admin section tab in adminSectionTabs/ (sectionTabs, extensionPoints.ts) | counterpart = src/config/domains/coupon.config.ts
rules:
using:
- entry_scope_const: a new code-accepting entry puts its own scope const in the consumer domain's constants and passes it to both isUsable and redeem
- skip_redeemer_preview: skipRedeemerChecks only for the pre-login isUsable preview (redeem types refuse it)
- effect_in_handler: an effect lives in the consumer's handler; category = the handler key, parameters in coupon.settings by settingsFields
- handler_gated: a consumer the gate can close registers through a function init.ts calls only when gate.enabled(<its feature>)
- on_redeemed_tx: onRedeemed uses context.tx; to run with or without a tx use runWithTransaction(context.tx, ...)
- self_redeem_core: self-redeem of attribution coupons is rejected in core, never re-checked by a consumer
- reason_messages: reason messages only from constants/redeemReasonMessages.ts
- reward_recipient: recipients get CouponAttributionRewardForRecipient, never the redeemer's type
- admin_tabs_built: admin coupon tabs via buildCouponAdminSectionTabs + its sectionTabs receptacle, never hardcoded
- self_redeem_no_optout: no per-consumer re-implementation; a business needing self-redeem proposes a settings-key opt-out to Tier1
- tab_enabled: close a section tab by `enabled` (client-readable values only, no hooks), never className "hidden"
- tabs_by_screen: AdminCouponList / AdminInviteList render no tabs; a Screen using them places AdminCouponSectionTabs (@/domains/core/coupon/components/AdminCouponSectionTabs)
- admin_list_no_copy: add list columns by createAdminCouponListColumns + useAdminCouponListTable, never copy the Table
editing:
- reason_add: a new reason updates both UsabilityReason and COUPON_REDEEM_REASON_MESSAGES
- config_no_switch: the feature on/off stays in the gate rule, never in coupon config
read: check or redeem → Usage | handlers and new categories → Extension | admin tabs, list, config → Extension | methods, tables, reasons, routes → API | handler system, self-redeem guard → Internals
