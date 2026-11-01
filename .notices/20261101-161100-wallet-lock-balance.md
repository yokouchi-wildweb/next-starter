# DOWNSTREAM NOTICE id:20261101-161100-wallet-lock-balance
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:9fdfd83c
date: 2026-11-01T16:11:00+09:00
severity: action-required
checkpoint: -
resolves: 20261101-133024-fix-wallet-lock-balance
change: debitBalance always reads the wallet FOR UPDATE when none is passed | reserveBalance and consumeReservedBalance accept options.wallet (caller holds the row lock in the same tx) | WalletOperationOptions gains wallet?, GetWalletOptions omits it | getOrCreateWallet reports FK 23503 as a write error
why: debit of a non-expiring currency read without a lock and could lose a concurrent update; every currency now takes a row lock, so a fork debiting several wallets in one tx can deadlock if its order varies
required_actions:
1. git grep -n "debitBalance" -- src outside src/features/core/; where one tx debits 2+ wallets, take them in a fixed order (e.g. sorted by walletType)
2. a fork passing options.wallet must have read that row with lock:true in the same tx; an unlocked value brings the lost update back (not checked at runtime)
3. a fork carrying its own copy of these edits under a permit naming this order: drop the copy and take upstream's version
verify: `pnpm typecheck` passes
manual_steps: -
refs: src/features/core/wallet/services/server/wrappers/debitBalance.ts, src/features/core/wallet/services/server/wrappers/reserveBalance.ts, src/features/core/wallet/services/server/wrappers/consumeReservedBalance.ts, src/features/core/wallet/services/types.ts, src/features/core/wallet/README.md
notes: checkpoint - because the body commits of this bundle all precede these notices, so the code of the next 5 notices is merged with this one; the last notice of the bundle is the checkpoint. Also covers item 1 of 20261029-221452-upstream-fix-correctness, resolved by that bundle's last notice. oripa-do reverted its reserve / consume / utils / types edits in 39b93fad2 and kept debitBalance. No concurrency run, no test covers these wrappers. Other forks not checked.
