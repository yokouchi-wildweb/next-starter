# Setting ドメイン

アプリケーション全体の設定を管理するコアドメイン。
基本設定項目は固定で、追加の設定項目は `setting-fields.json` からコード生成される。

## 概要

- **シングルトンパターン**: 設定は `id: "global"` の1レコードのみ
- **ハイブリッド構成**: 基本4項目（固定） + 拡張項目（JSON定義から生成）
- **自動コード生成**: Setting Config CLI (`sc:*`) でスキーマ・UI・型を自動生成

---

## ディレクトリ構造

```
src/features/core/setting/
├── setting-fields.json              # 拡張設定項目の定義ファイル
├── entities/
│   ├── index.ts                     # エクスポート集約・統合スキーマ
│   ├── drizzle.ts                   # DBスキーマ（基本+拡張カラム）
│   ├── schema.ts                    # 基本Zodスキーマ（固定）
│   ├── schema.extended.ts           # [生成] 拡張Zodスキーマ
│   ├── model.ts                     # 基本型定義（固定）
│   ├── model.extended.ts            # [生成] 拡張型定義
│   ├── form.ts                      # 基本フォーム型
│   └── form.extended.ts             # [生成] 拡張フォーム型
├── services/
│   ├── client/
│   │   ├── settingClient.ts         # 設定取得・更新API
│   │   └── adminSetupClient.ts      # 初期セットアップAPI
│   ├── server/
│   │   ├── drizzleBase.ts           # CRUD基本操作
│   │   ├── settingService.ts        # ビジネスロジック
│   │   └── settingDefaults.extended.ts  # [生成] 拡張デフォルト値
│   └── types.ts                     # サービス層の型定義
├── hooks/
│   ├── useSetting.ts                # 設定取得Hook
│   ├── useUpdateSetting.ts          # 設定更新Hook
│   └── useAdminSetup.ts             # 初期セットアップHook
└── components/
    ├── common/
    │   ├── SettingForm.tsx          # フォームコンテナ（FieldRenderer使用）
    │   ├── SettingFields.tsx        # 基本設定フィールド
    │   └── EditSettingForm.tsx      # 編集フォーム統合
    ├── AdminSettingEdit/            # 管理画面：設定編集
    └── AdminSetup/                  # 管理画面：初期セットアップ
```

`[生成]` マークのファイルは `pnpm sc:generate` で自動生成される。

---

## 基本設定項目（固定）

| 項目名 | DB列名 | 型 | 説明 |
|--------|--------|-----|------|
| `adminHeaderLogoImageUrl` | `admin_header_logo_image_url` | text | 管理画面ロゴ（ライトモード） |
| `adminHeaderLogoImageDarkUrl` | `admin_header_logo_image_dark_url` | text | 管理画面ロゴ（ダークモード） |
| `adminListPerPage` | `admin_list_per_page` | integer | 一覧表示件数（デフォルト: 50） |

これらの項目は `entities/schema.ts` と `entities/drizzle.ts` で直接定義されており、変更する場合は手動編集が必要。

> **Note**: フッターテキストは `src/config/business.config.ts` の `serviceName` を使用。

---

## 拡張設定項目（カスタマイズ可能）

### setting-fields.json

追加の設定項目は `setting-fields.json` で定義する。

```json
{
  "settingConfigVersion": "1.0",
  "fields": [
    {
      "name": "siteTitle",
      "label": "サイトタイトル",
      "fieldType": "string",
      "formInput": "textInput",
      "required": false,
      "defaultValue": "",
      "description": "サイトのタイトルを設定します"
    },
    {
      "name": "maintenanceMode",
      "label": "メンテナンスモード",
      "fieldType": "boolean",
      "formInput": "switchInput",
      "required": false,
      "defaultValue": false,
      "description": "有効にするとサイトが一時停止します"
    },
    {
      "name": "themeColor",
      "label": "テーマカラー",
      "fieldType": "enum",
      "formInput": "select",
      "defaultValue": "blue",
      "options": [
        { "value": "blue", "label": "ブルー" },
        { "value": "green", "label": "グリーン" },
        { "value": "red", "label": "レッド" }
      ]
    },
    {
      "name": "ogImageUrl",
      "label": "OGP画像",
      "fieldType": "mediaUploader",
      "formInput": "mediaUploader",
      "uploadPath": "setting/og",
      "accept": "image/*"
    }
  ]
}
```

### フィールド定義スキーマ

| プロパティ | 必須 | 説明 |
|-----------|------|------|
| `name` | ○ | フィールド名（camelCase） |
| `label` | ○ | 表示ラベル（日本語） |
| `fieldType` | ○ | データ型（下記参照） |
| `formInput` | ○ | フォーム入力タイプ（下記参照） |
| `required` | - | 必須項目かどうか（デフォルト: false） |
| `defaultValue` | - | デフォルト値 |
| `description` | - | フィールドの説明（UIに表示） |
| `options` | enum時必須 | 選択肢の配列 `[{ value, label }]` |
| `uploadPath` | mediaUploader時 | アップロード先パス |
| `accept` | mediaUploader時 | 許可するファイルタイプ |

### サポートするfieldType

| fieldType | Drizzle型 | TypeScript型 | Zod型 |
|-----------|-----------|--------------|-------|
| `string` | `text` | `string` | `z.string()` |
| `integer` | `integer` | `number` | `z.coerce.number().int()` |
| `float` | `doublePrecision` | `number` | `z.coerce.number()` |
| `boolean` | `boolean` | `boolean` | `z.coerce.boolean()` |
| `enum` | `pgEnum` | union型 | `z.enum([...])` |
| `date` | `date` | `string` | `z.string()` |
| `timestamp` | `timestamp` | `Date` | `z.coerce.date()` |
| `mediaUploader` | `text` | `string` | `z.string()` |

### サポートするformInput

| formInput | コンポーネント | 用途 |
|-----------|--------------|------|
| `textInput` | `TextInput` | 1行テキスト入力 |
| `textarea` | `Textarea` | 複数行テキスト入力 |
| `numberInput` | `TextInput` (type=number) | 数値入力 |
| `switchInput` | `SwitchInput` | ON/OFFスイッチ |
| `select` | `SelectInput` | ドロップダウン選択 |
| `radio` | `RadioGroup` | ラジオボタン |
| `dateInput` | `DateInput` | 日付選択 |
| `datetimeInput` | `DatetimeInput` | 日時選択 |
| `mediaUploader` | `ControlledMediaUploader` | ファイルアップロード |
| `custom` | （独自実装） | カスタムUIを使用 |

### custom formInput の使い方

`formInput: "custom"` を指定したフィールドは、スキーマには含まれるがUIは描画されない。
`SettingForm` の `beforeField` / `afterField` props で独自コンポーネントを挿入する。

```tsx
<SettingForm
  methods={methods}
  onSubmitAction={submit}
  submitLabel="更新"
  beforeField={{
    customField: (
      <ControlledField
        control={methods.control}
        name="customField"
        label="カスタムフィールド"
        renderInput={(field) => <MyCustomInput {...field} />}
      />
    )
  }}
/>
```

---

## Setting Config CLI

設定項目の管理用CLIツール。

### コマンド一覧

```bash
# テンプレート生成
pnpm sc:init                    # 空のsetting-fields.jsonを生成
pnpm sc:init -- --samples       # サンプルフィールド付きで生成

# ファイル生成
pnpm sc:generate                # 拡張ファイルを一括生成

# 一覧表示
pnpm sc:list                    # 全設定項目を表示
pnpm sc:list -- --extended      # 拡張項目のみ
pnpm sc:list -- --base          # 基本項目のみ
pnpm sc:list -- --json          # JSON形式で出力

# 対話形式での追加・削除
pnpm sc:add                     # フィールドを対話形式で追加
pnpm sc:remove                  # フィールドを対話形式で削除
pnpm sc:remove -- --name xxx    # 指定フィールドを削除
```

### 生成されるファイル

| ファイル | 内容 |
|----------|------|
| `entities/schema.extended.ts` | 拡張Zodスキーマ |
| `entities/model.extended.ts` | 拡張TypeScript型 |
| `entities/form.extended.ts` | 拡張フォーム型 |
| `entities/drizzle.ts` | DBスキーマ（拡張カラム追記） |
| `services/server/settingDefaults.extended.ts` | 拡張デフォルト値 |

> **Note**: UIコンポーネントは `SettingForm.tsx` が `setting-fields.json` を直接読み込んで `FieldRenderer` でレンダリングする。

---

## 使用方法

### 設定項目を追加する手順

```bash
# 1. 対話形式でフィールドを追加
pnpm sc:add

# 2. または setting-fields.json を直接編集

# 3. ファイルを再生成
pnpm sc:generate

# 4. DBマイグレーション
pnpm db:generate
pnpm db:push
```

### 設定を取得する（サーバーサイド）

```typescript
import { settingService } from "@/features/core/setting/services/server/settingService";

// グローバル設定を取得
const setting = await settingService.getGlobalSetting();

// 一覧表示件数を取得
const perPage = await settingService.getAdminListPerPage();
```

### 設定を取得する（クライアントサイド）

```typescript
import { useSetting } from "@/features/core/setting/hooks/useSetting";

function MyComponent() {
  const { data: setting, isLoading, error } = useSetting();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error</div>;

  return <div>{setting.adminListPerPage}</div>;
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

  // ...
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

import { extendedDefaultSettingValues } from "./settingDefaults.extended";

const createDefaultSettingValues = () => ({
  // 基本設定項目
  adminHeaderLogoImageUrl: null,
  adminHeaderLogoImageDarkUrl: null,
  adminListPerPage: 50,
  // 拡張設定項目（自動生成）
  ...extendedDefaultSettingValues,
});
```

### フォーム統合

```tsx
// components/common/SettingForm.tsx

<SettingFields control={control} />           {/* 基本フィールド */}
<FieldRenderer                                {/* 拡張フィールド（setting-fields.json から） */}
  control={control}
  methods={methods}
  baseFields={extendedFields}
  beforeField={beforeField}
  afterField={afterField}
/>
```

---

## 注意事項

### 生成ファイルの編集禁止

以下のファイルは `pnpm sc:generate` で上書きされるため、直接編集しないこと：

- `entities/schema.extended.ts`
- `entities/model.extended.ts`
- `entities/form.extended.ts`
- `services/server/settingDefaults.extended.ts`

カスタマイズが必要な場合は、`setting-fields.json` を編集して再生成する。
カスタムUIが必要な場合は、`formInput: "custom"` を使用し、`beforeField`/`afterField` で独自コンポーネントを挿入する。

### drizzle.ts の更新方式

`entities/drizzle.ts` は部分的に更新される（マーカーコメント方式）：

```typescript
export const settingTable = pgTable("settings", {
  // 基本カラム（変更なし）
  id: text("id").primaryKey(),
  adminHeaderLogoImageUrl: text("admin_header_logo_image_url"),
  // ...

  // === 拡張カラム（自動生成）===
  siteTitle: text("site_title").default(""),
  maintenanceMode: boolean("maintenance_mode").default(false),
  // === 拡張カラム終了 ===
});
```

### フィールド削除時の注意

`pnpm sc:remove` でフィールドを削除しても、DBカラムは自動削除されない。
手動で以下の手順が必要：

1. `drizzle.ts` から該当カラムを手動削除
2. `pnpm db:generate && pnpm db:push` でマイグレーション

---

## 関連ファイル

### スクリプト

```
scripts/setting-config/
├── index.mjs           # CLIエントリポイント
├── init.mjs            # テンプレート生成
├── generate.mjs        # ファイル生成オーケストレーター
├── list.mjs            # 一覧表示
├── add-field.mjs       # フィールド追加
├── remove-field.mjs    # フィールド削除
├── generator/          # 各ファイルのジェネレーター
└── utils/              # ユーティリティ
```

### 参照ドキュメント

- `scripts/setting-config/` 内の各ファイルのJSDocコメント
- `CLAUDE.md` のSetting関連セクション
