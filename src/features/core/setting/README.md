# Setting ドメイン

アプリケーション全体の設定を管理するコアドメイン。
基本設定項目は固定で、追加の設定項目は `setting.extended.ts` で直接定義する。

## 概要

- **シングルトンパターン**: 設定は `id: "global"` の1レコードのみ
- **ハイブリッド構成**: 基本項目（固定） + 拡張項目（`setting.extended.ts` で定義）
- **1ファイル完結**: 拡張設定項目の追加は `setting.extended.ts` を編集するだけ

---

## ディレクトリ構造

```
src/features/core/setting/
├── setting.extended.ts                 # 拡張設定項目の定義（ダウンストリームが編集する唯一のファイル）
├── entities/
│   ├── index.ts                        # エクスポート集約・統合スキーマ
│   ├── drizzle.ts                      # DBスキーマ
│   ├── schema.ts                       # 基本Zodスキーマ（固定）
│   ├── schema.extended.ts              # 拡張Zodスキーマ（setting.extended.ts を再エクスポート）
│   ├── model.ts                        # 基本型定義（固定）
│   ├── model.extended.ts               # 拡張型定義（setting.extended.ts から導出）
│   ├── form.ts                         # 基本フォーム型
│   └── form.extended.ts                # 拡張フォーム型（setting.extended.ts から導出）
├── services/
│   ├── client/
│   │   ├── settingClient.ts            # 設定取得・更新API
│   │   └── adminSetupClient.ts         # 初期セットアップAPI
│   ├── server/
│   │   ├── drizzleBase.ts              # CRUD基本操作
│   │   └── settingService.ts           # ビジネスロジック
│   └── types.ts                        # サービス層の型定義
├── hooks/
│   ├── useSetting.ts                   # 設定取得Hook
│   ├── useUpdateSetting.ts             # 設定更新Hook
│   └── useAdminSetup.ts                # 初期セットアップHook
└── components/
    ├── common/
    │   ├── SettingForm.tsx              # フォームコンテナ（children で拡張UI）
    │   ├── SettingFields.tsx            # 基本設定フィールド
    │   └── EditSettingForm.tsx          # 編集フォーム統合
    ├── AdminSettingEdit/               # 管理画面：設定編集
    └── AdminSetup/                     # 管理画面：初期セットアップ
```

---

## 基本設定項目（固定）

| 項目名 | DB列名 | 型 | 説明 |
|--------|--------|-----|------|
| `adminListPerPage` | `admin_list_per_page` | integer | 一覧表示件数（デフォルト: 50） |

これらの項目は `entities/schema.ts` と `entities/drizzle.ts` で直接定義されており、変更する場合は手動編集が必要。

---

## 拡張設定項目の追加方法

### 手順

**`setting.extended.ts` を編集するだけ。** DBマイグレーション不要。

```ts
// src/features/core/setting/setting.extended.ts
import { z } from "zod";

export const settingExtendedSchema = z.object({
  // ここにフィールドを追加するだけ
  siteTitle: z.string().nullish(),
  maintenanceMode: z.coerce.boolean().default(false),
  consumptionRewardEnabled: z.coerce.boolean().default(false),
  consumptionRewardCoinsPerUnitMin: z.coerce.number().int().default(0),
  consumptionRewardCoinsPerUnitMax: z.coerce.number().int().default(0),
  bonusTiers: z.array(z.object({
    threshold: z.number(),
    multiplier: z.number(),
  })).default([]),
});

export type SettingExtended = z.infer<typeof settingExtendedSchema>;
```

### 何が自動的に行われるか

- **バリデーション**: Zod のメソッドチェーンで定義したルールがそのまま適用される
- **デフォルト値**: `.default()` で指定した値が `getGlobalSetting()` で自動適用される
- **TypeScript 型**: `z.infer<typeof settingExtendedSchema>` で自動導出される
- **スキーマ統合**: `SettingCombinedUpdateSchema` に自動マージされる

### サポートするフィールド例

```ts
// プリミティブ型
name: z.string().nullish(),
count: z.coerce.number().int().default(0),
enabled: z.coerce.boolean().default(false),

// enum
theme: z.enum(["light", "dark"]).default("light"),

// 配列
tags: z.array(z.string()).default([]),

// ネストオブジェクト（jsonb）
config: z.object({
  key: z.string(),
  value: z.number(),
}).default({ key: "", value: 0 }),

// 可変長構造化データ（jsonb）
tiers: z.array(z.object({
  threshold: z.number(),
  multiplier: z.number(),
})).default([]),
```

---

## UI のカスタマイズ

`SettingForm` は `children` プロパティで拡張UIを受け取る。
セクション分け、条件付き表示、JSON編集など自由に構成できる。

```tsx
import { SettingForm } from "./SettingForm";
import { ControlledField } from "@/components/Form";
import { SwitchInput, TextInput } from "@/components/Form/Input/Controlled";

<SettingForm methods={methods} onSubmitAction={submit} submitLabel="更新">
  {/* セクション分け */}
  <Section title="基本設定">
    <ControlledField name="siteTitle" label="サイトタイトル"
      renderInput={(field) => <TextInput field={field} />} />
  </Section>

  {/* 条件付き表示（フィールド間の依存関係） */}
  <Section title="消費報酬設定">
    <ControlledField name="consumptionRewardEnabled" label="消費報酬"
      renderInput={(field) => <SwitchInput field={field} />} />
    {watch("consumptionRewardEnabled") && (
      <>
        <ControlledField name="consumptionRewardCoinsPerUnitMin" label="最小コイン数"
          renderInput={(field) => <TextInput field={field} type="number" />} />
        <ControlledField name="consumptionRewardCoinsPerUnitMax" label="最大コイン数"
          renderInput={(field) => <TextInput field={field} type="number" />} />
      </>
    )}
  </Section>

  {/* カスタムJSON編集UI */}
  <Section title="ボーナス設定">
    <BonusTierEditor control={control} />
  </Section>
</SettingForm>
```

---

## 使用方法

### 設定を取得する（サーバーサイド）

```typescript
import { settingService } from "@/features/core/setting/services/server/settingService";

// グローバル設定を取得（拡張項目もフラットにアクセス可能）
const setting = await settingService.getGlobalSetting();
setting.adminListPerPage;        // 基本項目
setting.maintenanceMode;         // 拡張項目（フラットアクセス）
setting.bonusTiers;              // jsonb 項目も同様

// 一覧表示件数を取得
const perPage = await settingService.getAdminListPerPage();
```

### 設定を取得する（クライアントサイド）

```typescript
import { useSetting } from "@/features/core/setting/hooks/useSetting";

function MyComponent() {
  const { data: setting, isLoading, error } = useSetting();
  if (isLoading) return <div>Loading...</div>;
  return <div>{setting.maintenanceMode ? "メンテナンス中" : "稼働中"}</div>;
}
```

### 設定を更新する（クライアントサイド）

```typescript
import { useUpdateSetting } from "@/features/core/setting/hooks/useUpdateSetting";

function EditForm() {
  const { trigger, isMutating } = useUpdateSetting();
  const handleSubmit = async (data) => {
    await trigger({ id: "global", data });
  };
}
```

---

## APIエンドポイント

| メソッド | パス | 説明 |
|----------|------|------|
| GET | `/api/setting/global` | 設定取得 |
| PATCH | `/api/setting/global` | 設定更新 |
| POST | `/api/admin/setup` | 初期セットアップ |

---

## アーキテクチャ

### スキーマ統合

```typescript
// entities/index.ts
// 基本スキーマと拡張スキーマをマージ
export const SettingCombinedBaseSchema = SettingBaseSchema.merge(SettingExtendedBaseSchema);
export const SettingCombinedUpdateSchema = SettingUpdateSchema.merge(SettingExtendedBaseSchema.partial());
```

### デフォルト値の統合

```typescript
// services/server/settingService.ts
import { getZodDefaults } from "@/lib/zod";
import { settingExtendedSchema } from "../../setting.extended";

const createDefaultSettingValues = () => ({
  adminListPerPage: DEFAULT_ADMIN_LIST_PER_PAGE,
  ...getZodDefaults(settingExtendedSchema), // .default() から自動抽出
});
```

---

## 関連ファイル

- `src/lib/zod/getZodDefaults.ts` — Zod スキーマからデフォルト値を抽出するユーティリティ
- `CLAUDE.md` の Setting 関連セクション
