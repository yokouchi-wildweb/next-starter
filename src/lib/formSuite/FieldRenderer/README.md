# FieldRenderer

## Overview

フィールド定義(`FieldConfig`)の配列からフォームの欄を描くレンダラー(`@/lib/formSuite`)。react-hook-form と連携し、`AppForm` の中で使う。domain.json を元にした管理画面フォームの中核。

- 生成のコンポーネント経由(推奨): `pnpm generate domain` が生成する `XxxFields` / `XxxForm` は本コンポーネントの props をそのまま渡す。ドメインのフォームを変えるときはこちらに props を渡す
- 直接使う: `import { FieldRenderer } from "@/lib/formSuite"`。domain.json に依らないフォーム(プロフィール等)
- 変える手段は 2 系統。スキーマに効くのはフィールド定義系だけ
  - フィールド定義系(`FieldConfig` を増減・変更): `fieldPatches`, `insertBefore`, `insertAfter`
  - UI 差し込み系(任意の `ReactNode` を挟む。スキーマ・値には効かない): `beforeAll` / `afterAll`, `beforeField` / `afterField`, `beforeGroup` / `afterGroup`

## Usage

### グループ単位の差し込み(beforeGroup / afterGroup)

`FieldGroup.key` をキーに、セクションの先頭(legend 直下・欄の一覧の上)/ 末尾(欄の一覧の下)へ `ReactNode` を差し込む。セクションの背景・枠線の内側に描くので、通知がそのグループに属すると見て分かる。

```tsx
<SampleFields
  methods={methods}
  beforeGroup={{
    // キーは FieldGroup.key（domain.json の fieldGroups の key）
    play_limit_settings: (
      <Para tone="warning">親側の設定が有効なため、このセクションの設定は無視されます</Para>
    ),
  }}
/>
```

- 典型: 親 / 全体の設定による上書きの警告、セクション単位の非推奨の案内、セクションの補足の説明

### custom の欄

`formInput: "custom"` の欄は自動で描かない(スキーマには含まれる)。`beforeField` / `afterField` で独自の部品を入れる(例: `src/domains/README.md`「custom の使い方」)。

### 登録された入力部品

`formInput` に `src/wiring/formInputs/inputs/` の登録名を書くと、登録の部品を描く(本体は遅延読み込み。書き方: `src/wiring/formInputs/inputs/README.md`)。

- 枠(ラベル・必須印・説明・エラー)は共通で描く。部品が自分で枠や複数の欄を描くなら項目に `frame: false`(エラーの表示は残る)
- 自動保存は項目の `blurMode`(省略 = blur で保存しない)。単一値の部品で自動保存を効かせるなら書く
- 部品は `AppForm` の中で描くので `useFormContext` が使える
- `custom` との使い分け: 何度も使う部品・setting の欄は登録、1 画面だけの差し込みは `custom` + `beforeField` / `afterField`

### メディアの欄

- 保存先は `FieldConfig.purpose`(ファイルの用途 ID `<domain>.<field>`、`src/registry/storagePurposeRegistry.ts` の登録名)で決まる。生成の `<Domain>Fields` が domain.json のメディア項目に付ける
- フォームの値は storage ref(`storage://…`)。保存時の採用・差し替え・削除はサーバーの CRUD 連動が行う(`src/lib/mediaInputSuite/README.md`)

## API

### Props

| props | 型 | 役割 |
|---|---|---|
| `control` / `methods` | react-hook-form | フォーム連携（必須） |
| `baseFields` | `FieldConfig[]` | ベースのフィールド定義 |
| `fieldPatches` | `Partial<FieldConfig>[]` | フィールドの部分上書き・追加 |
| `insertBefore` / `insertAfter` | `InsertFieldsMap` | フィールド定義の挿入 |
| `fieldGroups` | `FieldGroup[]` | セクション分け |
| `inlineGroups` | `InlineFieldGroup[]` | 横並び表示 |
| `beforeAll` / `afterAll` | `ReactNode` | 全フィールドの前後にUI差し込み |
| `beforeField` / `afterField` | `Partial<Record<フィールド名, ReactNode>>` | 特定フィールドの前後にUI差し込み |
| `beforeGroup` / `afterGroup` | `GroupContentMap`（キー: `FieldGroup.key`） | 特定グループの先頭・末尾にUI差し込み |
| `onMediaStateChange` | `(state: MediaState \| null) => void` | メディアアップロード状態の通知（`AppForm` 配下では省略可） |

### fieldPatches

- 同名の欄: 位置を保ったままベースの定義にマージ(上書き)
- 新しい欄: 末尾に追加(完全な `FieldConfig` が要る)

### insertBefore / insertAfter

- `InsertFieldsMap`(キー: 挿入先の欄名、または `"__first__"` / `"__last__"`)で定義を挿入する。挿入した欄にも `insertBefore` / `insertAfter` が再帰的に効く
- 処理の順: `insertBefore.__first__` → `baseFields`(パッチ適用 + 前後の挿入)→ `fieldPatches` の新規分 → `insertAfter.__last__`

### fieldGroups(セクション分け)

`FieldGroup[]` を渡すと、欄が `<fieldset>` のセクション(`FieldGroupSection`)に分かれて描かれる。domain.json のトップレベル `fieldGroups` でも宣言でき、生成の `XxxFields` が自動で読む(スキーマ定義: `src/domains/README.md`「FieldGroup（フィールドグループ）」)。

| プロパティ | 型 | 説明 |
|---|---|---|
| `key` | string | グループキー（一意識別子。`beforeGroup` / `afterGroup` のキーにもなる） |
| `label` | string | セクションの表示ラベル（legend） |
| `fields` | string[] | グループに含むフィールド名 |
| `collapsible` | boolean | 折りたたみ可能か（既定: false） |
| `defaultCollapsed` | boolean | 初期状態で折りたたむか（既定: false） |
| `bgColor` | string | 背景色（CSSカラーコード） |

- どのグループにも属さない欄は、全グループの後ろに「グループ外枠」としてまとめて描く
- `fields` に解決できる欄が 1 つも無いセクションは描かない(差し込みの指定があれば描く)

### beforeGroup / afterGroup

- `fieldGroups` を指定したときだけ効く。フラット表示では無視
- 折りたたむと欄と同じく隠れる
- グループ外枠には予約キー `UNGROUPED_GROUP_KEY`(`"__ungrouped__"`)で差し込む
- グループの欄が全部解決できなくても(パッチで外した等)、差し込みの指定があればセクションは描く(「このセクションは無効です」等の通知が出せる)

### inlineGroups(横並び)

`InlineFieldGroup[]` で複数の欄を 1 つの欄のように横に並べる。

- `key` / `label` / `fields` / `required` / `description`
- `fieldWidths`: Tailwind の幅クラス(省略 = 均等)
- `inputConfigs`: 各欄の前後に添える文字 `{ prefix?, suffix? }`、`fields` と同じ順(例: 期間の終了の前に「〜」、下限の後に「以上」)

### フォームの既定値(buildFormDefaultValues)

`buildFormDefaultValues(domainConfig, entity?)` が domain.json から `useForm` の `defaultValues` を作る。生成の Create / Edit フォームが使う(実行時に domain.json を読むので、既定値の変更に再生成は要らない)。

- 優先の順: 編集時は `entity` の値(null / undefined なら下の既定値)→ 欄の `defaultValue`(object / array も可)→ fieldType ごとの既定値
- fieldType ごとの既定値(型の表 `src/lib/domain/fields/fieldTypes.mjs` の `formDefault`、表に無い型は `""`): `array` / `stringArray` / `mediaUploaderMulti` / `mediaCollection` = `[]` | `jsonb` / `map` = `undefined`(値なし。schema の `.default()` や DB の既定値に任せる)| `boolean` = `false`(radio または options ありは `undefined`)| 数値・`enum`・timestamp = `undefined` | それ以外(文字列系・`mediaUploader`)= `""`
- `formInput: "checkbox"` は、値が文字列の配列の型(`array` / `stringArray`)なら複数選択(CheckGroupInput)、それ以外は 1 つのチェックボックス(型の表の `array` 属性。`Field/Configured/checkGroupFieldTypes.ts` は再 export)。編集時に値を `Date` にするのは表の `datetime` の型

## Internals

- メディアの欄(`mediaUploader` / `mediaUploaderMulti`)のアップロード状態は集めて `onMediaStateChange` で知らせる。`AppForm` の中では context で自動でつながる
- `purpose` の無いメディアの欄は入力を出さず、未設定のメッセージを出す(アップロード先が決まらないため)
- 既定値: 型ごとの答えは型の表から引く。手書きで残るのは型の名前の union(`Field/types.ts`)だけ
- zod の `.default()` は `undefined` のときだけ効く: 配列や object の schema に `""` を渡すと送信が落ちる
- 必須の jsonb を画面に出さない(formInput `none`)作成フォームは、既定値が `undefined` なので必須チェックで落ちる

## Verification

- 既定値と型の表・`formInputs.mjs`・union の突き合わせ: `pnpm test src/lib/formSuite/FieldRenderer/defaultValueBuilder.test.ts`(と typecheck)

## Related

- フォームの部品一式: `../README.md`
- domain.json の欄・fieldGroups・custom: `src/domains/README.md`
- 登録する入力部品: `src/wiring/formInputs/inputs/README.md`
- メディアの入力: `src/lib/mediaInputSuite/README.md`
