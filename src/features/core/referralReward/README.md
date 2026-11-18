# 紹介報酬（referralReward）ドメイン

## Overview

- 紹介成立時の報酬配布を管理する。テーブルは「配布済み/未配布」の状態追跡のみを担い、報酬の具体的な中身（ポイント付与、クーポン発行等）はハンドラーに委ねる
- ベースリポジトリは拡張基盤のみ提供（報酬グループ・ハンドラーの項目は 0）。下流プロジェクトが報酬グループとハンドラーを受け口に足して使う
- 機能の入切は門番の規則 `referral`（`src/featureGate/rules/referral.ts`）
- 決まり（足し方・amount の規約・トリガーの呼び方・テーブルの役目）は札 `.claude/rules/items/features/referralReward.md`。この README は使い方と仕組み

## API

`referralRewardService`（`services/server/referralRewardService.ts`）:

- `base`: ベース CRUD
- `fulfillReward(params)`: 個別報酬の配布実行。冪等（配布済みならスキップ）。ハンドラー呼び出し → status 更新 → metadata 記録。失敗時は status=failed で記録
- `triggerRewards(trigger, referral, context?, tx?)`: トリガー名で該当する全報酬を一括実行。報酬定義から reward_key を取得し、各ハンドラーを実行。`context` でイベント固有の情報（購入金額等）をハンドラーに渡せる
- `isFulfilled(referralId, rewardKey, tx?)`: 特定報酬の配布済み判定
- `getByReferral(referralId, tx?)`: referral に紐づく報酬一覧

報酬定義（`rewardDefinitions.ts`）:

- `REFERRAL_REWARD_DEFINITIONS`: 一覧 `extensions/rewardGroups` そのもの（key = グループキー）
- 2 階層: グループ（表示単位） > 個別報酬（`reward_key` → `{ label, trigger, recipientRole }`）。管理画面ではグループ単位でバッジ表示し、同一シナリオの inviter / invitee 報酬をまとめる
- `getRewardDefinition(rewardKey)`: reward_key からフラットな定義を取得(`utils/rewardDefinitionLookup.ts`)
- `getRewardGroupKey(rewardKey)`: reward_key が属するグループキーを取得(`utils/rewardDefinitionLookup.ts`)
- `getRewardKeysByTrigger(trigger)`: トリガー名から該当 reward_key の一覧を取得(`services/server/wrappers/getRewardKeysByTrigger.ts`)

ハンドラーの読み手（`services/server/rewardHandlerRegistry.ts`）:

- `getRewardHandler(key)` / `hasRewardHandler(key)`
- ハンドラーの型: `(params: { referral, rewardKey, recipientUserId, context?, tx? }) => Promise<Record<string, unknown>>`。返り値は `referral_rewards.metadata` に保存される
- 返り値の `amount`（数値）は報酬金額として、管理画面の招待コード一覧集計（referral の `getInviteCodeListWithCounts` → `totalRewardAmount` / `grandTotalRewardAmount`）に合算される。含めなければ集計 0 のまま。数値として解釈できない値は 0 扱い（SQL エラーにはならない）

`referral_rewards`:

- `referral_id`(uuid) / `reward_key`(string) / `recipient_user_id`(uuid。referral からも辿れるが、クエリ利便性のため冗長に保持)
- `status`: `pending` | `fulfilled` | `failed`（既定 pending）
- `fulfilled_at`: 配布完了日時（nullable）
- `metadata`: jsonb（ハンドラー実行結果の記録用、nullable）
- ユニーク制約: `(referral_id, reward_key)`（同一紹介 × 同一報酬の重複防止）
- soft delete 無し / `createdAt`, `updatedAt` あり

## Extension

下流での報酬の足し方:

1. 報酬グループ: `rewardGroups/<名前>.ts` に `export const group: ReferralRewardGroupItem`（`key`・`label`・`rewards`）

```ts
export const group: ReferralRewardGroupItem = {
  key: "signup_bonus",
  label: "登録完了ボーナス",
  rewards: {
    signup_inviter_bonus: { label: "招待者：登録完了ボーナス", trigger: "signup_completed", recipientRole: "inviter" },
    signup_invitee_welcome: { label: "被招待者：ウェルカムボーナス", trigger: "signup_completed", recipientRole: "invitee" },
  },
};
```

2. ハンドラー: `services/server/handlers/<名前>.ts` に `export const handler: RewardHandlerItem`（`rewardKey`・`handler`）
3. `pnpm generate extensions` で一覧を作る（ハンドラーは一覧から読まれるので別途 import しない）
4. トリガー: 任意のタイミングで `referralRewardService.triggerRewards("trigger_name", referral, context?, tx?)` を呼ぶ

## Internals

- サインアップ時の `triggerRewards("signup_completed", referral)` はベースリポジトリの登録フロー内で呼ばれている。ハンドラーが未登録の報酬はスキップされる
- status の 3 値（pending / fulfilled / failed）は、承認フローや非同期処理にも対応できる形

## Related

- 紹介本体: `src/features/core/referral/README.md`
