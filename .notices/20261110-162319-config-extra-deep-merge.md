# DOWNSTREAM NOTICE id:20261110-162319-config-extra-deep-merge
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:quest/wayfarer | commit:- (this commit)
date: 2026-11-10T16:23:19+09:00
severity: info
checkpoint: config-extra-deep-merge
fixes: 20261109-142403-config-district-wallet-b
resolves: 20261110-121441-config-override-extra-array-elements
change: defineConfig merges a config override's Extra type deeply into the defaults (WithExtra<D, Extra>) instead of intersecting it (D & Extra): an Extra array type replaces the default's when it widens it, so fork fields on array items (e.g. purchaseRequest payment.paymentMethods) type-check in the override and read back from the composed config; compose<Extra> returns WithExtra<D, Extra>; WithExtra is exported from @/lib/defineConfig
why: step 3 of 20261109-142403-config-district-wallet-b told forks to put fork-only payment-method fields through Extra, but with D & Extra the array became an intersection and the override failed with TS2322 (and .find()?.<field> could not be read)
required_actions: none
verify: pnpm typecheck passes | a fork with fork fields on payment methods can now write them in src/config/features/purchaseRequest.config.ts: `export type Extra = { payment: { paymentMethods: (PaymentMethodConfig & { bonus?: { rate: number; label?: string } })[] } };` + the items with bonus, `satisfies PurchaseRequestOverride<Extra>`, and read purchaseRequestConfig.payment.paymentMethods.find(...)?.bonus with types
manual_steps: -
refs: src/lib/defineConfig/types.ts, src/lib/defineConfig/README.md (section Extra), src/lib/defineConfig/defineConfig.types.test.ts, src/config/README.md
notes: types only; runtime composition unchanged; overrides without Extra have the same type as before; Extra keys stay required in the override. An Extra key that overlaps a default with a non-widening type (e.g. string → number) is now a type error (never). A fork that annotates a composed config as `XxxConfig & Extra` in its own code may switch to `WithExtra<XxxConfig, Extra>` (upstream did so in auth / user config) to read array item fields; the old annotation still compiles. oripa-do may move its payment-method bonus defaults back into the purchaseRequest override.
