# Coupon ドメイン

## Overview

- クーポンコードの発行・管理・使用を担う汎用フレームワーク
- クーポンドメインは「コード・使用制限・有効期限の管理」に徹する。具体的な特典効果（割引、機能解放など）はクーポンドメイン側に定義せず、消費側ドメインがハンドラーとして実装する
- 入口: サーバー `couponService`（`@/domains/core/coupon/services/server/couponService`）、クライアントは `hooks/` のフック
- 機能の入切は門番の規則 `coupon`（`src/featureGate/rules/coupon.ts`）
- 決まり（入口スコープの定数・ハンドラーの書き方・管理画面のタブと一覧）は札 `.claude/rules/items/features/coupon.md`。入口スコープ・自己消込・理由の文言の必須の決まりは CLAUDE.md FEATURES coupon_entry_scope と札

## Usage

### クーポンを検証する（サーバー）

```typescript
import { couponService } from "@/domains/core/coupon/services/server/couponService";

// 基本的な使用可否チェック
const result = await couponService.isUsable("CODE123", userId);
if (result.usable) {
  // result.coupon にクーポン情報
}

// 入口スコープ付き（この入口で受理する種別 / カテゴリを絞る。不一致は type_mismatch / category_mismatch）
const result = await couponService.isUsable("CODE123", userId, {
  scope: { types: ["invite"] },
});

// ログイン前プレビュー（使用者未確定。自己消込 / ユーザー毎上限の判定を省略）
const result = await couponService.isUsable("CODE123", null, {
  scope: { types: ["invite"] },
  skipRedeemerChecks: true,
});

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
// 入口が受理する種別 / カテゴリは scope で絞る（決まりは札 entry_scope_const、下記「入口スコープ」）
const result = await couponService.redeemWithEffect(
  "CODE123",
  userId,
  { purchaseRequestId: "xxx" },
  undefined,
  { scope: { categories: ["purchase_discount"] } },
);
```

### 入口スコープ（scope）

クーポンコードを受け付ける「入口」（登録フォームの招待コード欄、購入画面のクーポン欄、汎用消込 API 等）は、その入口で受理する種別 / カテゴリを `scope` で宣言する。基底検証（`validateCouponStatically`）が `scope.types` / `scope.categories` との一致を status の直後に判定し、不一致は消込せず `type_mismatch` / `category_mismatch` を返す。

scope 無しで消し込むと: 招待コード欄にアフィリエイトコードを入力 → 使用回数だけ消費され履歴も残るが、カテゴリ違いなので招待ハンドラーは走らず紹介関係も報酬も作られない。発行者側の月次枠は幻の使用で減る。フォームは無反応なので利用者も気づけない。

上流の入口:

- 本登録の招待コード欄（auth `register()`）: `INVITE_CODE_REDEEM_SCOPE` = `{ types: ["invite"] }`（referral/constants/inviteCodeScope.ts が単一定義）
- 購入完了（purchaseRequest `completePurchase`）: `{ categories: ["purchase_discount"] }`（validate-for-category と同じカテゴリ）
- `POST /api/coupon/redeem`（汎用・ゲスト可）: `{ types: ["official"] }`（帰属付き種別 invite / affiliate は専用入口のみ）
- `validateForCategory(code, category, ...)`: `{ categories: [category] }` を内部で付与

- `types` / `categories` は省略した軸を制限しない。両方指定すれば AND
- 最終消込は必ず使用者付きで全判定を再実行する（`redeem` / `redeemWithEffect` の `RedeemOptions` は `skipRedeemerChecks` を型で受け付けない）

### クーポンを検証する（クライアント）

```typescript
// 手動トリガー
const { check, usability, isLoading } = useCheckCouponUsability();
await check("CODE123");

// 自動トリガー（デバウンス付き）
const { usability, isLoading } = useCheckCouponUsabilityAuto(code, 500);
```

## API

### データモデル: Coupon

- `id` `string`: UUID
- `category` `string | null`: 用途カテゴリ（ハンドラーと紐付く）
- `code` `string`: クーポンコード（ソフトデリート込みユニーク）
- `type` `enum`: `official` / `affiliate` / `invite`（発行元の種類）
- `status` `enum`: `active` / `inactive`
- `name` `string`: クーポン名
- `description` `string | null`: 説明文
- `image_url` `string | null`: イメージ画像URL
- `admin_label` `string | null`: 管理者用ラベル
- `admin_note` `string | null`: 管理者用メモ
- `valid_from` `Date | null`: 有効開始日
- `valid_until` `Date | null`: 有効終了日
- `max_total_uses` `number | null`: 総使用回数上限（null=無制限）
- `max_uses_per_redeemer` `number | null`: 使用者毎の上限（null=無制限）
- `current_total_uses` `number`: 現在の総使用回数
- `attribution_user_id` `string | null`: 帰属ユーザーID（招待/アフィリエイト用）
- `settings` `Record<string, unknown>`: カテゴリ固有のパラメータ（ハンドラーが定義・参照）

`type` と `category` の違い:

- `type`: 発行元の種類。official=公式、affiliate=アフィリエイト、invite=ユーザー招待
- `category`: 用途・効果の分類。ハンドラーレジストリのキーと一致させる。消費側ドメインが自由に定義

### データモデル: CouponHistory

- `id` `string`: UUID
- `coupon_id` `string`: クーポンID
- `redeemer_user_id` `string | null`: 使用者のユーザーID
- `metadata` `jsonb`: クーポンスナップショット + 追加メタデータ
- `createdAt` `Date`: 使用日時

`metadata` には使用時点のクーポン情報（code, type, name 等）のスナップショットと、`redeem()` 呼び出し時に渡された `additionalMetadata` がマージされる。

### couponService

```typescript
import { couponService } from "@/domains/core/coupon/services/server/couponService";
```

#### 使用可否チェック

```typescript
// 基本チェック（DB アクセスあり、ユーザー毎の使用回数も確認）
// options: { scope?: { types?, categories? }, skipRedeemerChecks?: boolean }
const result = await couponService.isUsable(code, userId?, options?);
// → { usable: true, coupon } | { usable: false, reason, coupon? }

// 静的チェック（DB アクセスなし、クーポンオブジェクトに対して実行）
const result = couponService.validateCouponStatically(coupon, userId?, options?);
// → { valid: true } | { valid: false, reason }
```

#### 使用（redeem）

```typescript
// 基本使用（トランザクション内で SELECT FOR UPDATE → 検証 → カウント更新 → 履歴記録）
// options: { scope?: { types?, categories? } }（skipRedeemerChecks は型で不可）
const result = await couponService.redeem(code, userId?, additionalMetadata?, tx?, options?);
// → { success: true, history, coupon } | { success: false, reason }
```

#### カテゴリ付き検証（ハンドラー連携）

```typescript
// カテゴリ一致 + ハンドラーの validateForUse + resolveEffect を実行
const result = await couponService.validateForCategory(code, category, userId, metadata?);
// → { valid: true, coupon, effect } | { valid: false, reason, coupon? }
```

#### ハンドラー付き使用（ハンドラー連携）

```typescript
// 基本 redeem + ハンドラーの onRedeemed を実行（options.scope で入口の種別 / カテゴリを必ず絞る）
const result = await couponService.redeemWithEffect(code, userId, metadata?, tx?, options?);
// → { success: true, history } | { success: false, reason }
```

#### コード発行・所有権

```typescript
// 招待コード取得（未発行なら null）
const coupon = await couponService.getInviteCode(userId, tx?);

// 招待コード取得 or 作成（冪等）
const coupon = await couponService.getOrCreateInviteCode(userId, tx?);

// 帰属付きコード発行（invite / affiliate のみ。official は対象外）
const coupon = await couponService.issueCodeForOwner({
  attributionUserId: userId,
  type: "affiliate",
  category: "purchase_discount",
  name: "アフィリエイトコード",
  maxTotalUses: 100,
  // カテゴリハンドラーが参照する settings（省略時 {}）
  settings: { discountType: "percentage", discountValue: 3 },
});

// 承認制の発行者プログラム（申請 → 承認 → 周期発行）は couponIssuerGrant ドメインが担う
// → src/domains/core/couponIssuerGrant/README.md

// オーナーのコード一覧
const coupons = await couponService.getCodesByOwner({
  attributionUserId: userId,
  type: "invite",
});
```

#### CRUD

標準の CRUD 操作（`create`, `get`, `list`, `search`, `update`, `delete`, `restore`, `hardDelete`, `duplicate`, `upsert`）も利用可能。

### CouponHandler インターフェース

```typescript
import type { CouponHandler } from "@/domains/core/coupon/handlers";

interface CouponHandler {
  label: string;                    // カテゴリのラベル（管理画面表示用）
  settingsFields?: FieldConfig[];   // カテゴリ固有の設定フィールド定義（管理画面フォーム用）
  validateForUse?(context): Promise<{ valid: boolean; reason?: string }>;  // 追加検証
  resolveEffect?(context): Promise<Record<string, unknown>>;              // 効果プレビュー
  onRedeemed?(context): Promise<void>;                                     // redeem後処理
  describeEffect?(coupon): { label: string; description: string } | null; // 効果説明
}
```

- `settingsFields`: 管理画面フォーム描画時。副作用 なし。例: 割引タイプ・割引値の入力欄定義
- `validateForUse`: `validateForCategory` 時。副作用 なし。例: 最低購入金額チェック
- `resolveEffect`: `validateForCategory` 時。副作用 なし。例: 割引額の計算（`coupon.settings` を参照）
- `onRedeemed`: `redeemWithEffect` 時。副作用 あり。例: referral 作成、分析イベント送信、帰属報酬付与
- `describeEffect`: 管理画面表示時。副作用 なし。例: 「500円割引」の説明生成

### 使用可否判定の理由

- `not_found`: クーポンが見つからない
- `inactive`: 無効状態
- `not_started`: 有効開始前
- `expired`: 有効期限切れ
- `max_total_reached`: 総使用回数上限に到達
- `max_per_user_reached`: ユーザー毎の使用上限に到達
- `user_id_required`: ユーザーIDが必要（`max_uses_per_redeemer` 設定時）
- `self_redeem_forbidden`: 帰属ユーザー（発行者）本人による使用（自己消込禁止）
- `type_mismatch`: 入口スコープ（`scope.types`）と種別が一致しない
- `category_mismatch`: 入口スコープ（`scope.categories` / `validateForCategory` の category）とカテゴリが一致しない
- `handler_rejected`: ハンドラーの追加検証で拒否

- reason → ユーザー向け文言は `constants/redeemReasonMessages.ts` の `getCouponRedeemReasonMessage()` に一本化されている。API ルート（check-usability / redeem / validate-for-category）はすべてこれを使う（網羅は型で強制）

### クライアントフック

```typescript
// 使用可否チェック（手動トリガー）
import { useCheckCouponUsability } from "@/domains/core/coupon/hooks/useCheckCouponUsability";

// 使用可否チェック（自動トリガー、デバウンス付き）
import { useCheckCouponUsabilityAuto } from "@/domains/core/coupon/hooks/useCheckCouponUsability";

// クーポン使用
import { useRedeemCoupon } from "@/domains/core/coupon/hooks/useRedeemCoupon";

// 招待コード取得
import { useMyInviteCode } from "@/domains/core/coupon/hooks/useMyInviteCode";

// 招待コード発行
import { useIssueMyInviteCode } from "@/domains/core/coupon/hooks/useIssueMyInviteCode";

// カテゴリ付き検証
import { useValidateCouponForCategory } from "@/domains/core/coupon/hooks/useValidateCouponForCategory";

// 登録済みカテゴリ一覧（管理画面フォーム用）
import { useCouponCategories } from "@/domains/core/coupon/hooks/useCouponCategories";
```

### API ルート

- `POST` `/api/coupon/check-usability`: 使用可否チェック
- `POST` `/api/coupon/validate-for-category`: カテゴリ付き検証（ログイン必須）
- `POST` `/api/coupon/redeem`: クーポン使用（汎用・ゲスト可。受理は `official` のみ、帰属付き種別は専用入口）
- `POST` `/api/referral/validate-invite-code`: 招待コードのログイン前検証（referral ドメイン。valid と文言のみ返す）
- `GET` `/api/coupon/my-invite`: 自分の招待コード取得
- `POST` `/api/coupon/my-invite`: 自分の招待コード発行
- `GET` `/api/coupon/categories`: 登録済みカテゴリ一覧（settingsFields 含む）

## Extension

### 新しいクーポン用途（ハンドラー）の追加

上流が足すときの手順（登録を呼ぶ `handlers/init.ts` は core のファイルで、ハンドラーの受け口は無い。fork が自分の用途を足したいときは → `/order <direct parent>`）。

1. 消費側ドメインにハンドラーを作る

```typescript
// src/domains/core/purchaseRequest/services/server/coupon/registerHandler.ts（例）

import { gate } from "@/featureGate";
import { registerCouponHandler } from "@/domains/core/coupon/handlers";

export function registerPurchaseDiscountHandler(): void {
  if (!gate.enabled("coupon")) return;
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
}
```

2. `handlers/init.ts` で登録の関数を呼ぶ

```typescript
// src/domains/core/coupon/handlers/init.ts

import { registerPurchaseDiscountHandler } from "@/domains/core/purchaseRequest/services/server/coupon/registerHandler";

if (gate.enabled("payment")) registerPurchaseDiscountHandler();
```

- 上流の購入割引は決済が閉じていればカテゴリが一覧に出ない（init.ts の `gate.enabled("payment")`。登録の関数の中でもクーポンの入切を確かめる）。招待リファラルは init.ts の `if (gate.enabled("referral")) registerReferralCouponHandler();` だけ（関数の中の確かめは無い）

3. 管理画面で確かめる

- クーポン作成/編集フォームの「カテゴリ」ドロップダウンに「購入割引」が表示される
- カテゴリ選択後、settingsFields で定義したフィールド（割引タイプ、割引値等）が「カテゴリ設定」セクションに動的表示される
- 入力値は `coupon.settings` に JSON として格納される

4. 消費側ドメインで使う

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

### 管理画面セクションタブ

- `/admin/coupons/*` の上部タブ（公式プロモーション / アフィリエイト / ユーザー招待）は `CouponTypeOptions`（クーポン種別 enum）から生成される。ただし種別 enum と画面セクションは別物
- downstream が種別に属さない派生クーポンの専用画面（例: フレンドクーポン、type は `affiliate` のまま）を `/admin/coupons/<slug>` に置く場合、受け口に項目を置けば core の全クーポン管理画面のタブに末尾追加される
- 受け口: `adminSectionTabs/<名前>.ts` の `export const tab: CouponSectionTabItem`（`@/domains/core/coupon/types/sectionTab` = `PageTabItem` + `enabled?`。一覧 `extensions/sectionTabs`、upstream は空 = 3 タブ）
- 組み立て: `buildCouponAdminSectionTabs()`（`@/domains/core/coupon/lib/adminSectionTabs`）= core 3 タブ + 有効な項目（`PageTabItem[]`、`enabled` は残さない）。value の重複は例外（無効の項目も含めて判定）
- 閉じる: 項目の `enabled: () => boolean` が false の間はタブの一覧から外れる（省略 = 常に出す）。組み立ては client（AdminCouponSectionTabs）で走る
- 描画: 公開の部品 `AdminCouponSectionTabs`（`@/domains/core/coupon/components/AdminCouponSectionTabs`、`variant?: "body" | "header"`、既定 body）。header はヘッダーの行の中央向けの size="sm"。core ページ（official / invite / affiliate）は `<AdminPage center={<AdminCouponSectionTabs variant="header" />}>`。本文に置くなら本文に `<AdminCouponSectionTabs />`
- DB / enum 変更なし。派生クーポンの画面（一覧・絞り込みクエリ）自体は downstream 所有
- downstream 所有の official / affiliate ページを差し替えている場合も、ローカルのタブ定義を捨てて AdminCouponSectionTabs に寄せると core と downstream のタブ一覧が常に一致する

downstream レシピ:

```typescript
// 1. src/domains/core/coupon/adminSectionTabs/friendCoupon.ts → pnpm generate extensions
import type { CouponSectionTabItem } from "@/domains/core/coupon/types/sectionTab";
export const tab: CouponSectionTabItem = {
  value: "friend-coupon",
  label: "フレンドクーポン",
  href: "/admin/coupons/friend-coupon",
  enabled: () => friendCouponConfig.enabled, // 省略 = 常に出す
};

// 2. src/app/admin/(protected)/coupons/friend-coupon/_screen/AdminFriendCouponScreen.tsx（downstream 実装）
import { AdminCouponSectionTabs } from "@/domains/core/coupon/components/AdminCouponSectionTabs";
// ...
<AdminPage title="クーポン管理" center={<AdminCouponSectionTabs variant="header" />}>
  {/* 一覧本体 */}
</AdminPage>
```

### 管理画面のクーポン一覧（useAdminCouponListTable / createAdminCouponListColumns）

処理と列は公開の関数とフックが持つ（一般ユーザー一覧と同じ形: `src/domains/core/user/README.md`「管理画面の一般ユーザー一覧」）。

- `createAdminCouponListColumns()`（`components/AdminCouponList` の入口）: 上流の列（domainDisplay の列 + 操作の列）の配列を返す。呼ぶたびに新しい配列
- `useAdminCouponListTable()`（`hooks/useAdminCouponListTable.ts`）: 行のクリックで開く詳細のモーダルの対象。`rowProps`（DataTable に広げる）・`modal`（`CouponDetailModal` に広げる）・`selectedId` / `open` / `close`

```tsx
// src/app/admin/(protected)/coupons/.../_components/CouponTable.tsx(fork)
const table = useAdminCouponListTable();
const columns = useMemo(() => [...createAdminCouponListColumns(), { header: "利用率", render: (c: Coupon) => rate(c) }], []);
<>
  <DataTable items={coupons} columns={columns} getKey={(c) => c.id} {...table.rowProps} />
  <CouponDetailModal {...table.modal} />
</>
```

### 設定（`config.ts`）

- 持ち主 `src/domains/core/coupon/config.ts`（既定・型 `CouponOverride`・合成 `couponConfig`）、上書き `src/config/domains/coupon.config.ts`（値はリテラル。置き方: `src/config/README.md`）
- `affiliateDescription: string | null`: アフィリエイトクーポンの管理画面（`/admin/coupons/affiliate`）の説明文の下に、同じ見た目で 1 文足す。画面を `_components/` に写さずに文だけ変える受け口
- 機能の入切は門番の規則 `coupon`（`src/featureGate/rules/coupon.ts`、既定 閉。`pnpm ops features set coupon on`）

## Internals

### ハンドラーシステム

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

- `onRedeemed` の context には `redeemWithEffect(code, userId, metadata, tx)` に渡された `tx` がそのまま `context.tx` として伝搬する（省略時は `undefined`）。購入完了 tx 内で呼ばれる場合、ハンドラーはこの `tx` を使って同一トランザクションに副作用（帰属報酬付与など）を乗せられる。tx が無い場合の独立実行との両対応は `runWithTransaction(context.tx, ...)` で受ける。
- `settingsFields` はハンドラーが「このカテゴリではどんなパラメータが必要か」を FieldConfig 形式で宣言するもの。管理画面でカテゴリを選択すると、対応する settingsFields が動的にフォームに表示され、入力値は `coupon.settings` (jsonb) に格納される。ハンドラーの `resolveEffect` 等が `coupon.settings` からパラメータを読み取って効果を計算する。
```
管理画面: カテゴリ選択 → settingsFields 表示 → 入力値を settings に保存
実行時:   coupon.settings を参照 → resolveEffect で効果計算
```

- 実装済みハンドラー referral（招待リファラル）: 招待コード使用時の referral 作成 + 報酬トリガー

```typescript
// src/domains/core/referral/services/server/coupon/referralHandler.ts

export function registerReferralCouponHandler(): void {
  registerCouponHandler("referral", {
    label: "招待リファラル",
    async onRedeemed({ coupon, userId }) {
      const referral = await createReferralFromRedemption(coupon, userId);
      if (referral) {
        await referralRewardService.triggerRewards("signup_completed", referral);
      }
    },
  });
}
```

registration.ts からは `couponService.redeemWithEffect(inviteCode, user.id, { entryPoint: "registration" }, undefined, { scope: INVITE_CODE_REDEEM_SCOPE })` で呼ばれ、ハンドラーが referral 作成と報酬処理を自動実行する。

### 自己消込ガード（self_redeem_forbidden）

- `attribution_user_id` が設定されたクーポン（invite / affiliate）を、その帰属ユーザー本人が使うことは常に拒否する
- 発行者が自分のコードで「割引 + 帰属報酬」を自己ループする不正を、コア基底検証（`validateCouponStatically`）で閉じる。`isUsable` / `redeem` / `validateForCategory` の全経路に効く
- `attribution_user_id = null`（official）は対象外
- 招待フロー（被招待者が招待者のコードを使う）は別ユーザーなので影響なし
- オプトアウトは無い

### その他

- `redeem` はトランザクション内で SELECT FOR UPDATE → 検証 → カウント更新 → 履歴記録
- コード自動生成は `utils/generateCode.ts`（8 文字、紛らわしい文字除外）

## Related

- couponHistory: 使用履歴の記録・参照（`redeem()` から自動記録）
- referral: 招待リファラルハンドラー（`category=referral`）を提供。`onRedeemed` で referral 作成 + 報酬トリガーを実行
- auth: 登録時の招待コード適用（`registration.ts` → `couponService.redeemWithEffect()`）
- purchaseRequest: コイン購入時のクーポン割引のハンドラー
- couponIssuerGrant: 承認制の発行者プログラム（申請 → 承認 → 周期発行）。`src/domains/core/couponIssuerGrant/README.md`
