# 紹介報酬（referralReward）ドメイン README

紹介成立時の報酬配布を管理する。テーブルは「配布済み/未配布」の状態追跡のみを担い、報酬の具体的な中身（ポイント付与、クーポン発行等）はハンドラーに委ねる。

ベースリポジトリでは拡張基盤のみ提供。下流プロジェクトで報酬定義とハンドラーを追加して利用する。

---

## データモデル

### ReferralReward（`referral_rewards`）
- `referral_id`(uuid) / `reward_key`(string) / `recipient_user_id`(uuid)
- `status`: `pending` | `fulfilled` | `failed`（デフォルト: pending）
- `fulfilled_at`: 配布完了日時（nullable）
- `metadata`: jsonb（ハンドラー実行結果の記録用、nullable）
- ユニーク制約: `(referral_id, reward_key)`（同一紹介 × 同一報酬の重複防止）
- soft delete: 無し / `createdAt`, `updatedAt` あり

---

## サーバーサービス

### referralRewardService（`services/server/referralRewardService.ts`）

**ベース CRUD**: `base`

**カスタムメソッド**:
- `fulfillReward(params)`: 個別報酬の配布実行。冪等（配布済みならスキップ）。ハンドラー呼び出し → status 更新 → metadata 記録。失敗時は status=failed で記録
- `triggerRewards(trigger, referral, context?, tx?)`: トリガー名で該当する全報酬を一括実行。`config.ts` の定義から reward_key を取得し、各ハンドラーを実行。`context` でイベント固有の情報（購入金額等）をハンドラーに渡せる
- `isFulfilled(referralId, rewardKey, tx?)`: 特定報酬の配布済み判定
- `getByReferral(referralId, tx?)`: referral に紐づく報酬一覧

---

## 拡張基盤

### 報酬定義（`config.ts`）

```ts
export const REFERRAL_REWARD_DEFINITIONS: Record<string, ReferralRewardGroup> = {
  // 下流プロジェクトで追加:
  // signup_bonus: {
  //   label: "登録完了ボーナス",
  //   rewards: {
  //     signup_inviter_bonus: {
  //       label: "招待者：登録完了ボーナス",
  //       trigger: "signup_completed",
  //       recipientRole: "inviter",
  //     },
  //     signup_invitee_welcome: {
  //       label: "被招待者：ウェルカムボーナス",
  //       trigger: "signup_completed",
  //       recipientRole: "invitee",
  //     },
  //   },
  // },
};
```

2階層構造: グループ（表示単位） > 個別報酬（`reward_key` → `{ label, trigger, recipientRole }`）。
管理画面ではグループ単位でバッジ表示し、同一シナリオの inviter/invitee 報酬をまとめる。

ユーティリティ:
- `getRewardDefinition(rewardKey)`: reward_key からフラットな定義を取得
- `getRewardGroupKey(rewardKey)`: reward_key が属するグループキーを取得

### ハンドラーレジストリ（`services/server/rewardHandlerRegistry.ts`）

- `registerRewardHandler(key, handler)`: ハンドラー登録
- `getRewardHandler(key)`: ハンドラー取得
- `hasRewardHandler(key)`: 登録確認

ハンドラーの型: `(params: { referral, rewardKey, recipientUserId, context?, tx? }) => Promise<Record<string, unknown>>`
返り値は metadata として referral_rewards.metadata に保存される。

### ヘルパー

- `getRewardKeysByTrigger(trigger)`: トリガー名から該当 reward_key の一覧を取得

---

## 下流プロジェクトでの実装手順

1. **報酬グループ・定義を追加**: `config.ts` の `REFERRAL_REWARD_DEFINITIONS` にグループとその中の報酬定義を追加
2. **ハンドラーを作成**: `services/server/handlers/` にハンドラーファイルを作成。ファイル内で `registerRewardHandler()` を呼んで登録
3. **ハンドラーをインポート**: `services/server/handlers/index.ts` で副作用インポート（`import "./myHandler"`）
4. **トリガー呼び出し**: 任意のタイミングで `referralRewardService.triggerRewards("trigger_name", referral, context?, tx?)` を呼ぶ

サインアップ時の `triggerRewards("signup_completed", referral)` は既にベースリポジトリの登録フロー内で呼ばれている。ハンドラーが未登録の場合はスキップされる。

`referralRewardService` をインポートすると `handlers/index.ts` が自動的に読み込まれるため、下流で別途ハンドラーのインポートを書く必要はない。

---

## 設計判断メモ

- status の3値（pending / fulfilled / failed）: 将来の承認フローや非同期処理に対応
- recipient_user_id: referral からも辿れるが、クエリ利便性のため冗長に保持
- テーブルは薄く保ち、ロジックはサービス層（ハンドラー）に集約

---

## 参考ファイル

- エンティティ: `entities/drizzle.ts`, `entities/schema.ts`, `entities/model.ts`
- サーバーサービス: `services/server/referralRewardService.ts`, `services/server/wrappers/*`
- レジストリ: `services/server/rewardHandlerRegistry.ts`
- ハンドラー置き場: `services/server/handlers/`（下流でファイル追加、`index.ts` でインポート）
- 設定: `config.ts`
