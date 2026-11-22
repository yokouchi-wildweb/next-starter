---
paths:
  - "src/domains/core/referral/**"
---
# domains/referral
what: the inviter → invitee relation made when a new user signs up with an invite code (a coupon of type invite); referralService, /api/referral/**, the mypage InviteCode container and the admin invite list. Rewards live in referralReward
use: referral (requires coupon)
change: none → /order <direct parent> (rewards: referralReward receptacles)
rules:
using:
- ref_invite_scope: every entry that accepts an invite code passes INVITE_CODE_REDEEM_SCOPE (constants/inviteCodeScope.ts) to the coupon calls
- ref_admin_columns: extra admin list columns = createAdminInviteListColumns + useAdminInviteListTable, never a copied Table
- ref_benefits: the benefits text changes by copying the /mypage/invite Screen into _components/ and passing `benefits`
editing:
- ref_signup_nonblocking: an invite code failure never blocks signup (warn log, inviteCode.applied=false)
- ref_validate_no_reason: validate-invite-code returns only valid / message, never the reason or coupon data (no enumeration)
- ref_link_gate: the invite link cookie (pending_invite) is gated by referral alone, independent of userAcquisition
- ref_stats_one_place: inviter stat formulas live only in wrappers/inviterStatsAggregation.ts
read: screens, admin columns, invite links → Usage | service, routes, hooks, data → API | signup flow, coupon relation → Internals
