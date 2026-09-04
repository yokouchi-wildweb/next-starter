# couponIssuerGrant — クーポン発行者プログラム

ユーザーが **クーポン発行権を申請** し、管理者が **per-user パラメータ付きで承認** し、承認されたユーザーが **周期ポリシーの下で自分の帰属クーポン（type=affiliate）を発行** するための汎用基盤。アフィリエイト / アンバサダー / フレンドクーポンの「申請 → 承認 → 月 1 枚発行」を支える。

- Tier1 が持つのは **権利の台帳と状態遷移・周期発行の骨組み** のみ。「何を発行するか」（カテゴリ・周期・settings の意味）は下流が `src/registry/couponIssuerProgramRegistry.ts` に 1 つ登録する
- 上流は registry を `null` で出荷 = 発行 API は 503（fail-closed）。申請・審査は registry 未設定でも動く
- UI は出荷しない（データレイヤのみ）。画面は下流が本 README のレシピで組む

---

## データモデル

テーブル `coupon_issuer_grants`（ユーザーにつき 1 行）

| 列 | 型 | 説明 |
|---|---|---|
| `user_id` | uuid **unique** → users (cascade) | 申請者 |
| `status` | pending / approved / rejected / suspended | 発行権の状態 |
| `settings` | jsonb | per-user パラメータ（下流定義。Tier1 は不透明扱い） |
| `application` | jsonb | 申請フォームの内容（下流定義、任意） |
| `requested_at` | timestamptz | 申請（再申請）日時 |
| `reviewed_at` / `reviewed_by` | timestamptz / uuid → users (set null) | 最終審査 |
| `admin_note` | text | 管理者メモ（本人には返さない） |

状態遷移:

```
(なし) --apply--> pending --approve--> approved --suspend--> suspended --reinstate--> approved
                 pending --reject---> rejected --apply--> pending（再申請）
```

監査: 全遷移は `base.update` 経由のため CRUD 自動監査 `coupon_issuer_grant.updated`（before/after 差分）が残る。

---

## プログラム設定（下流が登録）

```typescript
// src/registry/couponIssuerProgramRegistry.ts
import type { CouponIssuerProgramConfig } from "@/features/core/couponIssuerGrant/types/program";

export const couponIssuerProgram: CouponIssuerProgramConfig | null = {
  category: "purchase_discount",                 // 発行するクーポンのカテゴリ（ハンドラー登録済みであること）
  period: { kind: "calendar_month" },            // 周期（timeZone 既定 Asia/Tokyo）
  buildIssueParams: ({ grant, period }) => ({    // grant.settings → 発行パラメータ（意味論はここに閉じる）
    name: "フレンドクーポン",
    maxTotalUses: Number(grant.settings.monthlyMaxUses ?? 30),
    maxUsesPerRedeemer: 1,
    settings: {                                  // カテゴリハンドラーが読む coupon.settings
      discountType: "percentage",
      discountValue: Number(grant.settings.discountRate ?? 3),
      rewardRate: Number(grant.settings.rewardRate ?? 0.03),
    },
  }),
  buildCouponPatch: ({ grant }) => ({            // 任意: settings 変更を当期クーポンへ即時反映
    maxTotalUses: Number(grant.settings.monthlyMaxUses ?? 30),
    settings: { /* buildIssueParams と同じ導出 */ },
  }),
};
```

周期ポリシー `PeriodPolicy`:

| kind | 意味 |
|---|---|
| `calendar_month` / `calendar_week`(月曜始まり) / `calendar_day` | `timeZone` の暦で区切る。1 周期 1 枚、`valid_from` = 周期開始、`valid_until` = 周期終了 −1ms |
| `none` | 周期なし。ユーザーにつき 1 枚、有効期限なし |
| `custom` | `resolve(now) → { key, start, end } \| null`。null = 発行期間外（409） |

周期の解決は `resolveIssuancePeriod(policy, now?)`（`@/features/core/couponIssuerGrant`）で単体利用も可。

---

## サービス API（server）

```typescript
import { couponIssuerGrantService } from "@/features/core/couponIssuerGrant/services/server";
```

| 関数 | 役割 | 制約 |
|---|---|---|
| `getByUser(userId, tx?, {lock?})` | 発行権取得 | 未申請 → null |
| `apply({ userId, application? })` | 申請（本人） | pending → 冪等 / rejected → 再申請 / approved・suspended → 409 |
| `review({ grantId, decision, reviewedBy, settings?, adminNote? })` | 承認 / 却下（管理者） | pending からのみ。approve 時 settings 省略で既存維持 |
| `suspend({ grantId, reviewedBy, adminNote? })` | 停止 | approved からのみ。**当期クーポンを inactive** にする |
| `reinstate({ grantId, reviewedBy, adminNote? })` | 復帰 | suspended からのみ。当期クーポンがあれば active に戻す |
| `updateSettings({ grantId, settings, updatedBy, adminNote? })` | per-user 設定の置換 | approved かつ `buildCouponPatch` 定義時、当期クーポンへ即時反映。`{ grant, syncedCouponId }` |
| `issueForGrant({ userId, now? })` | 発行（本人） | program 未設定 503 / approved 以外 403 / 期間外 409。当期発行済みなら `created:false` で既存を返す |
| `getCurrentPeriodCoupon(userId)` | 当期クーポン参照 | `{ coupon, period }` |

発行の保証:
- ユーザー単位の `pg_advisory_xact_lock` + 周期内既存チェック（inactive 含む）で **1 周期 1 枚**。停止で inactive になったクーポンがある周期に再発行しても二重発行しない
- 発行されるクーポン: `type=affiliate` / `category=program.category` / `attribution_user_id=本人` / code 自動生成（`issueCodeForOwner`）/ `admin_label=issuer-program:<periodKey>`
- 自己消込は coupon 基底の `self_redeem_forbidden` で拒否される（発行者が自分のクーポンを使えない）

---

## API ルート

| メソッド | パス | 用途 |
|---|---|---|
| `GET` | `/api/me/coupon-issuer` | `{ programEnabled, grant, currentCoupon, period }`（grant は admin_note / reviewed_by を除いた本人向け形） |
| `POST` | `/api/me/coupon-issuer/apply` | 申請 `{ application? }` → `{ grant }` |
| `POST` | `/api/me/coupon-issuer/issue` | 当期クーポン発行 → `{ coupon, created, period }` |
| `GET` | `/api/me/coupon-issuer/coupons?limit` | 自分が発行したクーポン一覧（過去周期・inactive 含む、既定 24 / 上限 100） |
| `PATCH` | `/api/admin/coupon-issuer-grants/[id]` | `{ action: approve\|reject\|suspend\|reinstate\|update_settings, settings?, adminNote? }` |
| 汎用 | `/api/coupon-issuer-grant/**` | admin の一覧・検索（serviceRegistry `couponIssuerGrant`, ADMIN_ONLY） |

---

## 下流の画面レシピ

### マイページ（申請 → 発行）

```typescript
import {
  useMyCouponIssuer, useApplyCouponIssuerGrant, useIssueMyCoupon, useMyIssuedCoupons,
} from "@/features/core/couponIssuerGrant/hooks/useMyCouponIssuer";

const { status, isLoading } = useMyCouponIssuer();
const { apply, isApplying } = useApplyCouponIssuerGrant();
const { issue, isIssuing } = useIssueMyCoupon();

// status.grant == null            → 申請ボタン（apply({ ...申請フォーム })）
// status.grant.status === "pending"   → 審査中表示
// status.grant.status === "rejected"  → 却下表示 + 再申請ボタン
// status.grant.status === "approved"  → status.currentCoupon ? コード表示 : 発行ボタン（issue()）
// status.grant.status === "suspended" → 停止中表示
// status.programEnabled === false     → 発行ボタンを出さない（申請のみ受け付ける運用も可）
```

ボタンは `isApplying` / `isIssuing` でローディングを可視化する（async_feedback 必須ルール）。

### 管理画面（申請管理）

- 一覧: 汎用 `useSearchCouponIssuerGrant` 相当は生成していないので、`/api/coupon-issuer-grant/search` を ClientService 経由で叩く（`where: { field: "status", op: "eq", value: "pending" }`）。ユーザー情報は `withRelations` 未定義のため `user_id` から別途解決する
- 審査: `PATCH /api/admin/coupon-issuer-grants/[id]` に `{ action: "approve", settings: { monthlyMaxUses, discountRate, rewardRate }, adminNote }`
- 設定変更: `{ action: "update_settings", settings }` → 当期クーポンへ即時反映（`buildCouponPatch` 定義時）
- `/admin/coupons/affiliate` の「準備中」プレースホルダは、この基盤を使った一覧に下流で差し替える

### 報酬との組み合わせ

発行されたクーポンが使われたときの発行者への報酬は `couponAttributionReward`（`grant()` を `onRedeemed` から呼ぶ）で付与する。報酬率などは `coupon.settings`（`buildIssueParams` で埋める）から読むのが単純。→ `src/features/core/couponAttributionReward/README.md`

---

## 通知（内蔵しない）

承認 / 却下 / 停止の本人通知は下流が管理ルートの呼び出し後に `notificationService.sendToUserSafe` で送る（テンプレートや文言は下流所有）。

---

## 関連

- `coupon`: `issueCodeForOwner`（settings 対応）、`getCodesByOwner`（limit / order 対応）、自己消込ガード
- `couponAttributionReward`: 消込時の発行者報酬
- `bankTransferReview`: 申請 / 審査の状態遷移パターンの先例
