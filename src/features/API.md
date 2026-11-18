# features/ — API(domain.json スキーマ定義)

## Overview

- `src/features/` の各ドメインが持つ `domain.json` の形。入口は [README.md](./README.md)
- この決まりは `pnpm generate domain` の生成前の検査（`scripts/structure/domain/checks/`）が確かめる。反すると全件を並べて何も書かずに止まり、止めない食い違い（名前の形・表に無い型と入力欄の組・Firestore の文字列でない列の検索など）は `[domain.json]` の警告として出る。

## API

### トップレベルプロパティ

| プロパティ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| domainConfigVersion | string | 🟢 Yes | 設定バージョン（現在 `"1.3"`） |
| singular | string | 🟢 Yes | ドメイン名単数形（snake_case、例: `sample_category`）。ドメインフォルダ名はこの camelCase（例: `sampleCategory/`）でなければならず、ずれていると pnpm generate domain が止まる |
| plural | string | 🟢 Yes | ドメイン名複数形（snake_case、例: `sample_categories`）。テーブル名とルートになる。無いと pnpm generate domain が止まる |
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
| addToAdminDataMenu | boolean | ⚪ No | 管理メニュー「データ管理」(出どころ `dataMenu`)に出す。管理一覧の画面があるドメインだけ(`src/registry/adminDomains.ts`) |
| useDuplicateButton | boolean | ⚪ No | 複製ボタンの有無 |
| useImportExport | boolean | ⚪ No | データ入出力機能の有無（CSV/ZIP形式）。`true` のときだけ管理者に export / import を開く。省略・`false` = 閉じる（サーバー側のインポート処理も拒否する） |
| useAutoSave | boolean | ⚪ No | 編集フォームでオートセーブを使用するか |
| compositeUniques | string[][] | ⚪ No | 複合ユニーク制約（Neon のみ） |
| indexes | Index[] | ⚪ No | 非ユニーク検索/集計用インデックス（Neon のみ） |
| systemColumns | string[] | ⚪ No | `systemUpdate` / `systemBulkUpdateByQuery`（特権書き込み）で書き込みを許可するカラムの allowlist（Neon のみ）。Zod スキーマ外のシステム管理カラム（`ended_at` 等）をサービス層から正規経路で書き込むための宣言。**未宣言時は system 系メソッドは常に throw（fail-closed）**。詳細: `src/lib/crud/README.md` |
| hiddenColumns | string[] | ⚪ No | 秘匿カラム（APIキー・トークン等「DB には保持するがレスポンスに決して含めない」カラム、Neon のみ）。プロパティ名（camelCase）で指定すると `pnpm generate domain` が `entities/drizzle.ts` に `defineHiddenColumns()` を出力し、サービスの**全戻り値**・他ドメインの **withRelations 展開**から該当カラムが null 置換される。秘匿値をサーバー内部で読む場合は `services/server/` に直接 drizzle の専用ファインダーを作ること（例: user の `findByIdWithSecrets`）。詳細: `src/lib/crud/README.md` の hiddenColumns 節 |
| audit | object | ⚪ No | 監査ログ（`createCrudService` の `audit` のうち JSON で書ける部分。`targetType`・`actionPrefix` は `enabled: false` 以外で必須、`trackedFields` は camelCase の列名、recorder は生成器が渡す、Neon のみ）。`generate: false` のドメインでは効かないので `drizzleBase.ts` に手で書く |
| closable | — | — | 無い。書くと生成器が止める。機能として閉じるには `src/featureGate/rules/<名前>.ts` に規則を書き `features` にこのドメインを入れる |
| apiAccess | ApiAccess | ⚪ No | 汎用 API（`/api/[domain]/**`）のアクセス制御（Extension.md「ApiAccess（汎用 API アクセス制御）」）。**未宣言時は admin カテゴリのみ許可（fail-closed）** |
| generate | boolean | ⚪ No | 生成するか（既定 true）。true = `pnpm forge` / `pnpm generate domain` がそのドメインの生成物を全部作り直す（手の実装は wrappers/ 等に置いて載せ替える）、false = 手で管理し、生成器は何も書かない（README.md の Internals「生成カテゴリ」）。区分ごとの `generateFiles` は廃止（書いてあると生成が止まる）。fork が true / false を決めるときは `pnpm check domain -- --compare`（手の変更・新しい入口・表の書き直しを出す。`scripts/structure/domain/README.md`「generate の旗を決める」） |
| $comment | string \| string[] | ⚪ No | 開発者のメモ（JSON にはコメントが無いため）。トップレベル・Relation・Field・collection・FieldGroup のどこにでも書ける（下の「開発者のメモ（$comment）」） |

#### 開発者のメモ（$comment）

- `"$comment"` = 開発者向けのメモ（JSON Schema の注記と同じ名前）。値は文字列か文字列の配列（複数行）。トップレベル・`relations[]`・`fields[]`・`fields[].collection`・`fieldGroups[]` のどこにでも書ける
- 動作には効かない: 生成器は読まず（あっても無くても生成物は同じ）、client の写し（`entities/display.ts`）にも出ない。画面に出す説明文は `helperText` に書く（`$comment` は画面に出ない）
- メモを別のキー（`description` など）に書くと、知らないキーとして警告される（同じキーはドメインごとに 1 行にまとまる）

> ⚠️ **オプショナルフィールドを追加する場合**: `src/lib/domain/types/domainConfigOptionals.ts` の `DomainConfigOptionals` にも同じフィールドを追加すること。省略すると、そのフィールドを持たないドメインが存在するだけで DomainConfig の union 型が壊れてビルドエラーになる。

### Relation（リレーション定義）

| プロパティ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| domain | string | 🟢 Yes | 関連先ドメイン名（snake_case） |
| label | string | 🟢 Yes | 表示名 |
| fieldName | string | 条件付き | フィールド名。relationType により意味が異なる（後述） |
| fieldType | `"uuid"` \| `"string"` \| `"integer"`（Firestore は `"string"` \| `"number"` \| `"reference"`） | 条件付き | 外部キーの型（belongsTo / belongsToMany で必須、hasMany では不要。省略 = 主の idType。数値の ID は `integer`、`number` は Neon では使えない） |
| relationType | RelationType | 🟢 Yes | リレーション種別 |
| required | boolean | ⚪ No | 必須かどうか（belongsTo のみ有効） |
| onDelete | `"RESTRICT"` \| `"CASCADE"` \| `"SET_NULL"` | ⚪ No | 削除時の挙動（belongsTo のみ） |
| includeRelationTable | boolean | ⚪ No | 中間テーブル定義を含めるか（belongsToMany のみ。省略 = true） |
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

belongsTo の外部キーに付く参照先削除時の挙動。`pnpm generate domain` が `entities/drizzle.ts` の `.references()` 第2引数（FK 名が 63 文字を超える場合は短縮名の `foreignKey(...).onDelete()`）に出力する（`scripts/structure/domain/domain/relations.mjs` の `getOnDeleteBehavior` / `buildOnDeleteOption`、出力は `render/entities/drizzle/foreignKeys.mjs`）。

| 値 | 参照先が削除されたとき | 生成される Drizzle 設定 |
|---|---|---|
| `RESTRICT`（既定） | 参照があれば削除を拒否（エラー → トランザクション全体がロールバック） | `onDelete: "restrict"` |
| `CASCADE` | このレコードも削除 | `onDelete: "cascade"` |
| `SET_NULL` | 外部キーを NULL にする | `onDelete: "set null"` |

- 適用対象は belongsTo のみ（FK が自テーブルにあるため）。hasOne / hasMany は FK が相手側なので設定しない。belongsToMany の中間テーブルは両側 CASCADE 固定
- 解決順: `onDelete` があればそれ → 旧形式 `onDeleteCascade: true` なら CASCADE → それ以外（`onDeleteCascade: false` / 未指定）は RESTRICT
- 既定を RESTRICT にしているのは、意図しない連鎖削除を防ぎ、CASCADE / SET_NULL を明示的な選択にするため
- `SET_NULL` と `required: true` は矛盾する（NOT NULL 列を NULL にできない）ため、`pnpm generate domain` がエラー終了する
- FK 制約が働くのは物理削除のみ。ソフトデリート（`deleted_at` 設定）では onDelete は発火しない

#### hasMany と withRelations

hasMany リレーションを定義すると、`pnpm generate domain` 時に drizzleBase.ts へ `hasManyRelations` 設定が自動生成される。これにより `withRelations: 1` で子レコード配列が親に展開される。

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
全件取得する関連（`async*` と `custom` 以外。省略時の `select` / `checkbox` を含む）は、生成された管理画面（追加・編集）がサーバーで先読みして SWR の fallback に渡す。`async` / `custom` の関連と `includeRelationTable: false` の belongsToMany（逆側）は先読みしない。判定は `src/lib/domain/relations/relationOptions.mjs` に集約（`useRelationOptions` / 管理画面の取得本体 `fetchAdminRelationOptions` / 生成器が共有）。

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

### Field（フィールド定義）

| プロパティ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| name | string | 🟢 Yes | フィールド名（snake_case） |
| label | string | 🟢 Yes | 表示名 |
| fieldType | FieldType | 🟢 Yes | データ型 |
| formInput | FormInput | 🟢 Yes | フォーム入力種別 |
| required | boolean | ⚪ No | 必須かどうか（配列の型では「空配列を既定にする」の意味で、1 件以上の意味ではない） |
| readonly | boolean | ⚪ No | 読み取り専用（テキスト系は readOnly、選択系は disabled として適用） |
| defaultValue | any | ⚪ No | デフォルト値（型に合う値。enum は options の value のどれか。timestamp・jsonb・配列・メディア・集まりの型は持てない） |
| options | Option[] | ⚪ No | 選択肢（enum では必須。select, radio, 配列の checkbox, multiSelect で使用し、無いと警告）。boolean に書くと初期値が未選択になる（radio のときは書く） |
| displayType | `"standard"` \| `"bookmark"` | ⚪ No | radio/checkbox の表示スタイル |
| placeholder | string | ⚪ No | プレースホルダー（textInput, numberInput, textarea, select, multiSelect, emailInput, passwordInput で使用） |
| collection | Collection | ⚪ No | 主の集まりの宣言（fieldType `mediaCollection` の項目。Extension.md「主の集まりの項目（mediaCollection）」） |

- リレーションのラベルの既定は関連先の `name` 項目（labelField の既定）なので、選ばれる側のドメインには `{ "name": "name", "fieldType": "string", "formInput": "textInput" }` の項目を置くとよい
- 型と入力欄の組は `src/lib/domain/fields/fieldFormInputs.mjs` の表（表に無い組は警告）

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

`mediaUploaderMulti`（1 列の text[] に複数のメディアを持つ型）は廃止した。domain.json に残っていると pnpm generate domain が集まりへの移行を案内するエラーで止まる。複数のメディアは mediaCollection で持つ（formInput の `mediaUploaderMulti` は集まりの入力欄の名前として残る）

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

#### FormInput

組み込みの名前の正は `src/lib/domain/fields/formInputs.mjs`。独自の部品は `src/wiring/formInputs/inputs/` に登録すると名前を書ける（`src/wiring/formInputs/inputs/README.md`。描画だけで、初期値・Zod・列は fieldType が決める）。組み込みにも登録にも無い名前は生成の前に止まる（fields・relations。`generate: false` は検査の外で、手書きの FieldConfig は TS が止める）。

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

### FieldGroup（フィールドグループ）

管理画面フォームのフィールドをセクション（`<fieldset>` + legend）に分けて表示する。生成された `XxxFields` が写し（`entities/display.ts`）の `fieldGroups` を自動で読み込む（props の `fieldGroups` 指定で上書きも可能）。

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
