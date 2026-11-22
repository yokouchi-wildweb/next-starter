# referral

## Overview

- 既存ユーザーが招待コードを発行し、新規ユーザーがサインアップ時に入力すると紹介関係が成立する。報酬の中身は上流では定義せず fork が実装する(referralReward)
- 招待コードの発行・使用は coupon ドメイン(type=invite)を使い、本ドメインは紹介「関係」の管理に特化する
- 閉じられる機能: 門番の規則 `src/featureGate/rules/referral.ts`(上流の既定は閉、依存先 `coupon` = 前提 `requires: ["coupon"]`)。fork の値は `src/config/featureGate/switches.config.ts`(`pnpm ops features set referral on`)
  - 閉じると: 表 `referrals`・`referral_rewards` と `/api/referral/**`・`/api/admin/referral`・招待クーポンの管理画面 `/admin/coupons/invite` が閉じる(404)
  - 閉じたときの呼び手: 招待コードのカテゴリをクーポンに登録しない(`registerReferralCouponHandler`)・登録画面の招待コードの欄とマイページのメニュー「招待コードを取得」を描かない・サーバーの招待コードの処理をしない・紹介の集計(analytics)は 0
  - `/mypage/invite` の住所は規則 `mypageInvite`(`pageMypage` と `referral` に依存)が持つ。loader も `referral` が閉なら `/mypage` へ redirect する
- 使う時・直す時の決まりは札 .claude/rules/items/domains/referral.md にある。この README は使い方と仕組み

## Usage

### マイページの招待コード

- `components/InviteCode/index.tsx`: マイページ招待コードのセクションコンテナ(`/mypage/invite` の Screen が配置)。部品 `InviteBenefitsSection` は同ディレクトリ。特典の説明を差し替える fork は Screen を `_components/` へ複製し(`src/lib/screens/README.md`)、`<InviteCode benefits={<自分の説明 />} />` と渡す
  - 招待コード表示/発行（coupon ドメインのフックを利用）
  - コピーボタン（clipboard API）
  - 招待実績（○人招待済み）表示

### 管理画面

- `components/AdminInviteList/`: `/admin/coupons/invite` で使用
  - `index.tsx`: ヘッダー + テーブル（セクションタブは描画しない。Screen が `AdminCouponSectionTabs`(`@/domains/core/coupon/components/AdminCouponSectionTabs`)を置く。downstream の追加セクションは `coupon/adminSectionTabs/` に項目を置く）
  - `Header.tsx`: 検索ボックス + ページネーション
  - `Table.tsx`: 招待コード / 発行者ID / 紹介人数 / ステータス / 発行日（並べるだけ。列は `columns.tsx`、処理はフック）
  - `ReferralListModal.tsx`: 行クリックで紹介済みユーザー一覧をモーダル表示（API都度取得）

#### 招待コード一覧に列を足す

- 列は入口の関数とフックで足す（一般ユーザー一覧・クーポン一覧と同じ形）

- `createAdminInviteListColumns()`（`components/AdminInviteList` の入口）: 上流の列の配列を返す。呼ぶたびに新しい配列
- `useAdminInviteListTable()`（`hooks/useAdminInviteListTable.ts`）: 行のクリックで開く紹介の一覧の対象。`rowProps`（DataTable に広げる）・`modal`（`ReferralListModal` に広げる）・`selected` / `open` / `close`

```tsx
// fork の _components/InviteTable.tsx
const table = useAdminInviteListTable();
const columns = useMemo(() => [...createAdminInviteListColumns(), { header: "報酬合計", render: (i) => i.totalRewardAmount }], []);
<>
  <DataTable items={items} columns={columns} getKey={(i) => i.coupon.id} {...table.rowProps} />
  <ReferralListModal {...table.modal} />
</>
```

### 招待リンク

- **招待リンク連携**: `?invite=CODE` 付き URL を踏むと専用 cookie（`pending_invite`、httpOnly・30日・
  last-touch 優先で上書き）にコードが保持され、登録フォームの招待コード欄へプリフィルされる。
  フォーム未指定（undefined）なら本登録時にフォールバック適用、プリフィルを消して送信したら
  明示的拒否（`""`）として適用しない（手入力が常に優先）。登録完了時に cookie は削除される。
  ゲートは機能 `referral` の入切のみ（流入経路解析の記録の opt-in とは独立。
  解析も有効なら紹介流入が獲得チャンネルとしても集計される）。
  パラメータ名 `INVITE_LINK_PARAM`（`"invite"`、`lib/inviteLinkCookie.ts`）は本ドメインの物。userAcquisition は
  その名前を判別表の行（`userAcquisition/plugs/userAcquisitionChannels/invite.ts`、紹介が閉じている間は出ない）として分類と GA4 に使うだけ。
  実装: `lib/inviteLinkCookie.ts`（パラメータ名・cookie 定義）/ `plugs/proxyDecorators/inviteLink.ts`(保存、proxy の項目) /
  `GET /api/referral/pending-invite-code` + `hooks/usePendingInviteCode`(取得) /
  auth `useInviteCodePrefill`(プリフィル)。リンク生成レシピは `src/domains/core/userAcquisition/README.md`
- **ブラウザまたぎ対応（アプリ内ブラウザ → デフォルトブラウザ）**: X 等のアプリ内ブラウザで招待リンクを
  踏んだ後、認証メールを別ブラウザで開くと cookie が引き継がれない。このため認証メール送信時
  （send-email-link / send-early-registration-link）に cookie の保留コードをメールリンク URL へ
  `&invite=CODE` として埋め込み、開いた先のブラウザで proxy が cookie を焼き直す（email の別ブラウザ対策と同じ手法）。
  副次効果として紹介経由ユーザーの流入解析（source=invite）も開いた先のブラウザで復元される

## API

### データ（`referrals`）

- `coupon_id`(uuid) / `inviter_user_id`(uuid) / `invitee_user_id`(uuid)
- `status`: `active` | `cancelled`（デフォルト: active）
- ユニーク制約: `invitee_user_id`（1ユーザーにつき1紹介元）
- soft delete: 無し / `createdAt`, `updatedAt` あり

### referralService（`services/server/referralService.ts`）

**ベース CRUD**: `base`（list, get, search, create, update, delete 等）

**カスタムメソッド**:
- `validateInviteCode(code)`: 招待コードのログイン前検証(Internals「coupon ドメインとの関係」)。`{ valid: true } | { valid: false, reason }`(型 `InviteCodeValidationResult`)。`reason` はサーバーの中の診断用で、route は返さない
- `createReferralFromRedemption(coupon, inviteeUserId, tx?)`: クーポン使用 → referral 作成。冪等（同一 invitee は無視）、自己招待ガード付き
- `getByInvitee(inviteeUserId, tx?)`: 被招待者の紹介元を取得（active のみ）
- `getByInviter(inviterUserId, options?, tx?)`: 招待者の紹介一覧。`{ activeOnly?: boolean }` オプション
- `getInviteCodeListWithCounts(params?)`: 管理画面用。invite型クーポン一覧 + 各発行者の紹介人数・報酬集計（発動人数 / 合計金額 / 段階別発動数）を単一クエリで集計
  - `params.sort?: SortState`（`@/lib/tableSuite`）でサーバーサイドソート。キー: `referralCount` | `rewardedReferralCount` | `totalRewardAmount` | `stageRate{i}`（結果 `stages[i]` に対応する段階の発動率）。不明キーは既定ソート（referralCount desc, createdAt desc）にフォールバック
  - 報酬金額は `referral_rewards.metadata.amount`（数値）を集計する（オプトイン規約。詳細は referralReward README）。段階 = `REFERRAL_REWARD_DEFINITIONS` の各グループの inviter 向け reward_key（upstream は定義が空のため `stages: []` / 集計 0 で無害）
- `getStatsByInviters(userIds)`: 指定ユーザー群の招待実績を userId キーで一括取得 → `Record<userId, { referralCount, rewardedReferralCount, totalRewardAmount }>`（型 `ReferralInviterStats`）。上記一覧の 3 カラムと同一の意味論。入力は重複排除、実績のないユーザーも 0 埋めで必ずキーに含まれる。内部で 200 件ずつ分割問い合わせするため呼び出し側の件数上限なし。ユーザー一覧へ招待実績カラムを付ける用途（審査・ユーザーハブ・セグメント等）向け
  - 集計式の単一ソース: `wrappers/inviterStatsAggregation.ts`（`rewardAmountExpr` / `buildReferralCountSubquery` / `buildRewardSubquery` / `resolveRewardStages`）。両メソッドがこれを共有するため、集計定義の変更はこのファイルのみで行う

### API ルート

| エンドポイント | メソッド | 用途 |
|---|---|---|
| `/api/referral/my-referrer` | GET | ログインユーザーの紹介元を取得 |
| `/api/referral/my-referrals` | GET | ログインユーザーが招待した人の一覧 |
| `/api/referral/pending-invite-code` | GET | 招待リンク由来の保留コード（cookie）を返す（公開） |
| `/api/referral/validate-invite-code` | POST | 招待コードのログイン前検証（公開・レート制限あり）。`{ valid: true } \| { valid: false, message }` だけを返す |
| `/api/admin/referral/by-inviter/[userId]` | GET | 管理者用: 指定ユーザーの紹介一覧 |

### クライアントサービス / フック

#### ユーザー向け
- `services/client/myReferrer.ts` → `hooks/useMyReferrer.ts`: 自分の紹介元
- `services/client/myReferrals.ts` → `hooks/useMyReferrals.ts`: 自分が招待した人一覧（referrals + count）
- `services/client/validateInviteCode.ts` → `hooks/useValidateInviteCode.ts`: 招待コードの明示的検証（手動トリガー。
  coupon `useValidateCouponForCategory` と同型: `validate(code)` / `result` / `isLoading` / `error` / `reset`）。
  auth の `useInviteCodeValidation` がこれを「適用」ボタン + 適用済み状態 + 送信ブロックとしてフォームに結線する

#### 管理者向け
- `services/client/referralsByInviter.ts`: 指定ユーザーの紹介一覧取得（モーダル表示用）

## Internals

### サインアップフロー

- `RegistrationSchema` は `inviteCode`（optional）を持つ
- Email / OAuth 両登録フォームに招待コード入力欄（機能 `referral` の入切で表示制御）。
  実体は auth `components/Registration/InviteCodeField.tsx`（共用部品）
- **「適用」ボタンによる明示的検証**（購入ページのクーポン欄 wallet `CouponInput` と同じ操作モデル。入力中の自動通信はしない）:
  入力欄 + 「適用」（Enter でも可）→ `POST /api/referral/validate-invite-code` → 有効なら緑の枠に「コード + 有効な招待コードです」と「取り消す」、
  無効なら欄の下に赤文字。「取り消す」はフォーム値を `""` にする（プリフィル済みなら明示的拒否）。
  送信時、入力欄に未適用の文字が残っていれば auth `useInviteCodeValidation.assertInviteCodeSubmittable` が欄にエラーを立てて止める
  （「適用」を押すか空欄にしてもらう。通信はしない）。プリフィル値（招待リンク由来）はセット時に1回だけ自動で「適用」される
- **受理するのは招待コード（type=invite）のみ**: サーバー `register()` は `INVITE_CODE_REDEEM_SCOPE`（`constants/inviteCodeScope.ts`）を
  `redeemWithEffect` の scope に渡す。official / affiliate 等のコードが入力されても消込されず `type_mismatch` で不成立になる
  （scope 無しだと使用回数だけ消費されて紹介関係も報酬も作られない。coupon README「入口スコープ」）
- 登録レスポンスは `inviteCode: { applied, reason? } | null` を含む（null = 未指定）。登録自体は招待コードの成否でブロックしない
- サーバー `register()` 内の処理フロー:
  1. `couponService.redeemWithEffect(inviteCode, userId, { entryPoint: "registration" }, undefined, { scope: INVITE_CODE_REDEEM_SCOPE })`
     - 内部で `redeem`（検証 + 消込 + 履歴）→ referral ハンドラー `onRedeemed`
  2. ハンドラー: `createReferralFromRedemption(coupon, userId)` → `triggerRewards("signup_completed", referral)`
- 全処理は try-catch で囲み、失敗時は warn ログ + レスポンス `inviteCode.applied=false`（登録はブロックしない）

### coupon ドメインとの関係

- 招待コード = coupon（type=`invite`, category=`referral`, attribution_user_id=発行者）
- コード発行: `couponService.getOrCreateInviteCode(userId)`
- コード使用: `couponService.redeemWithEffect(code, userId, meta, tx, { scope: INVITE_CODE_REDEEM_SCOPE })` → couponHistory に使用記録
- ログイン前検証: `referralService.validateInviteCode(code)` = `isUsable(code, null, { scope: INVITE_CODE_REDEEM_SCOPE, skipRedeemerChecks: true })`
  （招待コードは `max_uses_per_redeemer=1` のため使用者無しでは `user_id_required` になる。プレビューではこの判定を省き、本登録時の消込が全判定を再実行する）
- 「何が招待コードか」（受理スコープ）は `constants/inviteCodeScope.ts` の単一定義。登録処理とログイン前検証の両方がこれを使う
- referral ドメインは redeem 後の「関係管理」を担当。couponHistory は不変ログとして役割分離

## Related

- `src/domains/core/coupon/README.md`: 招待コードの発行・消込と入口スコープ
- `src/domains/core/referralReward/README.md`: 報酬
- `src/domains/core/userAcquisition/README.md`: 招待リンクの生成レシピと流入解析
