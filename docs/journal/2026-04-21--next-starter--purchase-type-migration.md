# 2026-04-21 purchaseRequest への purchase_type 導入と下流移行手順

> owner: next-starter

導入コミット: `63e25bbb`（PurchaseRequest に purchase_type ディスクリミネータと完了戦略レジストリを導入）。現行の仕様・拡張方法は [src/features/core/purchaseRequest/README.md](../../src/features/core/purchaseRequest/README.md)「6. purchase_type と完了戦略」が正。本ファイルは当時の変更内容と、下流 fork 向けの一回限りの移行手順の記録。

## 変更内容（当時）

- 目的: ウォレット加算以外の購入（ダイレクト販売・物販・サブスク等）を purchaseRequest の決済セッション管理に乗せる。`wallet_type` 必須 = 完了処理は必ずウォレット加算、という前提をやめ、`purchase_type` が完了処理の種別を決めるようにした
- 新規 `src/config/app/purchaseType.config.ts`（`PURCHASE_TYPE_CONFIG`、ビルトインは `wallet_topup` のみ）
- `purchase_requests`: `purchase_type` 列追加（enum, NOT NULL, default `'wallet_topup'`）、`wallet_type` を nullable 化、`metadata`（JSONB）追加、`purchase_requests_purchase_type_completed_at_idx` 追加。`purchase_requests_wallet_type_completed_at_idx` は Analytics 互換のため温存
- `services/server/completion/` 新設（`registerPurchaseCompletionStrategy` + 旧ウォレット加算ロジックを移した `walletTopupStrategy`）
- `initiatePurchase`: パッケージ照合を戦略の `validateInitiation` に委譲、`purchase_type` を書き込む
- `completePurchase`: ウォレット加算を戦略の `complete()` に委譲、戻り値の `walletHistoryId` を nullable 化
- 下流影響（破壊的）: `PurchaseCompleteHookParams.walletResult.history` が `WalletHistory | null` に。`walletResult.history.id` を参照する独自フックは TypeScript エラーになる
- 当時は「`wallet_type = null` だとコールバック URL の slug が空になる」既知の制約があった。翌日 `b790af05` で `strategy.buildCallbackUrls` / `params.successUrl・cancelUrl` の 3 段階フォールバックが入り解消

## 下流 fork の移行手順（当時の想定、15〜30 分/プロジェクト）

1. 事前確認: `pnpm db:query "SELECT COUNT(*) FROM purchase_requests WHERE status = 'processing'"` が 0 件になるのを待つ
2. メンテナンスモード ON（`src/proxies/maintenance.ts` の maintenanceProxy が参照する設定）
3. upstream を取り込み `pnpm install`
4. 独自の購入完了フック（`services/server/hooks/definitions/`）があれば修正:

   ```ts
   handler: async ({ purchaseRequest, walletResult, tx }) => {
     if (purchaseRequest.purchase_type !== "wallet_topup") return;
     if (!walletResult.history) return;
     await addBonus(purchaseRequest.user_id, walletResult.history.id);
   }
   ```

5. `pnpm db:push`（`purchase_type` 追加、`wallet_type` nullable 化、インデックス追加。既存行は default で `wallet_topup` が入るためデータ移行不要）
6. デプロイ
7. スモークテスト: 通常のコイン購入 1 件を完了まで通す、残高加算、独自フック（ランクボーナス等）の動作
8. メンテナンスモード OFF

## ロールバック手順

1. デプロイを前バージョンに戻す
2. `ALTER TABLE purchase_requests ALTER COLUMN wallet_type SET NOT NULL`（`wallet_type = NULL` の行が既にあると不可。メンテナンス中のデプロイなら新規行 0 件のはず）
3. `purchase_type` 列を DROP

スモークテストで異常が出たらメンテナンスモードのまま戻せるよう、デプロイ → スモークテスト → メンテ OFF の順序を守る。
