# Coupon ドメイン

クーポンコードの発行・管理・使用を担う汎用フレームワーク。

**設計思想**: クーポンドメインは「コード・使用制限・有効期限の管理」に徹する。具体的な特典効果（割引、機能解放など）はクーポンドメイン側に定義せず、消費側ドメインがハンドラーとして自由に実装する。

---

## クイックスタート

### クーポンを検証する（サーバー）

```typescript
import { couponService } from "@/features/core/coupon/services/server/couponService";

// 基本的な使用可否チェック
const result = await couponService.isUsable("CODE123", userId);
if (result.usable) {
  // result.coupon にクーポン情報
}

// カテゴリ指定の検証（ハンドラー連携）
const result = await couponService.validateForCategory(
  "CODE123",
  "purchase_discount",  // 期待するカテゴリ
  userId,
  { paymentAmount: 2000 }  // ハンドラーに渡すメタデータ
);
if (result.valid) {
  // result.coupon, result.effect（ハンドラーが返す効果情報）
}
```

### クーポンを使用する（サーバー）

```typescript
// 基本的な使用（使用回数をカウント + 履歴記録）
const result = await couponService.redeem("CODE123", userId, {
  purchaseRequestId: "xxx",
});
if (result.success) {
  // result.history に使用履歴
}

// ハンドラー付き使用（redeem + ハンドラーの onRedeemed 実行）
const result = await couponService.redeemWithEffect("CODE123", userId, {
  purchaseRequestId: "xxx",
});
```

### クーポンを検証する（クライアント）

```typescript
// 手動トリガー
const { check, usability, isLoading } = useCheckCouponUsability();
await check("CODE123");

// 自動トリガー（デバウンス付き）
const { usability, isLoading } = useCheckCouponUsabilityAuto(code, 500);
```

---

## データモデル

### Coupon

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `id` | `string` | UUID |
| `category` | `string \| null` | 用途カテゴリ（ハンドラーと紐付く） |
| `code` | `string` | クーポンコード（ソフトデリート込みユニーク） |
| `type` | `enum` | `official` / `affiliate` / `invite`（発行元の種類） |
| `status` | `enum` | `active` / `inactive` |
| `name` | `string` | クーポン名 |
| `description` | `string \| null` | 説明文 |
| `image_url` | `string \| null` | イメージ画像URL |
| `admin_label` | `string \| null` | 管理者用ラベル |
| `admin_note` | `string \| null` | 管理者用メモ |
| `valid_from` | `Date \| null` | 有効開始日 |
| `valid_until` | `Date \| null` | 有効終了日 |
| `max_total_uses` | `number \| null` | 総使用回数上限（null=無制限） |
| `max_uses_per_redeemer` | `number \| null` | 使用者毎の上限（null=無制限） |
| `current_total_uses` | `number` | 現在の総使用回数 |
| `attribution_user_id` | `string \| null` | 帰属ユーザーID（招待/アフィリエイト用） |
| `settings` | `Record<string, unknown>` | カテゴリ固有のパラメータ（ハンドラーが定義・参照） |

**`type` と `category` の違い**:
- `type`: 発行元の種類。official=公式、affiliate=アフィリエイト、invite=ユーザー招待
- `category`: 用途・効果の分類。ハンドラーレジストリのキーと一致させる。消費側ドメインが自由に定義

### CouponHistory

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `id` | `string` | UUID |
| `coupon_id` | `string` | クーポンID |
| `redeemer_user_id` | `string \| null` | 使用者のユーザーID |
| `metadata` | `jsonb` | クーポンスナップショット + 追加メタデータ |
| `createdAt` | `Date` | 使用日時 |

`metadata` には使用時点のクーポン情報（code, type, name 等）のスナップショットと、`redeem()` 呼び出し時に渡された `additionalMetadata` がマージされる。

---

## サービスAPI

### couponService

```typescript
import { couponService } from "@/features/core/coupon/services/server/couponService";
```

#### 使用可否チェック

```typescript
// 基本チェック（DB アクセスあり、ユーザー毎の使用回数も確認）
const result = await couponService.isUsable(code, userId?);
// → { usable: true, coupon } | { usable: false, reason, coupon? }

// 静的チェック（DB アクセスなし、クーポンオブジェクトに対して実行）
const result = couponService.validateCouponStatically(coupon, userId?);
// → { valid: true } | { valid: false, reason }
```

#### 使用（redeem）

```typescript
// 基本使用（トランザクション内で SELECT FOR UPDATE → 検証 → カウント更新 → 履歴記録）
const result = await couponService.redeem(code, userId?, additionalMetadata?, tx?);
// → { success: true, history } | { success: false, reason }
```

#### カテゴリ付き検証（ハンドラー連携）

```typescript
// カテゴリ一致 + ハンドラーの validateForUse + resolveEffect を実行
const result = await couponService.validateForCategory(code, category, userId, metadata?);
// → { valid: true, coupon, effect } | { valid: false, reason, coupon? }
```

#### ハンドラー付き使用（ハンドラー連携）

```typescript
// 基本 redeem + ハンドラーの onRedeemed を実行
const result = await couponService.redeemWithEffect(code, userId, metadata?, tx?);
// → { success: true, history } | { success: false, reason }
```

#### コード発行・所有権

```typescript
// 招待コード取得（未発行なら null）
const coupon = await couponService.getInviteCode(userId, tx?);

// 招待コード取得 or 作成（冪等）
const coupon = await couponService.getOrCreateInviteCode(userId, tx?);

// 任意タイプのコード発行
const coupon = await couponService.issueCodeForOwner({
  attributionUserId: userId,
  type: "affiliate",
  category: "purchase_discount",
  name: "アフィリエイトコード",
  maxTotalUses: 100,
});

// オーナーのコード一覧
const coupons = await couponService.getCodesByOwner({
  attributionUserId: userId,
  type: "invite",
});
```

#### CRUD

標準の CRUD 操作（`create`, `get`, `list`, `search`, `update`, `remove`, `restore`, `hardDelete`, `duplicate`, `upsert`）も利用可能。

---

## ハンドラーシステム

### 概念

```
クーポンドメイン                    消費側ドメイン
┌──────────────────┐              ┌──────────────────────────┐
│ handlers/        │              │ referral/                │
│   types.ts       │ ← 実装 ←── │   coupon/referralHandler  │
│   registry.ts    │              │   (category: "referral") │
│   init.ts        │ ← import ── │                          │
│                  │              ├──────────────────────────┤
│ couponService    │              │ purchaseRequest/ (例)    │
│   validateFor... │ ── 呼出 ──→ │   handler.validateForUse │
│   redeemWith...  │ ── 呼出 ──→ │   handler.onRedeemed     │
└──────────────────┘              └──────────────────────────┘
```

### CouponHandler インターフェース

```typescript
import type { CouponHandler } from "@/features/core/coupon/handlers";

interface CouponHandler {
  label: string;                    // カテゴリのラベル（管理画面表示用）
  settingsFields?: FieldConfig[];   // カテゴリ固有の設定フィールド定義（管理画面フォーム用）
  validateForUse?(context): Promise<{ valid: boolean; reason?: string }>;  // 追加検証
  resolveEffect?(context): Promise<Record<string, unknown>>;              // 効果プレビュー
  onRedeemed?(context): Promise<void>;                                     // redeem後処理
  describeEffect?(coupon): { label: string; description: string } | null; // 効果説明
}
```

| プロパティ | タイミング | 副作用 | 用途例 |
|---|---|---|---|
| `settingsFields` | 管理画面フォーム描画時 | なし | 割引タイプ・割引値の入力欄定義 |
| `validateForUse` | `validateForCategory` 時 | なし | 最低購入金額チェック |
| `resolveEffect` | `validateForCategory` 時 | なし | 割引額の計算（`coupon.settings` を参照） |
| `onRedeemed` | `redeemWithEffect` 時 | あり | referral 作成、分析イベント送信 |
| `describeEffect` | 管理画面表示時 | なし | 「500円割引」の説明生成 |

### settings フィールドと settingsFields の関係

`settingsFields` はハンドラーが「このカテゴリではどんなパラメータが必要か」を FieldConfig 形式で宣言するもの。管理画面でカテゴリを選択すると、対応する settingsFields が動的にフォームに表示され、入力値は `coupon.settings` (jsonb) に格納される。ハンドラーの `resolveEffect` 等が `coupon.settings` からパラメータを読み取って効果を計算する。

```
管理画面: カテゴリ選択 → settingsFields 表示 → 入力値を settings に保存
実行時:   coupon.settings を参照 → resolveEffect で効果計算
```

### 実装済みハンドラー: referral（招待リファラル）

招待コード使用時の referral 作成 + 報酬トリガーを担当する。

```typescript
// src/features/core/referral/services/server/coupon/referralHandler.ts

registerCouponHandler("referral", {
  label: "招待リファラル",
  async onRedeemed({ coupon, userId }) {
    const referral = await createReferralFromRedemption(coupon, userId);
    if (referral) {
      await referralRewardService.triggerRewards("signup_completed", referral);
    }
  },
});
```

registration.ts からは `couponService.redeemWithEffect(inviteCode, user.id)` の1行で呼ばれ、ハンドラーが referral 作成と報酬処理を自動実行する。

### 新しいクーポン用途の追加手順

#### 1. 消費側ドメインにハンドラーを作成

```typescript
// src/features/core/purchaseRequest/services/server/coupon/registerHandler.ts（例）

import { registerCouponHandler } from "@/features/core/coupon/handlers";

registerCouponHandler("purchase_discount", {
  label: "購入割引",

  // 管理画面フォームに表示される設定フィールド（FieldConfig 互換）
  settingsFields: [
    {
      name: "discountType", label: "割引タイプ", formInput: "select", required: true,
      options: [{ value: "percentage", label: "定率" }, { value: "fixed", label: "定額" }],
    },
    { name: "discountValue", label: "割引値", formInput: "numberInput", required: true },
    { name: "maxDiscountAmount", label: "割引上限額", formInput: "numberInput" },
  ],

  async validateForUse({ coupon, userId, metadata }) {
    const paymentAmount = metadata?.paymentAmount as number;
    if (paymentAmount < 500) {
      return { valid: false, reason: "最低購入金額に達していません" };
    }
    return { valid: true };
  },

  async resolveEffect({ coupon, metadata }) {
    const { discountType, discountValue, maxDiscountAmount } = coupon.settings;
    const paymentAmount = metadata?.paymentAmount as number;
    let discount = discountType === "percentage"
      ? Math.floor(paymentAmount * (discountValue as number) / 100)
      : (discountValue as number);
    if (maxDiscountAmount) discount = Math.min(discount, maxDiscountAmount as number);
    return {
      discountAmount: discount,
      finalPaymentAmount: Math.max(0, paymentAmount - discount),
    };
  },

  describeEffect(coupon) {
    const { discountType, discountValue } = coupon.settings;
    const label = discountType === "percentage" ? `${discountValue}%割引` : `${discountValue}円割引`;
    return { label, description: `コイン購入時に${label}されます` };
  },
});
```

#### 2. init.ts にインポートを追加

```typescript
// src/features/core/coupon/handlers/init.ts

import "@/features/core/purchaseRequest/services/server/coupon/registerHandler";
```

#### 3. 管理画面で確認

- クーポン作成/編集フォームの「カテゴリ」ドロップダウンに「購入割引」が表示される
- カテゴリ選択後、settingsFields で定義したフィールド（割引タイプ、割引値等）が「カテゴリ設定」セクションに動的表示される
- 入力値は `coupon.settings` に JSON として格納される

#### 4. 消費側ドメインで利用

```typescript
// 購入フローでのクーポン検証
const result = await couponService.validateForCategory(
  couponCode,
  "purchase_discount",
  userId,
  { paymentAmount: 2000 }
);

if (result.valid) {
  const { discountAmount, finalPaymentAmount } = result.effect as {
    discountAmount: number;
    finalPaymentAmount: number;
  };
  // 割引後金額で決済セッション作成
}
```

---

## 使用可否判定の理由一覧

| reason | 説明 |
|--------|------|
| `not_found` | クーポンが見つからない |
| `inactive` | 無効状態 |
| `not_started` | 有効開始前 |
| `expired` | 有効期限切れ |
| `max_total_reached` | 総使用回数上限に到達 |
| `max_per_user_reached` | ユーザー毎の使用上限に到達 |
| `user_id_required` | ユーザーIDが必要（`max_uses_per_redeemer` 設定時） |
| `category_mismatch` | カテゴリが一致しない |
| `handler_rejected` | ハンドラーの追加検証で拒否 |

---

## クライアントフック

```typescript
// 使用可否チェック（手動トリガー）
import { useCheckCouponUsability } from "@/features/core/coupon/hooks/useCheckCouponUsability";

// 使用可否チェック（自動トリガー、デバウンス付き）
import { useCheckCouponUsabilityAuto } from "@/features/core/coupon/hooks/useCheckCouponUsability";

// クーポン使用
import { useRedeemCoupon } from "@/features/core/coupon/hooks/useRedeemCoupon";

// 招待コード取得
import { useMyInviteCode } from "@/features/core/coupon/hooks/useMyInviteCode";

// 招待コード発行
import { useIssueMyInviteCode } from "@/features/core/coupon/hooks/useIssueMyInviteCode";

// 登録済みカテゴリ一覧（管理画面フォーム用）
import { useCouponCategories } from "@/features/core/coupon/hooks/useCouponCategories";
```

---

## API ルート

| メソッド | パス | 用途 |
|---------|------|------|
| `POST` | `/api/coupon/check-usability` | 使用可否チェック |
| `POST` | `/api/coupon/redeem` | クーポン使用 |
| `GET` | `/api/coupon/my-invite` | 自分の招待コード取得 |
| `POST` | `/api/coupon/my-invite` | 自分の招待コード発行 |
| `GET` | `/api/coupon/categories` | 登録済みカテゴリ一覧（settingsFields 含む） |

---

## ディレクトリ構造

```
src/features/core/coupon/
├── README.md
├── domain.json                  # ドメイン設定（dc:generate の入力）
├── presenters.ts                # フィールド表示フォーマッター
│
├── entities/                    # 生成ファイル
│   ├── drizzle.ts               # テーブル定義
│   ├── model.ts                 # TypeScript 型
│   ├── schema.ts                # Zod スキーマ
│   ├── form.ts                  # フォーム型
│   └── index.ts
│
├── handlers/                    # ハンドラーシステム（手動管理）
│   ├── types.ts                 # CouponHandler インターフェース
│   ├── registry.ts              # 登録・取得関数
│   ├── init.ts                  # 全ハンドラーの import 集約
│   └── index.ts
│
├── services/
│   ├── client/
│   │   ├── couponClient.ts      # 基本 CRUD クライアント
│   │   ├── redemption.ts        # 使用・チェック・カテゴリ取得
│   │   └── inviteCode.ts        # 招待コード
│   └── server/
│       ├── couponService.ts     # メインサービス（全機能の集約）
│       ├── drizzleBase.ts       # ベース CRUD（生成）
│       ├── redemption/          # 使用処理
│       │   ├── redeem.ts        # トランザクション付き使用
│       │   ├── isUsable.ts      # 使用可否判定
│       │   ├── getUsageCount.ts # ユーザー毎の使用回数
│       │   └── utils.ts         # 共通ユーティリティ
│       ├── ownership/           # コード発行・所有権
│       │   ├── issueCodeForOwner.ts
│       │   ├── getCodesByOwner.ts
│       │   └── inviteCode.ts
│       └── wrappers/            # カスタマイズ可能なラッパー
│           ├── remove.ts        # ストレージ対応削除
│           ├── duplicate.ts     # コード再生成付き複製
│           ├── validateForCategory.ts  # カテゴリ付き検証
│           └── redeemWithEffect.ts     # ハンドラー付き使用
│
├── hooks/                       # React フック
│   ├── useCoupon.ts             # 単体取得（生成）
│   ├── useCouponList.ts         # 一覧取得（生成）
│   ├── useSearchCoupon.ts       # 検索（生成）
│   ├── useCheckCouponUsability.ts  # 使用可否チェック
│   ├── useRedeemCoupon.ts       # クーポン使用
│   ├── useMyInviteCode.ts       # 招待コード取得
│   ├── useIssueMyInviteCode.ts  # 招待コード発行
│   ├── useCouponCategories.ts   # カテゴリ一覧
│   └── useCouponViewModal.ts    # 管理画面詳細モーダル
│
├── components/                  # UI コンポーネント
│   ├── AdminCouponList/         # 管理画面一覧（生成）
│   ├── AdminCouponCreate/       # 管理画面作成（生成）
│   ├── AdminCouponEdit/         # 管理画面編集（生成）
│   └── common/
│       ├── CouponForm.tsx       # 汎用フォーム
│       ├── CouponFields.tsx     # フィールドレンダラー
│       ├── CreateCouponForm.tsx  # 作成フォーム
│       ├── EditCouponForm.tsx    # 編集フォーム
│       └── CouponDetailModal.tsx # 詳細モーダル
│
├── types/
│   ├── redeem.ts                # 使用処理の型
│   └── field.ts                 # フィールド型（生成）
│
├── constants/
│   └── field.ts                 # 定数（生成）
│
└── utils/
    └── generateCode.ts          # コード自動生成（8文字、紛らわしい文字除外）
```

---

## 関連ドメイン

- **couponHistory**: 使用履歴の記録・参照（`redeem()` から自動記録）
- **referral**: 招待リファラルハンドラー（`category=referral`）を提供。`onRedeemed` で referral 作成 + 報酬トリガーを実行
- **auth**: 登録時の招待コード適用（`registration.ts` → `couponService.redeemWithEffect()`）
- **purchaseRequest**: コイン購入時のクーポン割引（ハンドラーで実装予定）
