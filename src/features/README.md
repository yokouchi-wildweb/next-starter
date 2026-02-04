# features/

ドメイン別の機能を格納するディレクトリ。各ドメインは `domain.json` を持ち、コード生成の設定を定義する。

---

## domain.json スキーマ定義

### トップレベルプロパティ

| プロパティ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| domainConfigVersion | string | 🟢 Yes | 設定バージョン（現在 `"1.2"`） |
| singular | string | 🟢 Yes | ドメイン名単数形（snake_case、例: `sample_category`） |
| plural | string | 🟢 Yes | ドメイン名複数形（snake_case、例: `sample_categories`） |
| label | string | 🟢 Yes | 管理画面での表示名（日本語可） |
| dbEngine | `"Neon"` \| `"Firestore"` | 🟢 Yes | 使用するDB |
| idType | `"uuid"` \| `"string"` \| `"number"` | 🟢 Yes | 主キーの型 |
| relations | Relation[] | 🟢 Yes | リレーション定義（空配列可） |
| useCreatedAt | boolean | 🟢 Yes | createdAt カラムの有無 |
| useUpdatedAt | boolean | 🟢 Yes | updatedAt カラムの有無 |
| useSoftDelete | boolean | ⚪ No | 論理削除の有無（deletedAt カラム） |
| fields | Field[] | 🟢 Yes | フィールド定義 |
| searchFields | string[] | ⚪ No | 検索対象フィールド名の配列 |
| defaultOrderBy | [string, "ASC" \| "DESC"][] | ⚪ No | デフォルトソート順 |
| tableFields | string[] | ⚪ No | 管理画面テーブルに表示するフィールド |
| useDetailModal | boolean | ⚪ No | 詳細モーダルの有無 |
| addToAdminDataMenu | boolean | ⚪ No | adminDataMenu への自動追加 |
| useDuplicateButton | boolean | ⚪ No | 複製ボタンの有無 |
| useImportExport | boolean | ⚪ No | データ入出力機能の有無（CSV/ZIP形式） |
| useAutoSave | boolean | ⚪ No | 編集フォームでオートセーブを使用するか |
| compositeUniques | string[][] | ⚪ No | 複合ユニーク制約（Neon のみ） |
| generateFiles | GenerateFiles | 🟢 Yes | 生成対象ファイルの設定 |

---

### Relation（リレーション定義）

| プロパティ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| domain | string | 🟢 Yes | 関連先ドメイン名（snake_case） |
| label | string | 🟢 Yes | 表示名 |
| fieldName | string | 🟢 Yes | フィールド名（例: `category_id`, `tag_ids`） |
| fieldType | `"uuid"` \| `"string"` \| `"number"` | 🟢 Yes | 外部キーの型 |
| relationType | RelationType | 🟢 Yes | リレーション種別 |
| required | boolean | ⚪ No | 必須かどうか（belongsTo のみ有効） |
| onDelete | `"RESTRICT"` \| `"CASCADE"` \| `"SET_NULL"` | ⚪ No | 削除時の挙動（belongsTo のみ） |
| includeRelationTable | boolean | ⚪ No | 中間テーブル定義を含めるか（belongsToMany のみ） |
| labelField | string | ⚪ No | セレクトボックスのラベルに使うフィールド（デフォルト: `name`） |

#### RelationType

| 値 | 説明 | Neon | Firestore |
|----|------|------|-----------|
| belongsTo | N:1 参照 | ○ | ○ |
| hasMany | 1:N 子リスト | ○ | ○ |
| hasOne | 1:1 | ○ | ○ |
| belongsToMany | M:N 多対多 | ○ | × |

---

### Field（フィールド定義）

| プロパティ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| name | string | 🟢 Yes | フィールド名（snake_case） |
| label | string | 🟢 Yes | 表示名 |
| fieldType | FieldType | 🟢 Yes | データ型 |
| formInput | FormInput | 🟢 Yes | フォーム入力種別 |
| required | boolean | ⚪ No | 必須かどうか |
| readonly | boolean | ⚪ No | 読み取り専用（textInput, numberInput, textarea のみ） |
| defaultValue | any | ⚪ No | デフォルト値 |
| options | Option[] | ⚪ No | 選択肢（select, radio, checkbox, multiSelect で使用） |
| displayType | `"standard"` \| `"bookmark"` | ⚪ No | radio/checkbox の表示スタイル |
| placeholder | string | ⚪ No | プレースホルダー（textInput, numberInput, textarea, select, multiSelect, emailInput, passwordInput で使用） |

#### FieldType（Neon）

| 値 | 説明 |
|---|---|
| string | 文字列 |
| integer | 整数 |
| float | 浮動小数 |
| boolean | 真偽値 |
| enum | 列挙型 |
| date | 日付 |
| time | 時刻 |
| timestamp With Time Zone | タイムゾーン付き日時 |
| email | メールアドレス |
| password | パスワード |
| bigint | 64bit整数 |
| numeric(10,2) | 固定小数（精度10、スケール2） |
| uuid | UUID |
| Point | 座標点 |
| jsonb | JSONオブジェクト |
| array | 配列 |
| mediaUploader | メディアアップロード用 |

#### FieldType（Firestore）

| 値 | 説明 |
|---|---|
| string | 文字列 |
| number | 数値 |
| boolean | 真偽値 |
| timestamp | 日時 |
| email | メールアドレス |
| password | パスワード |
| array | 配列 |
| geopoint | 緯度経度 |
| reference | ドキュメント参照 |
| map | オブジェクト |
| null | null値 |
| mediaUploader | メディアアップロード用 |

#### FormInput

| 値 | 説明 |
|---|---|
| textInput | 1行テキスト |
| numberInput | 数値入力 |
| textarea | 複数行テキスト |
| select | 単一選択セレクト |
| multiSelect | 複数選択セレクト |
| radio | ラジオボタン |
| checkbox | チェックボックス |
| stepperInput | 数値ステッパー |
| switchInput | スイッチ |
| dateInput | 日付入力 |
| timeInput | 時刻入力 |
| datetimeInput | 日時入力 |
| emailInput | メール入力 |
| passwordInput | パスワード入力 |
| mediaUploader | メディアアップロード |
| hidden | 非表示入力 |
| none | 入力なし（フォームに出さない、スキーマからも除外） |
| custom | カスタムUI（スキーマには含める、UIは自分で実装） |

#### none vs custom の違い

| 項目 | none | custom |
|------|------|--------|
| Zodスキーマ | 除外 | 含める |
| フォームデータ | 含まない | 含む |
| UI描画 | なし | なし（自分で実装） |
| 用途 | DBのみで使うフィールド | 独自UIで入力するフィールド |

#### custom の使い方

`formInput: "custom"` を指定したフィールドは、FieldRenderer では何も描画されない。
代わりに `beforeField` / `afterField` props で独自コンポーネントを挿入する。

**推奨: `FieldItem` を使う**

統一感を保つため、`src/components/Form/Field/Controlled/FieldItem` を使用する。
以下が自動で統一される:
- ラベル・必須マーク
- エラーメッセージ表示
- 説明テキスト
- レイアウト（vertical/horizontal）
- オートセーブ対応

```tsx
// domain.json
{ "name": "custom_field", "fieldType": "string", "formInput": "custom" }

// フォームコンポーネント
import { FieldItem } from "@/components/Form/Field";

<FieldRenderer
  control={control}
  methods={methods}
  baseFields={fields}
  beforeField={{
    custom_field: (
      <FieldItem
        control={control}
        name="custom_field"
        label="カスタムフィールド"
        required
        renderInput={(field, inputClassName) => (
          <MyCustomInput {...field} className={inputClassName} />
        )}
      />
    )
  }}
/>
```

**Field層の構成**

| 層 | パス | 用途 |
|----|------|------|
| Configured | `Form/Field/Configured/` | FieldConfigベース（生成コード向け） |
| Controlled | `Form/Field/Controlled/` | control + renderInput（**custom で推奨**） |
| Manual | `Form/Field/Manual/` | controlなし（完全手動） |

#### Option

```json
{ "value": "apple", "label": "りんご" }
```

- value: 保存される値（string, number, boolean）
- label: 表示テキスト

---

### MediaUploader フィールド追加プロパティ

| プロパティ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| uploadPath | string | 🟢 Yes | アップロード先パス（例: `sample/main`） |
| slug | string | 🟢 Yes | ハンドラ識別子（camelCase） |
| mediaTypePreset | `"images"` \| `"videos"` \| `"imagesAndVideos"` \| `"all"` | 🟢 Yes | 許可ファイル種別 |
| accept | string | 🟢 Yes | accept 属性値（例: `image/*,video/*`） |
| validationRule | object | ⚪ No | バリデーション設定 |
| validationRule.maxSizeBytes | number | ⚪ No | 最大ファイルサイズ（バイト） |
| helperText | string | ⚪ No | ヘルパーテキスト（アップロード欄に表示される説明文） |
| metadataBinding | object | ⚪ No | メタデータを別フィールドに保存 |

#### metadataBinding キー

```
sizeBytes, width, height, aspectRatio, orientation,
mimeType, src, durationSec, durationFormatted
```

---

### compositeUniques（複合ユニーク制約）

**Neon (PostgreSQL/Drizzle) 専用機能**。Firestore では利用不可。

複数フィールドの組み合わせでユニーク制約を設定する場合に使用。

```json
{
  "compositeUniques": [
    ["name", "type", "category_id"],
    ["email", "organization_id"]
  ]
}
```

- 各配列は1つの複合ユニーク制約を表す
- フィールド名または belongsTo リレーションの fieldName を指定可能
- `useSoftDelete: true` の場合、`WHERE deleted_at IS NULL` の部分インデックスとして生成
- CRUD 操作時に制約違反があると 409 エラーを返す

生成されるインデックス名: `{テーブル名}_composite_unique_{連番}`

---

### GenerateFiles

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| entities | boolean | エンティティ（schema, form, model, drizzle/firestore） |
| components | boolean | 管理画面コンポーネント |
| hooks | boolean | CRUD フック |
| clientServices | boolean | axios クライアント |
| serverServices | boolean | サーバーサービス |
| adminRoutes | boolean | 管理画面ルート |
| registry | boolean | レジストリへの登録 |
| fieldConstants | boolean | options を持つフィールドの定数/型 |
| presenters | boolean | テーブル表示用フォーマッタ |

---

## サンプル

最小構成:

```json
{
  "domainConfigVersion": "1.2",
  "singular": "category",
  "plural": "categories",
  "label": "カテゴリ",
  "dbEngine": "Neon",
  "idType": "uuid",
  "relations": [],
  "useCreatedAt": true,
  "useUpdatedAt": true,
  "fields": [
    {
      "name": "name",
      "label": "名前",
      "fieldType": "string",
      "formInput": "textInput",
      "required": true
    }
  ],
  "generateFiles": {
    "entities": true,
    "components": true,
    "hooks": true,
    "clientServices": true,
    "serverServices": true,
    "adminRoutes": true,
    "registry": true,
    "fieldConstants": true,
    "presenters": true
  }
}
```

全機能の実装例は `src/features/sample/domain.json` を参照。

---

## 関連コマンド

| コマンド | 説明 |
|----------|------|
| `npm run dc:init` | 対話形式で domain.json を作成 |
| `npm run dc:generate -- <Domain>` | ファイル生成 |
| `npm run dc:generate:all` | 全ドメイン一括生成 |
| `npm run dc:add -- <Domain>` | フィールド追加 |
| `npm run dc:delete -- <Domain>` | ドメイン削除 |
