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

#### FieldType（Neon）

```
string, integer, float, boolean, enum, date, time,
timestamp With Time Zone, email, password, bigint,
numeric(10,2), uuid, Point, jsonb, array, mediaUploader
```

#### FieldType（Firestore）

```
string, number, boolean, timestamp, email, password,
array, geopoint, reference, map, null, mediaUploader
```

#### FormInput

```
textInput, numberInput, textarea, select, multiSelect,
radio, checkbox, stepperInput, switchInput, dateInput,
timeInput, datetimeInput, emailInput, passwordInput,
mediaUploader, hidden, none
```

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
| metadataBinding | object | ⚪ No | メタデータを別フィールドに保存 |

#### metadataBinding キー

```
sizeBytes, width, height, aspectRatio, orientation,
mimeType, src, durationSec, durationFormatted
```

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
