---
paths:
  - "src/domains/core/referralReward/**"
---
# domains/referralReward
what: tracks the delivery of rewards for a completed referral (pending / fulfilled / failed); the reward itself is done by handlers | entry referralRewardService (services/server/referralRewardService.ts), definitions rewardDefinitions.ts
use: referral
change: add = a reward group in rewardGroups/ (rewardGroups) and a handler in services/server/handlers/ (rewardHandlers), both in extensionPoints.ts
rules:
using:
- reward_add_by_receptacle: rewards are added only as rewardGroups and handler items, never by editing rewardDefinitions.ts (it is the generated list's view)
- handler_amount: a handler that wants its reward summed in the admin invite-code totals returns a numeric `amount` in its result (opt-in)
- trigger_call: a new trigger is fired by referralRewardService.triggerRewards(trigger, referral, context?, tx?) where the event happens; signup_completed is already fired by the standard registration flow
editing:
- table_thin: referral_rewards only tracks delivery state; reward logic stays in handlers (service layer)
read: add a reward → Extension | service methods, table → API | delivery flow → Internals
