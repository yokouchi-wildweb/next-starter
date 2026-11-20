# Input

## Overview

- 入力部品(値と onChange だけを受ける素の入力)の棚。react-hook-form を読まない。フォームの枠・react-hook-form との結び付けは lib formSuite(`src/lib/formSuite`、Field / Controlled の入力 / FieldRenderer)。棚はその lib を読まない
- 入口は部品(単位)ごと: `@/components/Input/<Name>`(フォルダの単位はその index。`Input/index.ts` は無い)。ファイル名は部品名と違うことがある(`Select` = `SelectInput`、`StepperInput` は default export)
- 使う時・直す時の決まりは札 `.claude/rules/items/components/Input.md`。この README は使い方と仕組み

| 単位 | 用途 |
|---|---|
| `Input` | テキスト入力(段の表 `INPUT_SIZE_CLASSES` / `inputVariants`、欄の中のボタンの表 `INNER_BUTTON_CLASSES` / `INNER_BUTTON_PADDING` もここ) |
| `NumberInput` | 数値入力 |
| `Textarea` | 複数行テキスト |
| `PasswordInput` | パスワード(`autoComplete` 必須: 登録済みを入れる欄 = `"current-password"`、新しく決める欄・管理者が他人に設定する欄 = `"new-password"`。未指定だと Safari 等が管理者自身の保存済みパスワードを自動入力する) |
| `OneTimeCodeInput` | ワンタイムコード(大文字化・ハイフン区切りの自動整形、`length` 文字そろうと `onComplete`) |
| `DateInput` / `TimeInput` / `DatetimeInput` | 日付 / 時刻 / 日時(時刻の欄 `TimeFields` は TimeInput と DatetimeInput が使う単位) |
| `FileInput` | ファイル選択 |
| `FilePickButton` | ボタンの形のファイル選択 |
| `ColorInput` / `ColorValueInput` | 色(値の文字欄つき = ColorValueInput) |
| `Select`(`SelectInput`) | 単一選択 |
| `ComboboxInput` | 単一選択(検索付き) |
| `MultiSelectInput` | 複数選択 |
| `AsyncComboboxInput` / `AsyncMultiSelectInput` | 非同期検索の単一 / 複数選択 |
| `AsyncOptionSource` | 非同期の候補の取得の土台(フック・候補の一覧・状態の表示) |
| `RadioGroupInput` / `BooleanRadioGroupInput` | ラジオ / はい・いいえ(RadioGroupInput の `displayType`: `standard` 既定 / `classic` 丸い印 / `bookmark` / `rounded` / `segmented` = 1 つの溝に横並び、選んだものだけ白い札が浮く切り替え。2 つ以上いくつでも、高さ 36px = Button sm と同じ) |
| `CheckGroupInput` / `BooleanCheckboxInput` / `SingleCardCheckbox` | チェックボックスの群 / 単一 / カード型 |
| `SwitchInput` | トグルスイッチ |
| `StepperInput` | 数値ステッパー |
| `Label` | ラベル |
| `options` | 選択肢の型と関数(API) |

## Usage

### 組み合わせて使う

```tsx
import { Label } from "@/components/Input/Label";
import { SelectInput } from "@/components/Input/Select";

<Label htmlFor="status">状態</Label>
<SelectInput id="status" options={STATUS_OPTIONS} value={status} onChange={setStatus} />
```

- 枠(ラベル・説明・エラー)ごと要るときは lib formSuite(`src/lib/formSuite`)の Field / FieldRenderer を使う

### 選べない選択肢(Options.disabled)

- 「表示はするが選べない」選択肢は `Options` に `disabled: true` を付ける
- 受ける部品: `SelectInput` / `ComboboxInput` / `MultiSelectInput` / `RadioGroupInput` / `CheckGroupInput`(全 displayType)/ `AsyncOptionList` 系(`getOptionFromResult` で `disabled` を返す。`disabledValues` とは OR)
- 選択済みの値は選ばれたまま残り、その項目からは外せない(値は書き換えない)
- 「(使用中)」等の文言は付かない → `label` に含める(`AsyncOptionList` のみ `disabledLabelSuffix` も使える)

### 非同期の選ぶ欄(AsyncComboboxInput / AsyncMultiSelectInput)

- `renderOption?: AsyncOptionRenderer<T>` = `(option, item) => ReactNode`: 候補の行をその node で描く。`item` = 取得の cache にある元の行(未取得なら `undefined`)。トリガーの表示は `label` のまま
- 範囲のタブ(AsyncComboboxInput だけ): `scopes={[{ value, label, count? }]}`。選んだ範囲は `searchFn(params, { scope })` の第 2 引数、替えると今のモードの 1 ページ目を取り直す。既定は `defaultScope` か先頭、制御は `scope` + `onScopeChange`
- 「すべて」(AsyncComboboxInput だけ): `allOption={{ value, label }}` は候補の一番上に常に出る行。選ぶと `onChange(allOption.value)`

### FilePickButton

```tsx
<FilePickButton variant="outline" size="xs" accept="video/mp4" onFiles={([file]) => setVideo(file)}>
  映像を選択
</FilePickButton>
```

- `label` の中に隠した file の `Input` を持ち、見た目は同じ `variant` / `size` の Button と同じ
- `onFiles(files: File[])` の後 input を空に戻す(同じファイルを続けて選んでも毎回呼ばれる)
- 押した後に別の処理を挟んでから開く形: Button + `Input`(`type="file" hidden`、ref で `click()`)

## API

### options(`@/components/Input/options`)

- 型: `OptionValue`(string | number | boolean)・`Options`(`{ label, value, color?, disabled? }`)・`OptionPrimitive`(= `Options["value"]`)
- 型 `FormControlA11yProps`: 欄の枠(lib formSuite の FormControl)が入力へ渡す 3 つ(`id`・`aria-describedby`・`aria-invalid`)。入力部品はこれを props に足す
- 関数: `serializeOptionValue`(値 → 文字列、null は空)・`normalizeOptionValues`(配列でなければ空)・`includesOptionValue`・`toggleOptionValue`(文字列にして比べる)・`resolveOptionItemIdentity`(cmdk の行の同一性)・`resolveOptionSearchText`(検索用の文字)

### 高さ(size)

- 入力欄系(`Input` / `NumberInput` / `PasswordInput` / `OneTimeCodeInput` / `DateInput` / `TimeInput` / `DatetimeInput` / `ColorInput`)と選ぶ欄の引き金(`SelectInput` / `ComboboxInput` / `AsyncComboboxInput` / `MultiSelectInput` / `AsyncMultiSelectInput`): `size` は xs〜xl(既定 md)、Button の同じ名前の段と同じ高さ
- 欄の中の小さなボタン(クリア・パスワードの表示・暦 / 時計): 欄の段 − 8px の正方形
- `StepperInput`: xs / s / m / l(既定 s)
- HTML の `size` 属性は `htmlSize`
- 段に乗らない: `Textarea`・`SwitchInput`・チェックボックス・ラジオ・カード型チェック(それぞれ自分の size)

## Internals

### 読み上げの約束

- 入力部品は `id`・`aria-describedby`・`aria-invalid`(`FormControlA11yProps`、`@/components/Input/options`)を受け、フォーカスされる要素(群は群の入れ物)へ付ける。説明文は枠が描く
- `src/lib/formSuite/a11yContract.test.tsx` がこのフォルダの単位を全部歩く(枠に入れた形も同じテストが見る): 入力の単位は表 `UNITS` に描き方、入力でない単位は `NOT_INPUTS` に理由

### 非同期の候補の取得

- `AsyncComboboxInput` / `AsyncMultiSelectInput` / `Overlays/AsyncPickerModal` の取得(browse のページ送り・Enter 検索・searchRank・無限スクロール・古い応答の破棄・ラベルの cache)は `AsyncOptionSource` の `useAsyncOptionSource` 1 本
- 各部品が持つのは選択の形(単一 / 複数 / session snapshot)と見た目だけ。`AsyncMultiSelectInput` のトリガーは `MultiSelectInput` の入口が出す `MultiSelectTrigger`

## Related

- フォームの枠・react-hook-form との結び付け: `src/lib/formSuite/README.md`
- 候補のポップオーバー: `src/components/Overlays/Popover/README.md`
- 大量マスタからの選択モーダル: `src/components/Overlays/AsyncPickerModal/README.md`
