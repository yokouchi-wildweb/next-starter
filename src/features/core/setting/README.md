# Setting ドメイン

アプリケーション全体の設定を管理するコアドメイン。
**セクション駆動アーキテクチャ**で、新しい設定カテゴリは `setting.sections.ts` にエントリを1つ追加するだけで管理画面・メニューが自動生成される。

## 概要

- **シングルトンパターン**: 設定は `id: "global"` の 1 レコードのみ
- **ハイブリッド構成**: 基本項目（固定カラム） + 拡張項目（`setting.extended.ts` の Zod 定義、`extended` jsonb カラムに格納）
- **セクション駆動 UI**: `setting.sections.ts` のカタログから、ページ / メニュー / フォームを動的生成

---

## ディレクトリ構造

```
src/features/core/setting/
├── setting.extended.ts                       # 拡張設定項目の Zod スキーマ
├── setting.sections.ts                       # セクション定義（管理UI のカタログ）
├── menu.ts                                   # セクションから管理メニューを組み立てる helper
├── entities/
│   ├── index.ts, drizzle.ts, schema.ts, model.ts, form.ts
│   ├── schema.extended.ts, model.extended.ts, form.extended.ts
├── services/
│   ├── client/settingClient.ts, adminSetupClient.ts
│   ├── server/drizzleBase.ts, settingService.ts
│   └── types.ts
├── hooks/useSetting.ts, useUpdateSetting.ts, useAdminSetup.ts
└── components/
    ├── common/EditSettingSectionForm.tsx     # セクション駆動の汎用フォーム
    ├── AdminSettingSectionEdit/              # 管理画面: 設定編集ラッパ
    └── AdminSetup/                           # 管理画面: 初期セットアップ
```

管理画面のルートは `src/app/admin/(protected)/settings/` 配下の 1 動的ルート `[section]/page.tsx` で全セクションを賄う。

---

## 基本設定項目（固定カラム）

| 項目名 | DB列名 | 型 | 説明 |
|--------|--------|-----|------|
| `adminListPerPage` | `admin_list_per_page` | integer | 一覧表示件数（デフォルト: 50） |
| `maintenanceEnabled` | `extended` jsonb | boolean | メンテナンスモード有効フラグ |
| `maintenanceStartAt` | `extended` jsonb | date \| null | メンテナンス開始日時 |
| `maintenanceEndAt` | `extended` jsonb | date \| null | メンテナンス終了日時 |

固定カラムは `entities/schema.ts` と `entities/drizzle.ts` で定義されており、変更する場合は手動編集が必要。

---

## 設定カテゴリ（セクション）の追加方法

### 手順

1. **スキーマを `setting.extended.ts` に追加（必要な場合）**

```ts
// src/features/core/setting/setting.extended.ts
export const settingExtendedSchema = z.object({
  // 既存
  maintenanceEnabled: z.coerce.boolean().default(false),
  // 追加
  siteTitle: z.string().default(""),
  seoDescription: z.string().default(""),
});
```

2. **`setting.sections.ts` にセクションを追加**

```ts
// src/features/core/setting/setting.sections.ts
export const settingSections: SettingSectionMap = {
  // 既存 general, maintenance …

  seo: {
    label: "SEO 設定",
    order: 30,
    icon: Search,
    fields: [
      { name: "siteTitle", label: "サイトタイトル", formInput: "textInput" },
      { name: "seoDescription", label: "ディスクリプション", formInput: "textarea" },
    ],
  },
};
```

これだけ。以下は **すべて自動**：

- 管理メニュー「システム設定」配下に「SEO 設定」が追加される
- `/admin/settings/seo` ページが動作する
- 入力UI は `formInput` に従って `FieldRenderer` が生成する
- 保存処理は既存の `useUpdateSetting` を流用

### バリデーション

- **Zod**: 真実のソースは `setting.extended.ts`。バリデーションやデフォルト値はここだけで定義
- **UI 定義との整合性**: 起動時に `validateSectionFields` がセクション定義のフィールド名が Zod スキーマに存在することを検証。不整合があれば throw

### 入力UIの種類

`formInput` に指定可能な値（FieldRenderer のサポート分）:

`textInput`, `numberInput`, `textarea`, `select`, `multiSelect`, `combobox`,
`radio`, `checkbox`, `stepperInput`, `switchInput`, `dateInput`, `timeInput`,
`datetimeInput`, `emailInput`, `passwordInput`, `colorInput`, `mediaUploader`,
`hidden`, `none`, `custom`, `asyncCombobox`, `asyncMultiSelect`

詳細は `src/components/Form/Field/types.ts` を参照。

### カスタムUI

`formInput: "custom"` を使う、または `fieldGroups` / `inlineGroups` を指定してレイアウトを調整する。より複雑なケースはセクション定義を書き換えず、そのセクション専用のページを独自に作ってもよい（動的ルートと共存可能）。

### セクションの権限制御

`allowRoles` を指定すると、そのロールのみがメニューに表示・ページにアクセス可能になる。

```ts
security: {
  label: "セキュリティ",
  order: 50,
  allowRoles: ["super_admin"],
  fields: [ ... ],
},
```

---

## 使用方法

### 設定を取得する（サーバーサイド）

```typescript
import { settingService } from "@/features/core/setting/services/server/settingService";

const setting = await settingService.getGlobalSetting();
setting.adminListPerPage;        // 基本項目
setting.maintenanceEnabled;      // 拡張項目（フラットアクセス）

// メンテナンス中かどうか
const inMaintenance = await settingService.isMaintenanceActive();
```

### 設定を取得する（クライアントサイド）

```typescript
import { useSetting } from "@/features/core/setting/hooks/useSetting";

const { data: setting, isLoading, error } = useSetting();
```

### 設定を更新する（通常は自動。個別呼び出しする場合）

```typescript
import { useUpdateSetting } from "@/features/core/setting/hooks/useUpdateSetting";

const { trigger, isMutating } = useUpdateSetting();
await trigger({ id: "global", data: { /* 更新内容 */ } });
```

> ⚠️ **注意**: `extended` jsonb カラムは**部分更新ができず全置換**になる。`EditSettingSectionForm` は defaultValues に全フィールドを読み込むことでこの問題を吸収している。独自に `trigger` を呼ぶ場合も、保持したいフィールドは全て `data` に含める必要がある。

---

## APIエンドポイント

| メソッド | パス | 説明 |
|----------|------|------|
| GET | `/api/setting/global` | 設定取得 |
| PATCH | `/api/setting/global` | 設定更新 |
| POST | `/api/admin/setup` | 初期セットアップ |

---

## アーキテクチャ

### スキーマ統合（entities/index.ts）

```typescript
export const SettingCombinedBaseSchema = SettingBaseSchema.merge(SettingExtendedBaseSchema);
export const SettingCombinedUpdateSchema = SettingUpdateSchema.merge(SettingExtendedBaseSchema.partial());
```

### デフォルト値の統合（settingService.ts）

```typescript
const createDefaultSettingValues = () => ({
  adminListPerPage: DEFAULT_ADMIN_LIST_PER_PAGE,
  ...getZodDefaults(settingExtendedSchema),
});
```

### セクションカタログ → 管理UI の流れ

```
setting.sections.ts
       │
       ├─ setting/menu.ts ─────► admin-global-menu.config.ts （メニュー items）
       │                              │
       │                              └─► BaseSidebar がロール別にフィルタ
       │
       └─ app/admin/(protected)/settings/[section]/page.tsx
              │
              ├─ section.allowRoles で authGuard
              └─ AdminSettingSectionEdit → EditSettingSectionForm
                      │
                      └─► FieldRenderer（baseFields = section.fields）
```

---

## 関連ファイル

- `src/lib/zod/getZodDefaults.ts` — Zod スキーマからデフォルト値を抽出
- `src/components/Form/FieldRenderer/` — セクションフィールドを描画する汎用レンダラ
- `docs/how-to/システム設定セクションの追加方法.md` — 旧構造からの移行ガイドと追加手順
