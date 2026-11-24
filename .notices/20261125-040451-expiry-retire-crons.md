# DOWNSTREAM NOTICE id:20261125-040451-expiry-retire-crons
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:g2/20261124-161115/junction | commit:- (this commit)
date: 2026-11-25T04:04:51+09:00
severity: action-required
checkpoint: expiry-retire-crons
change: (1) the 8 old prune crons are removed: src/app/api/cron/audit-log-prune, device-fingerprint-prune, fingerprint-challenge-access-prune, interaction-event-prune, user-daily-counter-prune, user-login-event-prune, wallet-lots-prune, paired-device-pairings-prune (their rows are deleted by the expiryRules items in /api/cron/expiry-prune since the previous segment); (2) the delete functions only they called are removed with their types: pruneExpiredAuditLogs, pruneExpiredDeviceFingerprints, pruneExpiredChallengeAccessEvents, pruneExpiredInteractionEvents, pruneExpiredUserDailyCounters, pruneExpiredUserLoginEvents (+ PruneOptions / PruneResult), pruneConsumedWalletLots (+ PruneConsumedLotsOptions / PruneConsumedLotsResult), pruneExpiredDevicePairings, and rateLimit's cleanupExpiredRateLimits; (3) Tier1's vercel.json loses the 8 entries; expiry-prune, messaging-retention, storage-sweep, expire-pending-purchases and the wallet expiration crons stay
why: a fork's own vercel.json still lists the 8 paths (they now 404) and a fork calling a removed function fails typecheck
required_actions:
1. `pnpm generate cron` (drops the 8 entries from your own vercel.json), commit it apart from the merge
2. delete any src/app/api/cron/<one of the 8>/task.override.ts still left (the expiry-move tool already wrote the matching item overrides)
3. a call to a removed function → the owner domain's expiryRules item (src/domains/core/<domain>/plugs/expiryRules/<name>.ts; switch it with <name>.override.ts) | cleanupExpiredRateLimits → the rateLimit/rateLimitsExpired item
verify: `pnpm check cron` passes | `pnpm typecheck` passes
manual_steps: -
refs: .claude/rules/items/lib/cron.md; src/lib/cron/README.md; the owner domains' README deletion sections
notes: key table: no key of CLAUDE.md / core / cards renamed or removed | moved/deleted files: the 8 cron folders, src/domains/core/<auditLog|deviceFingerprint|fingerprintChallenge|interactionTracking|userCounter|userLoginEvent>/services/server/pruning.ts, src/domains/core/wallet/services/server/lots/pruneConsumedLots.ts | a schedule set in an old task.override.ts stops working (the single expiry-prune schedule applies) | wallet/Extension.md and the cron card's pii_prune_kept now name the items only
