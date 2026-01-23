# クーポン / クーポン履歴ドメイン README

クーポン発行・管理・使用記録（coupon / couponHistory）の実装概要と利用方法をまとめる。管理画面 CRUD、招待コード発行、使用可否判定・使用処理、履歴記録のすべてをカバーする。

---

## ゴールと範囲
- 管理者向けクーポン CRUD（一覧/作成/編集/複製/削除/復元/ハード削除）
- 招待コード・アフィリエイトコードの発行と取得（サーバーサービス経由）
- 使用可否判定 (`/api/coupon/check-usability`) と使用処理 (`/api/coupon/redeem`)
- 使用履歴の記録と参照（couponHistory）
- クライアントサービス / フック / API ルートの把握と活用方法

---

## データモデル
### Coupon（`coupons`）
- フィールド（主要）  
  - `code`(unique, soft delete考慮) / `type`=`official|affiliate|invite` / `status`=`active|inactive`
  - `name`, `description`, `image_url`, `admin_label`, `admin_note`
  - 期間制限: `valid_from`, `valid_until`
  - 使用制限: `max_total_uses`, `max_uses_per_redeemer`, `current_total_uses`(DB デフォルト 0・サーバー管理のみ)
  - 所有者: `attribution_user_id` (invite/affiliate 用オーナー、FK 無し)
  - `createdAt`, `updatedAt`, `deletedAt` (soft delete)
- Drizzle 定義: `entities/drizzle.ts`  
  Zod: `entities/schema.ts`（`current_total_uses` はスキーマ外。DB/サーバーのみで更新）

### CouponHistory（`coupon_histories`）
- フィールド  
  - `coupon_id`(FK なし) / `redeemer_user_id`(nullable) / `metadata`(JSON スナップショット) / `createdAt`  
  - `useUpdatedAt` = false, soft delete 無し。更新・削除の運用は想定せずログ扱い。
- スナップショット構造（`types/metadata.ts`）  
  - `code`, `type`, `name`, `attribution_user_id`, `current_total_uses_after` + 任意の追加メタデータ

---

## サーバーサービス / API
### couponService（`services/server/couponService.ts`）
- ベース CRUD: `base`（soft delete, search, upsert など標準機能）
- 副作用付き CRUD
  - `duplicate(id)`: コード再生成 + `current_total_uses=0` リセット + ストレージ複製
  - `remove(id)`: ストレージ連携付き削除（soft delete）
- 使用系
  - `isUsable(code, redeemerUserId?)`: 可否判定のみ
  - `redeem(code, redeemerUserId?, additionalMetadata?)`: トランザクションで SELECT FOR UPDATE → 静的バリデーション → per-user 使用回数確認 → `current_total_uses` インクリメント → `recordUsage`
  - `getUsageCount(couponId, redeemerUserId)`
  - `getCouponByCode` / `getCouponById` / `validateCouponStatically`
- オーナーシップ系（invite/affiliate 用）
  - `issueCodeForOwner(params)`: 衝突時リトライ付き発行。`type` は `invite` or `affiliate`
  - `getCodesByOwner(params)`
  - `getInviteCode(userId)` / `getOrCreateInviteCode(userId)`

### couponHistoryService（`services/server/couponHistoryService.ts`）
- ベース CRUD のみ（soft delete 無し）。  
- `recordUsage(params)`: 使用時にスナップショットを metadata へ格納して insert（`redeemer_user_id` は nullable）。

### API ルート
- 汎用 CRUD: `/api/coupon`（`[domain]` ルート経由）、`/api/couponHistory`
- 使用関連:  
  - `POST /api/coupon/check-usability` … 可否判定（セッション任意。ゲストは user_id_required で弾かれるケースあり）  
  - `POST /api/coupon/redeem` … 使用処理（成功時 history 返却、失敗時 400 JSON）  
- 招待コード:  
  - `GET /api/coupon/my-invite` … 取得のみ  
  - `POST /api/coupon/my-invite` … 未発行なら発行して返却  

---

## クライアントサービス / フック
### クーポン
- CRUD クライアント: `services/client/couponClient.ts`（ベース CRUD）  
- 使用系クライアント: `services/client/redemption.ts`（`redeemCoupon`, `checkCouponUsability`）  
- 招待コードクライアント: `services/client/inviteCode.ts`（`getMyInviteCode`, `issueMyInviteCode`）
- フック（主なもの）
  - CRUD: `useCreateCoupon` / `useUpdateCoupon` / `useDeleteCoupon` / `useRestoreCoupon` / `useHardDeleteCoupon` / `useDuplicateCoupon` / `useCoupon` / `useCouponList` / `useSearchCoupon`
  - 使用判定: `useCheckCouponUsability`（手動） / `useCheckCouponUsabilityAuto`（コード変更で自動実行）
  - 使用 UI: `useCouponViewModal` はプレースホルダー。表示ロジックを実装してから `CouponDetailModal` を活用する。
  - 招待コード: `useMyInviteCode`（SWR 取得） / `useIssueMyInviteCode`（発行してキャッシュ更新）

### クーポン履歴
- クライアント: `services/client/couponHistoryClient.ts`（CRUD）
- フック: `useCouponHistory`, `useCouponHistoryList`, `useSearchCouponHistory`, `useCreateCouponHistory`, `useUpsertCouponHistory`, `useUpdateCouponHistory`, `useDeleteCouponHistory`  
  - 運用上は「ログは追加のみ」が前提。更新/削除フックは利用しない想定。

---

## 管理画面実装メモ
- 一覧/作成/編集: `src/app/admin/(protected)/coupons/*`。`AdminCouponList` は検索・ページネーション付き。`Duplicate`/`Delete` ボタンあり（soft delete）。  
- 作成/編集フォーム: `CreateCouponForm` / `EditCouponForm`（`CouponForm` 基盤）。コード自動生成ボタン付き。管理画面では `type` を `official` のみに限定（`fieldPatches`）。
- 詳細モーダル: `CouponDetailModal` は `useCouponViewModal` の viewModel 未実装。利用する場合は viewModel を作り込む。
- couponHistory の管理画面は未提供（domain config も adminRoutes なし）。

---

## 初期設計メモ（`.tmpref/coupon-domain-design.md`）からの主な差分
- `redeemer_user_id` は nullable / optional（必須ではない）
- クーポン使用履歴は不変運用だが、汎用 CRUD ルートとフックは生成済み（実運用では `recordUsage` のみに限定推奨）
- `current_total_uses` は Zod スキーマ外・フォーム非表示。DB/サーバーでのみ更新
- 管理画面では `type`=official 固定。`invite`/`affiliate` はサーバーの発行ヘルパー経由で作成する
- `useCouponViewModal` はプレースホルダー。実装が必要
- presenters（couponHistory）は `redeemer_id` を参照しており、`redeemer_user_id` と齟齬があるため表示用途で使う場合は修正が必要

---

## 参考ファイル
- データモデル: `entities/drizzle.ts`, `entities/schema.ts`, `entities/model.ts`, `entities/form.ts`
- サーバーサービス: `services/server/*`（`redemption/`, `ownership/`, `wrappers/`）
- クライアント/フック: `services/client/*`, `hooks/*`
- API ルート: `src/app/api/coupon/*`, `src/app/api/coupon/my-invite`, `src/app/api/coupon/check-usability`, `src/app/api/coupon/redeem`
