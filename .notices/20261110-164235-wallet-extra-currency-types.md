# DOWNSTREAM NOTICE id:20261110-164235-wallet-extra-currency-types
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:quest/wayfarer | commit:- (this commit)
date: 2026-11-10T16:42:35+09:00
severity: action-required
checkpoint: wallet-extra-currency-types
fixes: 20261109-135223-config-district-wallet-a
resolves: 20261110-105102-wallet-a-notice-extra-currencies
change: wallet README / config comment state that an Extra currency keeps the type written in Extra (added fields, literal types such as isTicket: true) and show how to list currency keys; notice-writing rule: a fork's key / value lists are enumerated by a command, never counted by hand
why: 20261109-135223-config-district-wallet-a step 3 [判断] listed 4 own currencies for oripa-do while it had 5 (psa10_merge_point missing), and told forks to type Extra currencies as CurrencyConfig, which drops isTicket: true and makes ticket wallet types never; a fork that followed it may have dropped a currency or broken ticket typing
required_actions:
1. Only if your fork took 20261109-135223-config-district-wallet-a and had its own src/config/app/currency.config.ts before it (otherwise skip): list the old currency keys with `old=$(git rev-list -1 --first-parent HEAD -- src/config/app/currency.config.ts); git show "$old^1:src/config/app/currency.config.ts" | sed -n '/^export const CURRENCY_CONFIG/,/^}/s/^  \([a-z_0-9]*\): {.*/\1/p'` and the current ones with `npx tsx -e 'import("./src/features/core/wallet/config.ts").then((m) => console.log(Object.keys(m.walletConfig.currency).join("\n")))'`; every old key must be in the current list — a missing one → add it to `export type Extra` and the values in src/config/features/wallet.config.ts (and its rows in expiration / wallet.ui.config.ts currencyIcons as the old config had them).
2. If a currency in your Extra carries fork fields or literal types your code reads by type (e.g. `isTicket: true` read as `(typeof walletConfig.currency)[K] extends { isTicket: true }`), type it with them: `premium_ticket: CurrencyConfig & { isTicket: true }` instead of plain CurrencyConfig.
verify: the two lists in step 1 match (old keys ⊆ current keys) | pnpm typecheck passes | your ticket wallet type (if any) is not never
manual_steps: -
refs: src/features/core/wallet/README.md (設定ファイル), src/features/core/wallet/config.ts, src/lib/defineConfig/README.md (Extra), .notices/README.md, .claude/skills/ship/SKILL.md
notes: oripa-do: not checked here (its order 20261110-105102 reports all 5 currencies carried with the literal type). The deep Extra merge from 20261110-162319-config-extra-deep-merge keeps Extra types as written; with the old D & Extra an Extra currency type was already kept, so step 2 does not depend on that notice.
