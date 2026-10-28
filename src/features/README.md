# features/

ドメイン別の機能を格納するディレクトリ。各ドメインは `domain.json` を持ち、コード生成の設定を定義する。

---

## domain.json スキーマ定義

### トップレベルプロパティ

| プロパティ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| domainConfigVersion | string | 🟢 Yes | 設定バージョン（現在 `"1.3"`） |
| singular | string | 🟢 Yes | ドメイン名単数形（snake_case、例: `sample_category`）。ドメインフォルダ名はこの camelCase（例: `sampleCategory/`）でなければならず、ずれていると dc:generate が止まる |
| plural | string | 🟢 Yes | ドメイン名複数形（snake_case、例: `sample_categories`） |
| label | string | 🟢 Yes | 管理画面での表示名（日本語可） |
| dbEngine | `"Neon"` \| `"Firestore"` | 🟢 Yes | 使用するDB。原則 `"Neon"`。`"Firestore"` はリアルタイム配信が本質要件のドメインのみ（`docs/!must-read/バックエンド構成ドクトリン.md`） |
| idType | `"uuid"` \| `"string"` \| `"number"` | 🟢 Yes | 主キーの型 |
| relations | Relation[] | 🟢 Yes | リレーション定義（空配列可） |
| useCreatedAt | boolean | 🟢 Yes | createdAt カラムの有無 |
| useUpdatedAt | boolean | 🟢 Yes | updatedAt カラムの有無 |
| useSoftDelete | boolean | ⚪ No | 論理削除の有無（deletedAt カラム） |
| sortOrderField | string | ⚪ No | 並び順の列（fractional の鍵を入れる text の列）のフィールド名。fields に同名の項目（`fieldType: "string"`、`formInput: "hidden"`）を置く。管理画面の並べ替え（sort/）と reorder / searchForSorting のフックを生成する |
| fields | Field[] | 🟢 Yes | フィールド定義 |
| fieldGroups | FieldGroup[] | ⚪ No | 管理画面フォームのセクション分け（後述） |
| searchFields | string[] | ⚪ No | 検索対象フィールド名の配列 |
| searchRank | `{ fields: (string \| { field: string; weight?: number })[] }` | ⚪ No | 関連度ランキング（`searchRank: true` 時のフィールド重み、Neon のみ）。未宣言なら `searchFields` 等重みで「完全 > 前置 > 語頭 > 部分」一致順になる。例: `{ "fields": [{ "field": "name", "weight": 3 }, "email"] }`。詳細: `src/lib/crud/README.md` の searchRank 節 |
| defaultOrderBy | [string, "ASC" \| "DESC"][] | ⚪ No | デフォルトソート順 |
| tableFields | string[] | ⚪ No | 管理画面テーブルに表示するフィールド |
| useDetailModal | boolean | ⚪ No | 詳細モーダルの有無 |
| addToAdminDataMenu | boolean | ⚪ No | adminDataMenu への自動追加 |
| useDuplicateButton | boolean | ⚪ No | 複製ボタンの有無 |
| useImportExport | boolean | ⚪ No | データ入出力機能の有無（CSV/ZIP形式）。`false` はサーバー側のインポート処理も拒否する |
| useAutoSave | boolean | ⚪ No | 編集フォームでオートセーブを使用するか |
| compositeUniques | string[][] | ⚪ No | 複合ユニーク制約（Neon のみ） |
| indexes | Index[] | ⚪ No | 非ユニーク検索/集計用インデックス（Neon のみ） |
| systemColumns | string[] | ⚪ No | `systemUpdate` / `systemBulkUpdateByQuery`（特権書き込み）で書き込みを許可するカラムの allowlist（Neon のみ）。Zod スキーマ外のシステム管理カラム（`ended_at` 等）をサービス層から正規経路で書き込むための宣言。**未宣言時は system 系メソッドは常に throw（fail-closed）**。詳細: `src/lib/crud/README.md` |
| hiddenColumns | string[] | ⚪ No | 秘匿カラム（APIキー・トークン等「DB には保持するがレスポンスに決して含めない」カラム、Neon のみ）。プロパティ名（camelCase）で指定すると `dc:generate` が `entities/drizzle.ts` に `defineHiddenColumns()` を出力し、サービスの**全戻り値**・他ドメインの **withRelations 展開**から該当カラムが null 置換される。秘匿値をサーバー内部で読む場合は `services/server/` に直接 drizzle の専用ファインダーを作ること（例: user の `findByIdWithSecrets`）。詳細: `src/lib/crud/README.md` の hiddenColumns 節 |
| apiAccess | ApiAccess | ⚪ No | 汎用 API（`/api/[domain]/**`）のアクセス制御（後述）。**未宣言時は admin カテゴリのみ許可（fail-closed）** |
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

#### onDelete（削除時の挙動）

belongsTo の外部キーに付く参照先削除時の挙動。`dc:generate` が `entities/drizzle.ts` の `.references()` 第2引数（FK 名が 63 文字を超える場合は短縮名の `foreignKey(...).onDelete()`）に出力する（`scripts/domain-config/domain/relations.mjs` の `getOnDeleteBehavior` / `buildOnDeleteOption`、出力は `render/entities/drizzle/foreignKeys.mjs`）。

| 値 | 参照先が削除されたとき | 生成される Drizzle 設定 |
|---|---|---|
| `RESTRICT`（既定） | 参照があれば削除を拒否（エラー → トランザクション全体がロールバック） | `onDelete: "restrict"` |
| `CASCADE` | このレコードも削除 | `onDelete: "cascade"` |
| `SET_NULL` | 外部キーを NULL にする | `onDelete: "set null"` |

- 適用対象は belongsTo のみ（FK が自テーブルにあるため）。hasOne / hasMany は FK が相手側なので設定しない。belongsToMany の中間テーブルは両側 CASCADE 固定
- 解決順: `onDelete` があればそれ → 旧形式 `onDeleteCascade: true` なら CASCADE → それ以外（`onDeleteCascade: false` / 未指定）は RESTRICT
- 既定を RESTRICT にしているのは、意図しない連鎖削除を防ぎ、CASCADE / SET_NULL を明示的な選択にするため
- `SET_NULL` と `required: true` は矛盾する（NOT NULL 列を NULL にできない）ため、`dc:generate` がエラー終了する
- FK 制約が働くのは物理削除のみ。ソフトデリート（`deleted_at` 設定）では onDelete は発火しない

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
全件取得する関連（`async*` と `custom` 以外。省略時の `select` / `checkbox` を含む）は、生成された管理画面（追加・編集）がサーバーで先読みして SWR の fallback に渡す。`async` / `custom` の関連と `includeRelationTable: false` の belongsToMany（逆側）は先読みしない。判定は `src/lib/domain/relations/relationOptions.mjs` に集約（`useRelationOptions` / `loadAdminRelationOptions` / 生成器が共有）。

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
| collection | Collection | ⚪ No | 主の集まりの宣言（fieldType `mediaCollection` の項目。下の「主の集まりの項目（mediaCollection）」） |

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
| mediaCollection | 主の集まり（従属ドメインのメディアの行の並び。列を持たない。formInput は `mediaUploaderMulti`） |

`mediaUploaderMulti`（1 列の text[] に複数のメディアを持つ型）は廃止した。domain.json に残っていると dc:generate が集まりへの移行を案内するエラーで止まる。複数のメディアは mediaCollection で持つ（formInput の `mediaUploaderMulti` は集まりの入力欄の名前として残る）

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

### 主の集まりの項目（mediaCollection）

主の 1 行に属する従属ドメインの行の並び（例: 商品のギャラリー画像）。主の表に列は持たず、lib の collections オプション（[src/lib/crud/README.md](../lib/crud/README.md)「ドメイン集約」）で読み書きする。Neon のみ。

- 1 つのレコードに複数のメディアを持たせる方法はこれだけ（1 枚ずつ従属のドメインの行に保存）。旧来の fieldType `mediaUploaderMulti`（1 列の text[]）は廃止した
- 例: `src/features/sample/domain.json` の `images`（従属 `sampleImage`）
- 廃止前の mediaUploaderMulti 列を集まりへ移す: [src/lib/crud/README.md](../lib/crud/README.md)「既存の mediaUploaderMulti 列からの移行」（手順・やってはいけないこと・確かめ方・戻し方）

```json
{ "name": "galleryImages", "label": "ギャラリー", "fieldType": "mediaCollection", "formInput": "mediaUploaderMulti",
  "required": true, "reorderable": true, "collection": { "domain": "productImage", "maxItems": 10, "duplicate": true } }
```

| プロパティ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| collection.domain | string | 🟢 Yes | 従属ドメインの singular |
| collection.maxItems | number（1 以上の整数） | ⚪ No | 最大件数。省略 = 上限なし |
| collection.duplicate | boolean | ⚪ No | 主の複製で従属も写すか。省略 = true |

- 必須 = `required`、並べ替え = `reorderable`（既存のキー）
- ファイルの条件（slug・mediaTypePreset・accept・validationRule・storage）は主に書かず、従属ドメインのメディア項目に書く
- 語彙の検査（`[domain.json]` の警告）は collection の下位キーの型を見る
- dc:generate は、従属ドメインの domain.json（`src/features/<collection.domain の camelCase>/domain.json`）が**無いときだけ**書き出す（既にあれば触らない。`--only` でも、dry-run では「作成 / 保持」と出すだけ）。書き出す雛形:
  - singular = `collection.domain`、plural = 既定の名前のままなら `<主>_<項目名>`（項目名が s で終わるとき）、変えていれば書かない（推定）、label = 主の項目の label、Neon、idType = 主と同じ
  - relations = 主への belongsTo（`<主>_id`、必須、onDelete CASCADE）。主の relations には足さない
  - fields = メディア項目 `file`（mediaUploader、images / `image/*`、10MB、slug = 主の項目名の camelCase）と並び列 `sort_order`（hidden、`sortOrderField` と `systemColumns` に宣言）。useSoftDelete false
  - 汎用 API は閉じる（`apiAccess: { read: "none", write: "none" }` = INTERNAL_ONLY）、addToAdminDataMenu false、generateFiles は entities / serverServices / registry / fieldConstants / presenters だけ（管理画面・フック・クライアントは主の画面から使う）
  - `file` の storage は主の汎用 API の規則から写す: upload = 主の create と update の和、read = 主の get、visibility = read が `"public"` なら public、それ以外は private。写せるのは `"public"` / `"authenticated"` / ロールの規則だけで、主が閉じている（`"none"`）・知らない値・`generateFiles.registry: false`（domainEntry.ts が手書き）なら管理者のみを書き、直す場所を出力する
  - ファイルの条件（preset・accept・上限）は雛形の既定なので、従属の domain.json で直す
- 従属が守ること（dc:generate が書く前に検査し、1 つでも外れれば全件を並べて何も書かずに止まる。一覧と判定: [scripts/domain-config/README.md](../../scripts/domain-config/README.md)「dc:generate」）
  - 主への belongsTo はちょうど 1 本・required・onDelete CASCADE、`useSoftDelete` は false
  - メディア項目（mediaUploader）はちょうど 1 つ。mediaCollection は持たない。ファイルの条件はここに書く（主の項目には書かない）
  - `sortOrderField` とその項目を持ち、`systemColumns` に入れる（集まりの並びを持つ列。主の項目が reorderable: false でも要る）
  - 主の画面から埋められない必須の項目（主への参照・メディア・並び以外で required かつ defaultValue なし）を持たない
  - `file` の upload は主の create・update の和より狭くしない、read は主の get より狭くしない（public の従属は見ない）。広い upload と、開いた汎用 API は知らせるだけ
  - 表名・主への FK 名は 63 字以内、singular・表名は他のドメインと重ねない。required の集まりは `collection.duplicate: false` にしない

### MediaUploader フィールド追加プロパティ

保存先は項目ごとに自動で決まる用途 `<domain>.<field>`（purpose）で決まる。保存先パスの指定（旧 `uploadPath`）は無い。

| プロパティ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| slug | string | 🟢 Yes | ハンドラ識別子（camelCase） |
| mediaTypePreset | `"images"` \| `"videos"` \| `"imagesAndVideos"` \| `"all"` | 🟢 Yes | 許可ファイル種別 |
| accept | string | 🟢 Yes | accept 属性値（例: `image/*,video/*`） |
| validationRule | object | ⚪ No | バリデーション設定 |
| validationRule.maxSizeBytes | number | ⚪ No | 最大ファイルサイズ（バイト） |
| helperText | string | ⚪ No | ヘルパーテキスト（アップロード欄に表示される説明文） |
| metadataBinding | object | ⚪ No | メタデータを別フィールドに保存 |
| storage | object | ⚪ No | ファイル用途の設定（下の「ファイルの保存（storage）」） |
| storage.visibility | `"public"` \| `"private"` | ⚪ No | 公開・非公開。**一般利用者がアップロードできる項目では必須**（省略すると dc:generate がエラーで止まる） |
| storage.upload | アクセスルール（`"public"` 以外） | ⚪ No | アップロードしてよい人。省略時は apiAccess の create と update の許可者の和 |
| storage.read | アクセスルール（`"public"` を含む） | ⚪ No | 読んでよい人。省略時は apiAccess の get の規則 |
| storage.metadata | `"strip"` \| `"keep"` | ⚪ No | 画像の位置情報などのメタデータの扱い。省略 = `"strip"`（サーバーが描き直して消す）。原本のまま残す項目（書類・明細など）だけ `"keep"` |

#### metadataBinding キー

```
sizeBytes, width, height, aspectRatio, orientation,
mimeType, src, durationSec, durationFormatted
```

#### ファイルの保存（storage）

dc:generate は、メディア項目ごとにファイル用途（`<domain>.<field>`）を `src/registry/storagePurposeRegistry.ts` の AUTO ブロックへ書き込む（`--only registry` でも書き込む）。登録表に無い用途は、アップロードも読み取りも拒否される。用途の型と規則は [src/lib/storage/README.md](../lib/storage/README.md)、台帳は [core/storageObject/README.md](core/storageObject/README.md) を参照。

- 用途 ID は `<domain>.<field>`。ref とオブジェクトのパスに入るため、使い始めた後はドメイン名・項目名を変えない
- contentTypes は accept から作る
- metadata は `storage.metadata`（省略 = `"strip"`）。画像を含む項目（accept に `image/` で始まる型がある）には明示値で書き出す。画像の無い項目には書き出さない（効果が無いため）
  - strip（省略を含む）の項目は、画像を jpeg / png / webp / gif / avif だけ受け付ける（`image/*` はこの 5 型に読み替え）。端末の写真選択も 5 型に絞られ、iOS は HEIC を JPEG にして渡す
  - **生成エラー**: strip（省略を含む）の accept にサーバーで描き直せない画像の型（`image/heic`・`image/svg+xml`・`image/tiff` など）がある / 画像の型が無い項目に `"strip"` を明示した。直し方 = `"storage": { "metadata": "keep" }` を書くか、accept を 5 型か `image/*` にする
  - strip の約束の範囲（動画・keep・導入前のファイルは対象外）と公開文書に書いてよい表現: [src/lib/storage/README.md](../lib/storage/README.md)「位置情報の約束」
- maxBytes は `validationRule.maxSizeBytes` を使う。無ければ `src/config/app/storage.config.ts` の `defaultMaxBytesByPreset.<mediaTypePreset>` を参照する式を書き、警告を出す
- upload.allow は `storage.upload` を使う。無ければ apiAccess の create と update の許可者の和にする
  - どちらかが `"public"` か `"authenticated"` なら `"authenticated"`（アップロードは常にログインが要る）
  - ロールの規則どうしは roles / roleCategories を合わせる。`"none"` は数えない
- visibility は `storage.visibility` を使う。無いときは次のとおり
  - **一般利用者（admin 以外のカテゴリ）がアップロードできる項目 → 生成エラー**（公開か非公開かを人が決めるため）
  - 管理者だけがアップロードできる項目 → 読める人（`storage.read`、無ければ apiAccess の get）が `"public"` なら public、それ以外は private
- private の用途には read.allow として読める人（`storage.read`、無ければ apiAccess の get の規則）を付ける。`storage.read` の `"public"` も書ける（visibility を private と明示した項目でもそのまま出す）
- AUTO ブロックの外（手書きの FORK ブロック）に同じ ID があれば上書きせず、警告だけを出す。手書きの定義（check 関数付きなど）が優先される
- 項目を消して再生成すると、AUTO ブロックから消える。dc:delete はそのドメインの AUTO エントリを消す
- core ドメインの domain.json（notification / coupon）は dc:generate の対象外なので、`src/registry/storagePurposes/core.ts` に手で書く。`pnpm test:storage-purposes` が、全 domain.json のメディア項目に用途があるかと、手書き（CORE / FORK）の用途の metadata の規則（上の生成エラーと同じ規則、`user.avatar` を keep にしない）を確かめる

---

### FieldGroup（フィールドグループ）

管理画面フォームのフィールドをセクション（`<fieldset>` + legend）に分けて表示する。生成された `XxxFields` が domain.json の `fieldGroups` を自動で読み込む（props の `fieldGroups` 指定で上書きも可能）。

| プロパティ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| key | string | 🟢 Yes | グループキー（一意識別子。`beforeGroup` / `afterGroup` のキーにもなる） |
| label | string | 🟢 Yes | セクションの表示ラベル |
| fields | string[] | 🟢 Yes | グループに含むフィールド名 |
| collapsible | boolean | ⚪ No | 折りたたみ可能か（デフォルト: false） |
| defaultCollapsed | boolean | ⚪ No | 初期状態で折りたたむか（デフォルト: false） |
| bgColor | string | ⚪ No | 背景色（CSSカラーコード、例: `"#f0f7ff"`） |

```json
{
  "fieldGroups": [
    {
      "key": "basic",
      "label": "基本情報",
      "fields": ["name", "description"],
      "bgColor": "#f0f7ff"
    },
    {
      "key": "datetime",
      "label": "日時設定",
      "collapsible": true,
      "defaultCollapsed": true,
      "fields": ["sale_start_at", "date"]
    }
  ]
}
```

- どのグループにも属さないフィールドは、全グループの後ろに「グループ外枠」としてまとめて描画される
- セクションへのUI差し込み（オーバーライド警告等）は `beforeGroup` / `afterGroup` props で行う
- 描画仕様・カスタマイズの詳細: `src/components/Form/FieldRenderer/README.md`

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

### indexes（非ユニーク検索/集計用インデックス）

**Neon (PostgreSQL/Drizzle) 専用機能**。Firestore では利用不可。

検索・集計頻度が高いカラム（WHERE フィルタ、期間絞り込み、JOIN キー等）にインデックスを宣言する場合に使用。`compositeUniques` がユニーク制約を強制するのに対し、`indexes` は**ユニーク制約なしの検索高速化用**。

```json
{
  "indexes": [
    { "fields": ["status"] },
    { "fields": ["status", "fulfilled_at"] },
    { "fields": ["status"], "where": "deleted_at IS NULL" },
    { "fields": ["external_id"], "name": "custom_short_idx" },
    { "fields": ["title"], "using": "gin", "opclass": { "title": "gin_trgm_ops" } },
    { "fields": ["metadata"], "using": "gin", "opclass": { "metadata": "jsonb_path_ops" } }
  ]
}
```

#### プロパティ

| プロパティ | 型 | 必須 | 説明 |
|---|---|---|---|
| fields | string[] | 🟢 Yes | インデックス対象カラム（先頭から複合キー）。生成後の `entities/drizzle.ts` に現れるプロパティ名で指定する。業務フィールドは domain.json の `name` そのまま（例: `name_kana`。`nameKana` は存在せず型エラー）、システム列は `createdAt` / `updatedAt` / `deletedAt` |
| where | string | ⚪ No | 部分インデックスの WHERE 句（SQL リテラル）。例: `"deleted_at IS NULL"` |
| name | string | ⚪ No | インデックス名のオーバーライド。省略時は `{テーブル名}_{col1}_{col2}_..._idx` で自動命名 |
| using | string | ⚪ No | インデックス方式（`gin` / `gist` / `brin` / `hash` など）。省略・`"btree"` は従来どおり `.on(...)`、それ以外は `.using("<方式>", ...)` を出力する |
| opclass | `{ [field]: string }` | ⚪ No | 列ごとの演算子クラス。キーは `fields` に含まれる列（含まれなければ生成エラー）。例: `{ "title": "gin_trgm_ops" }` → `table.title.op("gin_trgm_ops")`。btree の演算子クラス（`text_pattern_ops` 等）にも使える |

`using` / `opclass` の値は生成コードにそのまま入るため、識別子の形（`^[a-z_][a-z0-9_]*$`）以外は生成エラーになる。

#### 名前の自動命名規則

省略時: `{テーブル名}_{col1}_{col2}_..._idx`
例: `indexes: [{ "fields": ["status", "fulfilled_at"] }]` → `referral_rewards_status_fulfilled_at_idx`

`using` が btree 以外のとき: `{テーブル名}_{col1}_..._{using}_idx`（同じ列に btree と GIN を両方張っても衝突しない）。例: `games_title_gin_idx`。既存の名前を保ちたいときは `name` で指定する

PostgreSQL の識別子上限 (63 文字) を超える場合は generator がエラーで停止する。その場合は `name` で短縮指定する。

#### using / opclass を使うときの注意

- **拡張機能は前提**: `gin_trgm_ops` は `pg_trgm`、ベクトル系は `vector` などの拡張が DB に入っている必要がある。dc:generate / db:push は拡張を作らないので、先にユーザーが `pnpm db:query "CREATE EXTENSION IF NOT EXISTS pg_trgm"` を実行する（無いと push が失敗する）
- **演算子クラスは push で比較されない**: drizzle-kit の index 比較キーに opclass は含まれない（`using` = 方式は含まれる。`scripts/registry/README.md` の round-trip 節）。宣言済みの opclass を後から変えても DB は作り直されないので、変えるときは `name` も変えて別 index として作り直す
- 典型例: 部分一致検索（`ILIKE '%…%'`）= `gin` + `gin_trgm_ops` | jsonb の包含検索（`@>`）= `gin` + `jsonb_path_ops`（既定の `jsonb_ops` なら opclass 不要） | 前方一致（`LIKE 'abc%'`、C 以外の照合順序）= btree + `text_pattern_ops`

#### compositeUniques との使い分け

| 用途 | フィールド |
|---|---|
| 一意性を強制したい (DB レベルの制約) | `compositeUniques` |
| 検索/集計を高速化したい (ユニーク強制なし) | `indexes` |

#### ⚠️ DB への反映が必須

`indexes` を追加・変更しても、それだけでは実 DB にインデックスは作成されない。Drizzle スキーマ定義 (`entities/drizzle.ts`) に反映後、必ず以下を実行する:

```bash
pnpm db:push
```

詳細手順は [scripts/registry/README.md の「スキーマ変更を DB に反映する（push）」](../../scripts/registry/README.md) を参照。push を忘れると、コード上は index 定義があってもクエリは全表スキャンのままで、本機能の目的 (検索/集計の高速化) を達成できない。

#### ⚠️ push round-trip の確認（index を書いたら必須）

drizzle-kit は特定の書き方の index を DB から正しく読み戻せず、**DB が既にスキーマどおりでも push のたびに DROP + CREATE する**（本番の大規模テーブルでは書き込みロック）。index を追加・変更したら `pnpm db:push` のあと `pnpm db:push:check` を実行し、差分ゼロを確認してからコミットする。

手書き drizzle.ts での禁止事項: `sql\`${table.col} DESC\``（`.desc()` を使う）、通常列と SQL 式の混在（全列を `sql\`${table.col}\`` にする）。詳細なルールと理由: [scripts/registry/README.md](../../scripts/registry/README.md)

---

### core ドメインへの indexes 反映について

core ドメイン (`src/features/core/<domain>/`) は **dc:generate コマンドの対象外** (ベースの設計上、`features/` 直下のみ対応)。core ドメインで `indexes` を追加・変更する場合は以下のいずれかで反映する:

1. **手書きで `entities/drizzle.ts` を直接編集** (推奨、変更が小さい場合)
   - `domain.json` の `indexes` 宣言も同時に更新する (将来の整合性のため)
   - 手書きの形式は generator 出力と完全一致させる（一時的に features/ 直下に複製して `dc:generate` した出力をコピーすると確実）
2. **features/ 直下に一時複製してから再生成 → core/ に戻す**
   - 既存の運用フローと同じ手順

---

### GenerateFiles

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| entities | boolean | エンティティ（schema, form, model, drizzle/firestore） |
| components | boolean | 管理画面コンポーネント |
| hooks | boolean | CRUD フック |
| clientServices | boolean | axios クライアント |
| serverServices | boolean | サーバーサービス（`drizzleBase.ts` / `firestoreBase.ts` は毎回生成、`<domain>Service.ts` は無いときだけ生成） |
| adminRoutes | boolean | 管理画面ルート（page.tsx 1 行スイッチ + `_screen/` + 共有 loader の構造で生成。page.tsx は初回のみ生成、`_screen/` は毎回再生成。詳細: `src/lib/screens/README.md` §12） |
| registry | boolean | レジストリへの登録（`services/server/domainEntry.ts` の生成を含む。`apiAccess` / `useImportExport` を access に展開し、最後に `pnpm registry:generate` が serviceRegistry.ts を作り直す） |
| fieldConstants | boolean | options を持つフィールドの定数/型 |
| presenters | boolean | テーブル表示用フォーマッタ |

---

### ApiAccess（汎用 API アクセス制御）

`/api/[domain]/**` の汎用 CRUD ルートに対するロールベースのアクセス制御。
判定は `createDomainRoute`（`src/lib/routeFactory`）が一元的に行う。

> **実行時ソースは serviceRegistry**: domain.json の `apiAccess` は editing source で、
> `dc:generate` が `services/server/domainEntry.ts` のエントリの `access` に展開し（`{ service, access, table, idColumn }`、型必須）、
> `src/registry/serviceRegistry.ts` はそこから生成される。実行時の認可は registry の access を参照する。
> コアドメインは domainEntry.ts に直接 access を書く。管理データ操作（`truncateAll` / `export` / `import`）は
> `operations` に明示したときだけ開く（dc:generate が truncateAll = 管理者、export / import = `useImportExport` から書く）。
> エントリは表の物理名と主キー列名（`table` / `idColumn`、型必須）も持ち、dc:generate が書く（`generateFiles.registry: false` で
> 手書きしている domainEntry.ts は自分で書く。Firestore は `null`）。
> 詳細: `src/lib/routeFactory/README.md`「アクセスポリシー（domainEntry.ts の `access`）」、`src/lib/domain/README.md`

| プロパティ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| read | AccessRule | ⚪ No | 読み取り操作（list, get, search, count）の既定ルール |
| write | AccessRule | ⚪ No | 書き込み操作（create, update, remove, upsert 等）の既定ルール |
| operations | Record<Operation, AccessRule> | ⚪ No | 操作単位の上書き（read/write より優先） |

#### AccessRule

| 値 | 説明 |
|----|------|
| `"public"` | 未認証でもアクセス可 |
| `"authenticated"` | ログイン済み（利用可能ステータス）なら誰でも可 |
| `"none"` | 汎用 API を無効化（404）。専用ルートのみ公開したいドメイン用 |
| `{ "roles": [...], "roleCategories": [...] }` | 指定ロール ID / ロールカテゴリのみ可（OR 条件） |

#### Operation（operations のキー）

`list` `get` `search` `count` `create` `update` `remove` `upsert` `duplicate` `restore` `hardDelete` `reorder` `searchForSorting` `bulkUpsert` `bulkUpdate` `bulkUpdateByIds` `bulkDeleteByIds` `bulkDeleteByQuery` `replaceByQuery`

管理データ操作（汎用ルートではなく管理画面の専用ルートが評価する。未指定 = `"none"`）: `truncateAll` `export` `import`。domain.json では書かない（dc:generate が `useImportExport` から domainEntry.ts に書く）

#### フォールバック（fail-closed）

- domainEntry.ts の `access` は型必須のため、登録時に宣言を省略できない（書き忘れはコンパイルエラー）
- `read` / `write` / `operations` が当該操作をカバーしない（部分宣言・空 `{}`）場合、グローバル既定値（`src/config/app/domain-api-access.config.ts`、初期値: admin カテゴリのみ）が適用される
- **書き忘れても安全側（admin-only）に倒れる**

#### 例

```json
"apiAccess": {
  "read": "public",
  "write": { "roleCategories": ["admin"] },
  "operations": { "hardDelete": "none" }
}
```

#### ⚠️ オーナーシップ制御は対象外

ロールガードのみで「自分のレコードだけ」という制御はできない。ユーザー所有データ
（wallet, notification 等）の汎用 API は admin 限定にし、ユーザー向けアクセスは
`createMeRoute`（`/api/me/**`）で所有者スコープを強制すること。`"read": "authenticated"` を
設定すると汎用 API では**他ユーザーのレコードも読める**点に注意。

---

## サンプル

最小構成:

```json
{
  "domainConfigVersion": "1.3",
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
  "apiAccess": {
    "read": { "roleCategories": ["admin"] },
    "write": { "roleCategories": ["admin"] }
  },
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

## エンティティとフォームスキーマ

- `entities/schema.ts`: サーバー処理の正規形（`XxxBaseSchema` / `XxxCreateSchema` / `XxxUpdateSchema`）。フォーム固有の都合を持ち込まない
- `entities/form.ts`: `schema.ts` を `z.infer` した型だけを公開する。追加のスキーマは書かない。フォーム側で足したい項目は、空の型との交差で広げる（`XxxCreateFields = z.infer<typeof XxxCreateSchema> & XxxCreateAdditional`）
- フォーム固有の入力（確認用パスワード、一時的に分けた入力欄など）は、そのフォームの隣の `formEntities.ts` に置く。使う範囲が限られるので短い名前でよい: `FormSchema`（resolver に渡す Zod スキーマ。`schema.ts` を拡張して作るのが基本）/ `FormValues`（`useForm` の型）/ `DefaultValues`
- 同じ構造のフォームが複数要るときは、スキーマではなくフォームコンポーネントを再利用する

business ドメインの `entities/` は `dc:generate` が生成するので手で編集しない。上の規約は主に core ドメインと `formEntities.ts` を書くときに使う。

---

## 関連コマンド

`pnpm dc:init` / `dc:generate <Domain>` / `dc:generate:all` / `dc:add <Domain>` / `dc:delete <Domain>`。生成モード・生成物と上書きの扱い・典型的な流れは [`scripts/domain-config/README.md`](../../scripts/domain-config/README.md)。
