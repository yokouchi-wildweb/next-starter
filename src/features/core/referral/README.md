# 紹介（リファラル）ドメイン README

既存ユーザーが招待コードを発行し、新規ユーザーがサインアップ時に入力すると紹介関係が成立する。報酬の具体的な中身はベースリポジトリでは定義せず、下流プロジェクトで実装する。

招待コードの発行・使用は **coupon ドメイン**（type=invite）を利用し、本ドメインは紹介「関係」の管理に特化する。

---

## データモデル

### Referral（`referrals`）
- `coupon_id`(uuid) / `inviter_user_id`(uuid) / `invitee_user_id`(uuid)
- `status`: `active` | `cancelled`（デフォルト: active）
- ユニーク制約: `invitee_user_id`（1ユーザーにつき1紹介元）
- soft delete: 無し / `createdAt`, `updatedAt` あり

---

## サーバーサービス

### referralService（`services/server/referralService.ts`）

**ベース CRUD**: `base`（list, get, search, create, update, remove 等）

**カスタムメソッド**:
- `createReferralFromRedemption(coupon, inviteeUserId, tx?)`: クーポン使用 → referral 作成。冪等（同一 invitee は無視）、自己招待ガード付き
- `getByInvitee(inviteeUserId, tx?)`: 被招待者の紹介元を取得（active のみ）
- `getByInviter(inviterUserId, options?, tx?)`: 招待者の紹介一覧。`{ activeOnly?: boolean }` オプション
- `getInviteCodeListWithCounts(params?)`: 管理画面用。invite型クーポン一覧 + 各発行者の紹介人数を一括集計

---

## API ルート

| エンドポイント | メソッド | 用途 |
|---|---|---|
| `/api/referral/my-referrer` | GET | ログインユーザーの紹介元を取得 |
| `/api/referral/my-referrals` | GET | ログインユーザーが招待した人の一覧 |
| `/api/admin/referral/by-inviter/[userId]` | GET | 管理者用: 指定ユーザーの紹介一覧 |

---

## クライアントサービス / フック

### ユーザー向け
- `services/client/myReferrer.ts` → `hooks/useMyReferrer.ts`: 自分の紹介元
- `services/client/myReferrals.ts` → `hooks/useMyReferrals.ts`: 自分が招待した人一覧（referrals + count）

### 管理者向け
- `services/client/referralsByInviter.ts`: 指定ユーザーの紹介一覧取得（モーダル表示用）

---

## UI コンポーネント

### ユーザー向け
- `components/common/InviteCodePage.tsx`: マイページ招待コードページ
  - 招待コード表示/発行（coupon ドメインのフックを利用）
  - コピーボタン（clipboard API）
  - 招待実績（○人招待済み）表示

### 管理画面
- `components/AdminInviteList/`: `/admin/coupons/invite` で使用
  - `index.tsx`: タブ + ヘッダー + テーブル
  - `Header.tsx`: 検索ボックス + ページネーション
  - `Table.tsx`: 招待コード / 発行者ID / 紹介人数 / ステータス / 発行日
  - `ReferralListModal.tsx`: 行クリックで紹介済みユーザー一覧をモーダル表示（API都度取得）

---

## サインアップフロー統合

- `RegistrationSchema` に `inviteCode`（optional）を追加
- Email / OAuth 両登録フォームに招待コード入力欄（`APP_FEATURES.marketing.referral.enabled` で表示制御）
- サーバー `register()` 内の処理フロー:
  1. `getCouponByCode(inviteCode)`
  2. `redeem(inviteCode, userId)`
  3. `createReferralFromRedemption(coupon, userId)`
  4. `triggerRewards("signup_completed", referral)`
- 全処理は try-catch で囲み、失敗時は warn ログのみ（登録はブロックしない）

---

## フィーチャーフラグ

`APP_FEATURES.marketing.referral.enabled`（デフォルト: `false`）

制御対象:
- 登録フォームの招待コード入力欄表示
- マイページメニューの「招待コードを取得」表示
- `/mypage/invite` ページのアクセス制御（無効時は `/mypage` にリダイレクト）
- サーバー側の招待コード処理実行

---

## coupon ドメインとの関係

- 招待コード = coupon（type=`invite`, attribution_user_id=発行者）
- コード発行: `couponService.getOrCreateInviteCode(userId)`
- コード使用: `couponService.redeem(code, userId)` → couponHistory に使用記録
- referral ドメインは redeem 後の「関係管理」を担当。couponHistory は不変ログとして役割分離

---

## 参考ファイル

- エンティティ: `entities/drizzle.ts`, `entities/schema.ts`, `entities/model.ts`
- サーバーサービス: `services/server/referralService.ts`, `services/server/wrappers/*`
- クライアント: `services/client/*`, `hooks/*`
- UI: `components/common/InviteCodePage.tsx`, `components/AdminInviteList/*`
- ページ: `app/(user)/(protected)/mypage/invite/page.tsx`, `app/admin/(protected)/coupons/invite/page.tsx`
- 設定: `config/app/app-features.config.ts`（marketing.referral.enabled）
