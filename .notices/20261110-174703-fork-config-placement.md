# DOWNSTREAM NOTICE id:20261110-174703-fork-config-placement
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:legate/20261023-175358-config-redesign.1 | commit:- (this commit)
date: 2026-11-10T17:47:03+09:00
severity: action-required
checkpoint: config-fork-placement
change: placement of the keys and files forks added to the old src/config/app/ and src/config/ui/ (announced as "place it at the closing step" in notice 20261109-143705-config-district-user step 4) | rules now in src/config/README.md「移行中のもの」: a screen / API on-off → a fork gate rule (defaultEnabled, pathPatterns; env-driven on-off in the rule's enabled()) + featureGate/switches.config.ts (D92); a fork business value → its domain's config.ts + features/<domain>.config.ts; a fork key on an upstream owner → that override's Extra (frame values: layout/<frame>.config.ts Extra; hiding a frame part = the slot null); a key that only hides an upstream function → close the feature or use the upstream key | pnpm test no longer passes FEATURE_GATE_OPEN to the test processes (tests build open / closed with rule values and overrideSwitches)
why: these values sit in the old places that the config closing step 2 will delete (src/config/app, src/config/ui); moving them to their owners keeps the fork building when the old files go
required_actions:
1. Merge upstream up to this checkpoint. Move each item below for your fork, update its readers, delete the old key / file when it is empty, then `pnpm typecheck`, `pnpm check config-overrides`, `pnpm test`.
2. [判断] boardgame-site:
   - src/config/app/catalog.config.ts (CATALOG_CONFIG) → src/features/catalog/config.ts (+ src/config/features/catalog.config.ts override); readers in src/features/catalog
   - src/config/app/guest-room.config.ts (GUEST_ROOM_CONFIG) → src/features/guestRoom/config.ts (+ override); readers in app/(user)/.../guest-room* and api/guest-room
   - src/config/app/line-bot.config.ts (LINE_BOT_DISPLAY_NAME, LINE_BOT_FRIEND_ADD_URL) → the domain behind the LINE bot (src/features/lineGroupSubmission/config.ts); reader app/(user)/(public)/line-bot
   - src/config/app/line-login.config.ts, x-login.config.ts (LINE_LOGIN_ENABLED / X_LOGIN_ENABLED from env) → write the env read in the fork rules src/featureGate/rules/lineLogin.ts / xLogin.ts enabled(), delete the files
   - src/config/app/marketplace.config.ts (MARKETPLACE_ENABLED from NEXT_PUBLIC env, read by collection UI and api/collection-public) → a fork gate rule marketplace (enabled() reads the env; readers use gate.enabled / useGate().enabled("marketplace"))
   - APP_FEATURES.collection.forSale (message button) → src/features/collection/config.ts (processing value, not a gate)
   - APP_FEATURES.auth.oauthFlow → src/config/features/auth.config.ts Extra (if already there: delete the old key only)
   - src/config/documents/legalDisplay.config.ts (legalEnactedAtFormat) → src/config/features/legal.config.ts key enactedAtFormat (D23)
   - src/config/ui/user-header.config.ts HEADER_BACK_BUTTON_ENABLED / HEADER_BACK_FALLBACK_PARENTS / HEADER_BACK_ROOT_PATHS → src/config/layout/user.config.ts Extra (read by the fork's Header/BackButton)
3. [判断] oripa-do:
   - src/config/app/custom.config.ts: line.enabled / x.enabled → fork gate rules for /mypage/line and /mypage/x (switches.config.ts values); secretShop.enabled / chronoSupport.enabled → defaultEnabled of the existing fork rules secretShop / chronoSupport (fork values in switches.config.ts); secretShop.secretMenuEnabled → the secretShop domain's config.ts (no domain → keep it in the rule file's domain or a table-less fork domain)
   - src/config/app/gacha.config.ts (shipping, experimentMode, rank) → a fork domain config by reader (rank → the rank owner; shipping → the shipping owner; no single owner → a table-less fork domain "gacha" with config.ts + src/config/features/gacha.config.ts)
   - APP_FEATURES.marketing.friendCoupon.enabled → a fork gate rule friendCoupon (paths /mypage/friend-coupon and its API; friendCouponAdmin dependsOn it) + switches.config.ts (lineage.md's friendCoupon on/off then names the rule)
   - APP_FEATURES.support.inquiry.enabled → a fork gate rule inquiry (/mypage/inquiry); support.opinionBox.enabled → a fork gate rule opinionBox (no paths; the entry button reads useGate)
   - getPaymentMethodBonus: already in src/features/paymentMethodBonus → nothing to do
4. [判断] TriQ: APP_FEATURES.marketing.showInAdminMenu: false → delete the key; the marketing category (notifications, notification templates, coupons) is not drawn while coupon / notification / notificationBroadcast stay closed (upstream default since notice 20261110-173039-tier1-close-addons, an empty category is never drawn). Opening one of them later shows the category.
5. [判断] next-vnx: src/config/ui/user-header.config.ts HEADER_ENABLED = false → pass header={null} in the user frame (its 1-line switch target / UserLayout.replace), delete the constant; useHeaderData no longer reads it.
6. 88-base: nothing in this list.
verify: git grep -n "config/app/\(catalog\|guest-room\|line-bot\|line-login\|x-login\|marketplace\|custom\|gacha\)\|showInAdminMenu\|HEADER_ENABLED\|HEADER_BACK_" -- src prints nothing | pnpm ops features list shows the new fork rules with the same open / closed as before
manual_steps: -
refs: src/config/README.md「移行中のもの」, src/featureGate/README.md, notice 20261109-143705-config-district-user, council 20261023-175358-config-redesign decisions D92 D23 L1.52, legate:l1 order 54
notes: upstream code is unchanged except docs and the test runner; a fork may do the moves in any order inside this segment. New fork gate rules need `pnpm generate extensions`.
