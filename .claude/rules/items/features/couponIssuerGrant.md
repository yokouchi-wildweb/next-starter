---
paths:
  - "src/features/core/couponIssuerGrant/**"
---
# features/couponIssuerGrant
what: the coupon issuer program: a user applies for the right to issue, an admin approves it with per-user settings, the user issues own affiliate coupons under a period policy | entry @/features/core/couponIssuerGrant, server couponIssuerGrantService (services/server), hooks useMyCouponIssuer / useCouponIssuerGrantAdmin
use: coupon (domains; default off)
change: replace → 1-line switch services/server/programConfig.ts → programConfig.replace.ts (one program: category, period, buildIssueParams, optional buildCouponPatch) | upstream ships null = issue API 503 (fail-closed)
rules:
using:
- issuer_settings_meaning: what grant.settings and application mean is the downstream's, read only inside buildIssueParams / buildCouponPatch
- issuer_stats_read_model: admin list stats and drill-downs use getGrantListWithStats and the getIssuer* functions (or their hooks), never your own SQL over grants / coupons / histories / rewards / purchases
- issuer_notify_outside: approve / reject / suspend notices to the user are the downstream's, sent after the admin route call with notificationService.sendToUserSafe (none built in)
- issuer_reward: the issuer's reward on redemption = couponAttributionReward grant() from onRedeemed
editing:
- issuer_one_per_period: issuing keeps the per-user pg_advisory_xact_lock and the in-period check incl. inactive coupons (one coupon per period)
- issuer_transitions_audited: every transition goes through base.update (CRUD audit coupon_issuer_grant.updated)
- issuer_self_shape: the user's routes never return admin_note / reviewed_by
read: program config, screen recipes, reward, notices → Usage | table, period policy, service, routes, read model → API | transitions, issuing guarantees → Internals | coupon, reward → Related
