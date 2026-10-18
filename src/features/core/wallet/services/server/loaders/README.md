# wallet loaders — 旧パス（互換用、削除予定）

wallet 3 画面の loader は **各ルートの `_screen/loader.ts`** に移動しました（2026-10-18、notice `20261018-160000-screens-route-local-loader`）。
loader はルートの付属物なので、ドメインのフォルダではなく Screen の隣に置きます（規則: `src/lib/screens/README.md` §4）。

| 画面 | 本体 |
|---|---|
| `/wallet` | `src/app/(user)/(protected)/wallet/_screen/loader.ts`（`loadWalletIndexScreen`） |
| `/wallet/[slug]` | `src/app/(user)/(protected)/wallet/[slug]/_screen/loader.ts`（`loadWalletBalanceScreen`） |
| `/wallet/[slug]/history` | `src/app/(user)/(protected)/wallet/[slug]/history/_screen/loader.ts`（`loadWalletHistoryScreen`） |

このディレクトリの `.ts` は旧パスからの再 export だけです。**次の checkpoint 以降に削除**するので、下流は import 先をルート内の loader に変えてください（差し替え Screen からは `../_screen/loader`）。
