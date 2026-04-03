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

> ⚠️ **オプショナルフィールドを追加する場合**: `src/registry/domainConfigRegistry.ts` の `DomainConfigOptionals` にも同じフィールドを追加すること。省略すると、そのフィールドを持たないドメインが存在するだけで DomainConfig の union 型が壊れてビルドエラーになる。

---

### Relation（リレーション定義）

| プロパティ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| domain | string | 🟢 Yes | 関連先ドメイン名（snake_case） |
| label | string | 🟢 Yes | 表示名 |
| fieldName | string | 条件付き | フィールド名。relationType により意味が異なる（後述） |
| fieldType | `"uuid"` \| `"string"` \| `"number"` | 条件付き | 外部キーの型（belongsTo / belongsToMany で必須、hasMany では不要） |
| relationType | RelationType | 🟢 Yes | リレーション種別 |
| required | boolean | ⚪ No | 必須かどうか（belongsTo のみ有効） |
| onDelete | `"RESTRICT"` \| `"CASCADE"` \| `"SET_NULL"` | ⚪ No | 削除時の挙動（belongsTo のみ） |
| includeRelationTable | boolean | ⚪ No | 中間テーブル定義を含めるか（belongsToMany のみ） |
| labelField | string | ⚪ No | セレクトボックスのラベルに使うフィールド（デフォルト: `name`） |
| formInput | RelationFormInput | ⚪ No | フォーム入力種別（省略時はデフォルト値） |

#### RelationType

| 値 | 説明 | Neon | Firestore |
|----|------|------|-----------|
| belongsTo | N:1 参照 | ○ | ○ |
| hasMany | 1:N 子リスト（withRelations で子レコード配列を展開） | ○ | × |
| hasOne | 1:1 | ○ | ○ |
| belongsToMany | M:N 多対多 | ○ | × |

#### fieldName の意味（relationType 別）

| relationType | fieldName の意味 | 例 |
|---|---|---|
| belongsTo | 自テーブルの外部キーカラム名 | `"category_id"` |
| belongsToMany | 自テーブルの配列フィールド名 | `"tag_ids"` |
| hasMany | 管理用の識別名（**子テーブルの FK 生成には使われない**） | `"sample_id"` 等 |

> ⚠️ **hasMany の FK 生成ルール**: 子テーブル側の外部キーカラム名は `親のsingular + "_id"` で自動決定される。例: 親が `gacha_machine` なら子テーブルの FK は `gacha_machine_id`。fieldName の値は直接使われない。

#### hasMany と withRelations

hasMany リレーションを定義すると、`dc:generate` 時に drizzleBase.ts へ `hasManyRelations` 設定が自動生成される。これにより `withRelations: 1` で子レコード配列が親に展開される。

- 親あたりのデフォルト取得上限: 100件
- 呼び出し側で `hasManyLimit` を指定してオーバーライド可能（例: `search({ withRelations: 1, hasManyLimit: 20 })`）
- `withRelations` の depth 上限は 3（`resolveRelationDepth` で制限）
- hasMany はエンティティ・スキーマ・フォームには影響しない（サーバーサービスの読み取り時のみ）

#### RelationFormInput

リレーションフィールドのフォーム入力種別。省略時は relationType に応じたデフォルト値が使われる。hasMany / hasOne にはフォーム入力は適用されない。

| relationType | デフォルト | 指定可能な値 |
|---|---|---|
| belongsTo | `select` | `select`, `combobox`, `asyncCombobox`, `custom` |
| belongsToMany | `checkbox` | `checkbox`, `multiSelect`, `asyncMultiSelect`, `custom` |

- `select` / `checkbox`: 初回に全件取得して選択肢を表示（少量データ向け）
- `combobox` / `multiSelect`: 全件取得 + 検索フィルタ付き（中量データ向け）
- `asyncCombobox` / `asyncMultiSelect`: ユーザー入力時に非同期検索（大量データ向け）
- `custom`: UI は自分で実装。スキーマには含まれるが、自動 UI 描画なし

`asyncCombobox` / `asyncMultiSelect` を指定した場合、リレーション先の `searchFields`（domain.json）が自動的に検索対象として使用される。

`custom` を指定した場合、データ取得は行われず FieldConfig のみ生成される。
`beforeField` / `afterField` で独自コンポーネントを注入する（通常フィールドの `custom` と同じ仕組み）。

#### リレーション定義例

```json
{
  "relations": [
    {
      "domain": "user",
      "label": "担当者",
      "fieldName": "user_id",
      "fieldType": "uuid",
      "relationType": "belongsTo",
      "formInput": "asyncCombobox"
    },
    {
      "domain": "tag",
      "label": "タグ",
      "fieldName": "tag_ids",
      "fieldType": "uuid",
      "relationType": "belongsToMany"
    },
    {
      "domain": "order_item",
      "label": "注文明細",
      "fieldName": "order_item_id",
      "relationType": "hasMany"
    }
  ]
}
```

custom リレーションの UI 実装例:
```tsx
<SampleFields
  methods={methods}
  beforeField={{
    project_id: (
      <ControlledField
        control={control}
        name="project_id"
        label="プロジェクト"
        renderInput={(field) => <MyProjectSelector {...field} />}
      />
    )
  }}
/>
```

---

### Field（フィールド定義）

| プロパティ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| name | string | 🟢 Yes | フィールド名（snake_case） |
| label | string | 🟢 Yes | 表示名 |
| fieldType | FieldType | 🟢 Yes | データ型 |
| formInput | FormInput | 🟢 Yes | フォーム入力種別 |
| required | boolean | ⚪ No | 必須かどうか |
| readonly | boolean | ⚪ No | 読み取り専用（テキスト系は readOnly、選択系は disabled として適用） |
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
| colorInput | カラーピッカー + hexコード入力 |
| mediaUploader | メディアアップロード |
| hidden | 非表示入力 |
| none | 入力なし（フォームに出さない、スキーマからも除外） |
| custom | カスタムUI（スキーマには含める、UIは自分で実装） |

#### hidden vs custom vs none の違い

| 項目 | hidden | custom | none |
|------|--------|--------|------|
| Zodスキーマ | 含める | 含める | **除外** |
| フォームデータ | 含む | 含む | **含まない** |
| UI描画 | なし | なし（自分で実装） | なし |
| 用途 | プログラマティックに値を設定するフィールド | 独自UIで入力するフィールド | DBのみで使うフィールド（API経由で設定） |

⚠️ **よくある間違い**: プログラマティックに値を設定したい場合は `hidden`（または独自UIがあれば `custom`）を使う。`none` はスキーマから除外されるため、フォームから値を送信できない。

#### custom の使い方

`formInput: "custom"` を指定したフィールドは、FieldRenderer では何も描画されない。
代わりに `beforeField` / `afterField` props で独自コンポーネントを挿入する。

**推奨: `ControlledField` を使う**

統一感を保つため、`src/components/Form/Field/Controlled/ControlledField` を使用する。
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
import { ControlledField } from "@/components/Form/Field";

<FieldRenderer
  control={control}
  methods={methods}
  baseFields={fields}
  beforeField={{
    custom_field: (
      <ControlledField
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
