# Form コンポーネント

## Overview

フォームの部品一式(`@/components/Form`)。入れ物 `AppForm`、欄の枠 `Field`、入力部品 `Input`、設定から欄を並べる `FieldRenderer`、自動保存 `AutoSave`、`Button` / `FilePickButton`。

- 組み方は 3 つ: Input を組み合わせる(自由度が最も高い、変則レイアウト・独自 UI)| Field を使う(標準、一般的なフォーム)| Renderer を使う(自動生成、管理画面の CRUD フォーム)
- どの組み方にも Controlled(react-hook-form)と Manual(useState 等)の 2 系統がある

| 項目 | Controlled | Manual |
|---|---|---|
| 状態管理 | react-hook-form | useState / useReducer |
| バリデーション | zod + react-hook-form | 自前実装 |
| コンテナ | `AppForm` | `<form>` |
| Input | `Form/Input/Controlled/*` | `Form/Input/Manual/*` |

### 欄の種別

- 単一フィールド = 1 入力を 1 ラベルで扱う(メール、名前): `ControlledField` / `ManualField`
- インライングループ = 複数の入力を 1 ラベルで横に並べる(生年月日、郵便番号 + 住所): `ControlledFieldGroup` / `ManualFieldGroup`。1 つの欄として扱い、ラベル・説明・エラーはグループ単位

### 欄の段(早見表)

| 段 | 目的 | 代表コンポーネント | 向いている場面 | 備考 |
|---|---|---|---|---|
| **Manual** | 低レベル / 自由レイアウト | `ManualField` / `ManualFieldGroup` / `ManualFieldController` | useState 前提、または RHF で自由配置したい場合 | ManualFieldController は RHF 専用 |
| **Controlled** | RHF 連携の標準形 | `ControlledField` / `ControlledFieldGroup` | 一般的なフォーム | エラー自動取得 |
| **Configured** | 設定駆動で描画 | `ConfiguredField` / `ConfiguredFieldGroup` / `ConfiguredFields` | domain.json を使う運用 | `FieldConfig` を渡す |
| **Media** | メディアアップロード | `ControlledMediaField` / `ConfiguredMediaField` | 画像/動画のアップロード | `useMediaUploaderField` を利用 |
| **Renderer** | まとめて自動生成 | `FieldRenderer` | 管理画面CRUD | `mediaUploader` も扱える |

### どれを使うか

| 目的 | 推奨 |
|---|---|
| 一般的なフォーム | `ControlledField` / `ControlledFieldGroup` |
| 独自レイアウト | `ManualFieldController` + Controlled Input |
| 管理画面CRUD | `FieldRenderer` |
| 設定駆動フォーム | `ConfiguredField` / `ConfiguredFieldGroup` / `ConfiguredFields` |
| メディアアップロード | `ControlledMediaField` / `ConfiguredMediaField` |
| 単一入力 | `ControlledField` / `ManualField` |
| 横並び入力 | `ControlledFieldGroup` / `ManualFieldGroup` |
| 自動保存の編集フォーム | `AutoSave`(`AutoSave/README.md`) |
| react-hook-form を使わない入れ物 | `<form>`(使うなら `AppForm`) |

## Usage

### 1. Input を組み合わせる

Controlled(`ManualFieldController` = Manual 配下の自由レイアウト用の入れ物):

```tsx
import { AppForm } from "@/components/Form";
import { ManualFieldController } from "@/components/Form/Field";
import { SwitchInput } from "@/components/Form/Input/Controlled";
import { Stack } from "@/components/Layout";
import { Para } from "@/components/TextBlocks/Para";

<AppForm methods={form} onSubmit={handleSubmit}>
  <ManualFieldController control={control} name="notify">
    {(field) => (
      <Stack gap="xs">
        <SwitchInput field={field} label="通知設定" />
        <Para tone="muted" size="xs">補足テキスト</Para>
      </Stack>
    )}
  </ManualFieldController>
</AppForm>
```

Manual:

```tsx
import { SwitchInput } from "@/components/Form/Input/Manual";
import { Stack } from "@/components/Layout";
import { Para } from "@/components/TextBlocks/Para";

const [notify, setNotify] = useState(false);

<form onSubmit={handleSubmit}>
  <Stack gap="xs">
    <SwitchInput value={notify} onChange={setNotify} label="通知設定" />
    <Para tone="muted" size="xs">補足テキスト</Para>
  </Stack>
</form>
```

- 読み上げ用の名前: `aria-label="〇〇を有効にする"` は input にそのまま渡る。Field 経由なら FormLabel が名前になる

### 2. Field を使う

単一フィールド(Controlled):

```tsx
import { AppForm } from "@/components/Form";
import { ControlledField } from "@/components/Form/Field";
import { EmailInput } from "@/components/Form/Input/Controlled";

<AppForm methods={form} onSubmit={handleSubmit}>
  <ControlledField
    control={control}
    name="email"
    label="メールアドレス"
    required
    description={{ text: "確認メールを送信します" }}
    renderInput={(field) => <EmailInput field={field} />}
  />
</AppForm>
```

インライングループ(Controlled):

```tsx
import { ControlledFieldGroup } from "@/components/Form/Field";
import { SelectInput } from "@/components/Form/Input/Controlled";

<ControlledFieldGroup
  control={control}
  names={["birth_year", "birth_month", "birth_day"] as const}
  label="生年月日"
  required
  renderInputs={(fields) => [
    <SelectInput key="year" field={fields[0]} options={yearOptions} />,
    <SelectInput key="month" field={fields[1]} options={monthOptions} />,
    <SelectInput key="day" field={fields[2]} options={dayOptions} />,
  ]}
/>
```

単一フィールド(Manual):

```tsx
import { ManualField } from "@/components/Form/Field";
import { Input } from "@/components/Form/Input/Manual";

const [email, setEmail] = useState("");
const [error, setError] = useState<string>();

<form onSubmit={handleSubmit}>
  <ManualField label="メールアドレス" error={error} required>
    <Input
      type="email"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
    />
  </ManualField>
</form>
```

インライングループ(Manual):

```tsx
import { ManualFieldGroup } from "@/components/Form/Field";
import { SelectInput } from "@/components/Form/Input/Manual";

const [year, setYear] = useState("");
const [month, setMonth] = useState("");
const [day, setDay] = useState("");
const [yearError, setYearError] = useState<string>();
const [monthError, setMonthError] = useState<string>();
const [dayError, setDayError] = useState<string>();

<ManualFieldGroup
  label="生年月日"
  required
  errors={[yearError, monthError, dayError].filter(Boolean)}
>
  {[
    <SelectInput key="year" value={year} onChange={setYear} options={yearOptions} />,
    <SelectInput key="month" value={month} onChange={setMonth} options={monthOptions} />,
    <SelectInput key="day" value={day} onChange={setDay} options={dayOptions} />,
  ]}
</ManualFieldGroup>
```

### 3. Renderer を使う(管理画面向け)

domain.json からフォームを自動生成する。Controlled のみ。カスタマイズ(パッチ・挿入、`fieldGroups`、差し込み `beforeAll` / `beforeField` / `beforeGroup` 等)は `FieldRenderer/README.md`。

```tsx
import { AppForm } from "@/components/Form";
import { FieldRenderer } from "@/components/Form/FieldRenderer";

<AppForm methods={form} onSubmit={handleSubmit}>
  <FieldRenderer
    control={control}
    methods={form}
    baseFields={domainJson.fields}
    fieldGroups={[
      { key: "basic", label: "基本情報", fields: ["name", "email"] },
    ]}
    inlineGroups={[
      { key: "period", label: "期間", fields: ["startDate", "endDate"] },
    ]}
  />
</AppForm>
```

- `inlineGroups` = インライングループの定義。単一フィールドは `baseFields` にそのまま書く

### メディアの欄

`AppForm` の中のメディアの欄は、送信の成功でコミット、離脱で後始末まで自動(仕組みは Internals)。欄がいくつあっても commit を意識しない。

```tsx
<AppForm methods={methods} onSubmit={handleSubmit}>
  <ControlledMediaField
    control={control}
    methods={methods}
    name="mainImage"
    label="メイン画像"
    purpose="sample.main_image"
  />
  <ControlledMediaField
    control={control}
    methods={methods}
    name="subImage"
    label="サブ画像"
    purpose="sample.sub_image"
  />
  <Button type="submit">送信</Button>
</AppForm>
```

- キャンセルボタンで `resetAll()` を呼ばなくてよい(離脱時に後始末される)
- 自動コミットを止める: `AppForm` の `disableAutoCommitMedia`

### 選べない選択肢(Options.disabled)

「表示はするが選べない」選択肢(使用中・在庫切れ・権限なし・上限到達など)は `Options` に `disabled: true` を付ける。

```tsx
const tableOptions: Options[] = tables.map((t) => ({
  value: t.id,
  label: t.occupied ? `${t.name} (使用中)` : t.name,
  disabled: t.occupied,
}));
```

- FieldRenderer / 設定駆動の欄: `FieldConfig.options` の各要素に `disabled` を付ければ渡る(実行時の状態なので domain.json には書かず、画面で options を組み立てる)

### ファイル選択のボタン(FilePickButton)

```tsx
<FilePickButton variant="outline" size="xs" accept="video/mp4" onFiles={([file]) => setVideo(file)}>
  映像を選択
</FilePickButton>
```

- 押した後に別の処理を挟んでから開く形: `Button` + `Input`(`type="file" hidden`、ref で `click()`)

### 形を自分で付ける押し口

カードの行・表のセルの押し口: `Button variant="none" size="none"`(cursor・focus の輪・a11y は Button 共通)。

- 中のアイコンの大きさを呼び手が決める: `iconSizing="none"`(既定 `"auto"` は `size-*` の無い svg を 16px に揃える)
- 生の button と同じに戻す値: 行やカードは `block`(土台は inline-flex)・`whitespace-normal`・`text-[length:inherit] font-normal`、押しを親へ通すなら `propagateClick`
- 例: tableSuite のセルの押し口、purchaseRequest の共有の行、wallet の支払い方法のカード、AccountAvatarSection のアバター

### Button の読み込み中(loading / loadingLabel)

`Button`(`@/components/Form/Button`)と `TabletButton` は実行中の表示を `loading` で持つ。ボタンの中に Spinner を手で組まない。

```tsx
<Button onClick={save} disabled={!canSave} loading={isSaving} loadingLabel="保存中...">
  保存
</Button>
<Button variant="outline" onClick={apply} loading={isApplying} loadingLabel={null}>
  適用
</Button>
```

## API

### AppForm

- `fieldSpace`: 欄の縦の間隔。`SpacingValue`(余白の段の名前 `none`〜`4xl` か画面幅ごとのオブジェクト、`src/components/Layout/README.md`「余白」)、既定 `"lg"`(24px)
- `disableAutoCommitMedia`: メディアの自動コミットを止める

### layout / inputLayout

ControlledField / ManualField / ControlledFieldGroup / ManualFieldGroup / ConfiguredFieldGroup が受ける。

- `layout`(ラベルと入力の配置): `"vertical"`(既定)| `"horizontal"` | `"responsive"`(モバイルは縦、`md` 以上で横)
- `inputLayout`(グループ内の入力の配置、Group の 3 つだけ): `"vertical"` | `"horizontal"` | `"responsive"`
- `inputLayout` 未指定の既定は `layout` に連動: `vertical` → `horizontal` | `horizontal` → `vertical` | `responsive` → `responsive`
- `inputLayout="responsive"` で `fieldWidths` 未指定: モバイルは `w-full`、`md` 以上は `flex-1`

### 設定駆動の欄

`FieldConfig` を渡して描く。

| 目的 | コンポーネント | 入力 | 使いどころ | 注意点 |
|---|---|---|---|---|
| 単一フィールド | `ConfiguredField` | `fieldConfig` | 1項目だけ差し込みたいとき | `mediaUploader` は非対応 |
| 横並びグループ | `ConfiguredFieldGroup` | `fieldConfigs[]` | 生年月日/住所など | ラベルは先頭の `label` を利用可 |
| 縦並び一括 | `ConfiguredFields` | `fieldConfigs[]` / `names[]` | まとめて描画したいとき | `Stack` で縦間隔制御 |

- 欄の説明文は `FieldConfig.helperText` の 1 つだけ(domain.json の欄・設定の欄 `ui.field` も同じ名前)
- props の `description`(色・位置も指定できる)を渡すとそちらが優先
- 枠を持たない入力(`switchInput`・`stepperInput`・登録部品の `frame: false`)は helperText を描かない

### メディアの欄

| 目的 | コンポーネント | 入力 | 使いどころ | 注意点 |
|---|---|---|---|---|
| 単独配置 | `ControlledMediaField` | `purpose` など | 単体フォームに手動で配置 | RHF の `methods` が必要 |
| 設定駆動 | `ConfiguredMediaField` | `MediaUploaderFieldConfig` | 設定ベースで配置 | `fieldConfig` を渡す |

- 消したメディアのフォーム値は `""`(必須の欄は「〇〇は必須です。」で止まる)。生成のスキーマが任意の欄の `""` を null にして保存する

### Input の部品

| コンポーネント | 用途 |
|---|---|
| `Input` / `TextInput` | テキスト入力 |
| `NumberInput` | 数値入力 |
| `Textarea` | 複数行テキスト |
| `SelectInput` | 単一選択 |
| `ComboboxInput` | 単一選択(検索付き) |
| `AsyncComboboxInput` | 単一選択(非同期検索) |
| `MultiSelectInput` | 複数選択 |
| `AsyncMultiSelectInput` | 複数選択(非同期検索) |
| `RadioGroupInput` | ラジオボタン(`displayType`: `standard` 既定 / `classic` 丸い印 / `bookmark` / `rounded` / `segmented` = 1 つの溝に横並び、選んだものだけ白い札が浮く切り替え。2 つ以上いくつでも、高さ 36px = Button sm と同じ) |
| `CheckGroupInput` | チェックボックスグループ |
| `BooleanCheckboxInput` | 単一チェックボックス |
| `BooleanRadioGroupInput` | はい/いいえ ラジオ |
| `SingleCardCheckbox` | カード型チェックボックス |
| `SwitchInput` | トグルスイッチ |
| `DateInput` | 日付 |
| `TimeInput` | 時刻 |
| `DatetimeInput` | 日時 |
| `EmailInput` | メールアドレス |
| `PasswordInput` | パスワード(`autoComplete`: 登録済みを入れる欄 = `"current-password"`、新しく決める欄・管理者が他人に設定する欄 = `"new-password"`。未指定だと Safari 等が管理者自身の保存済みパスワードを自動入力する) |
| `OneTimeCodeInput` | ワンタイムコード(大文字化・ハイフン区切りの自動整形、`length` 文字そろうと `onComplete`。ペアリングコード・確認コード用) |
| `StepperInput` | 数値ステッパー |
| `FileInput` | ファイル選択 |

### 非同期の選ぶ欄(AsyncComboboxInput / AsyncMultiSelectInput)

- `renderOption?: AsyncOptionRenderer<T>` = `(option, item) => ReactNode`: 候補の行(単一の上に留める選んだ行・複数の「選択済み」の行も)をその node で描く(状態のバッジ・版を並べる等)。`AsyncPickerModal` も同じ形
  - `item` = 取得の cache にある元の行(初期表示のラベルだけで未取得なら `undefined`)
  - トリガーの表示(単一のラベル・複数のチップ)は `label` のまま
  - `AsyncMultiSelectInput` の `selectedView="inline"` の印(選択中・`optionBadge`)は `label` に添える物。`renderOption` を渡すと行は呼び手の node で描かれる(印も呼び手が描く)
- 範囲のタブ(AsyncComboboxInput だけ): `scopes={[{ value, label, count? }]}` で検索欄の下にタブ(`count` は「(n)」)
  - 選んだ範囲は `searchFn(params, { scope })` の第 2 引数で渡る(1 引数の searchFn はそのまま使える)
  - 範囲を替えると今のモード(先読み / 検索)の 1 ページ目を取り直す
  - 既定は `defaultScope` か先頭、制御は `scope` + `onScopeChange`
- 「すべて」(AsyncComboboxInput だけ): `allOption={{ value: "__all__", label: "すべて" }}` は候補の一番上に常に出る行。選ぶと `onChange(allOption.value)`、その値のときトリガーに `label`(値は呼び手が決める。未選択 = `null`・クリアとは別)

### 選べない選択肢(Options.disabled)

- 受ける部品: `SelectInput` / `ComboboxInput` / `MultiSelectInput` / `RadioGroupInput` / `CheckGroupInput`(全 displayType)/ `AsyncOptionList` 系(`getOptionFromResult` で `disabled` を返す。`disabledValues` とは OR)
- 選択済みの値は選ばれたまま残り、その項目からは外せない(値は書き換えない)
- 「(使用中)」等の文言は core が付けない → `label` に含める(`AsyncOptionList` のみ `disabledLabelSuffix` も使える)
- 表示の制御だけ: Zod もサーバーも拒否しない

### FilePickButton

`@/components/Form`。`label` の中に隠した file の `Input` を持ち、見た目は同じ `variant` / `size` の `Button` と同じ。

- `onFiles(files: File[])` で選んだファイルを受け、その後 input を空に戻す(同じファイルを続けて選んでも毎回呼ばれる)
- キーボード: Tab で止まり Enter / Space で開く。`disabled` では止まらず開かない

### Button の loading / loadingLabel

- `loading`: true のとき押せなくし(`disabled`)、`aria-busy` を付け、子の前に Spinner(既定の形)を出す。`disabled` の式に実行中の値を足さなくてよい
- `loadingLabel`: 読み込み中に子の代わりに出す中身。未指定 = 子のまま(Spinner + 子)、文字 = Spinner + その文字、`null` = Spinner だけ
- 渡さなければ今の出力のまま(DOM・class とも変わらない)
- `asChild` では効かない: 子(Link など)に Spinner を足さず、`disabled` / `aria-busy` だけ付く
- `PseudoButton`(div で描く)は持たない

### 操作部品の高さ(size)

ボタン・入力欄・選ぶ欄の引き金は、同じ名前の `size` で同じ高さになる。

| size | xxxs | xxs | xs | sm | md(既定) | lg | xl | xxl | xxxl |
|---|---|---|---|---|---|---|---|---|---|
| 高さ | 24px | 28px | 32px | 36px | 44px(640px 以上 40px) | 44px | 48px | 56px | 64px |

- md だけ画面の幅で変わる(スマホで押しやすい 44px、640px 以上 = `@media (min-width: 40rem)` で 40px)
- `Button` / `LinkButton` / `PseudoButton` / `FilePickButton`: 9 段すべて。`icon`(36px の正方形)と `none` は段の外
- `TabletButton`: 別の段 `--tablet-control-h-xxs`〜`xl`(48 / 56 / 64 / 72 / 80 / 96px)。`icon` / `icon-lg` は段の外
- 入力欄系(`Input` / `TextInput` / `EmailInput` / `NumberInput` / `PasswordInput` / `OneTimeCodeInput` / `DateInput` / `TimeInput` / `DatetimeInput` / `ColorInput`、Controlled も同じ): `size` は xs〜xl(既定 md)、高さ固定 + `py-0` で中身を上下中央に置く。表 `INPUT_SIZE_CLASSES` / `inputVariants`(`Input/Manual/Input.tsx`)
- 選ぶ欄の引き金(`SelectInput` / `ComboboxInput` / `AsyncComboboxInput` / `MultiSelectInput` / `AsyncMultiSelectInput`): 入力欄と同じ xs〜xl。引き金は 1 行(選んだ物が多いときは省略)。素の層 `Primitives/Select` の `SelectTrigger` は `default` 36px / `sm` 32px / `none`(高さを付けない)
- 欄の中の小さなボタン(クリア ×・パスワードの表示の切り替え・暦 / 時計): 欄の段 − 8px の正方形(上下・右に 4px)、欄の右の余白は段の高さ。表 `INNER_BUTTON_CLASSES` / `INNER_BUTTON_PADDING`(`Input.tsx`)
- `StepperInput`: 名前は xs / s / m / l のまま(既定 s)、外枠と両端のボタンが段 xxs 28px / sm 36px / md 44・40px / xl 48px
- HTML の `size` 属性(表示する文字数の目安)は `htmlSize` で渡す(`size` は高さの段)
- 対象外(段に乗らない): `Textarea`(`min-h-16` で内容に合わせて伸びる)・`SwitchInput`・チェックボックス・ラジオ・カード型チェック(それぞれ自分の size)

## Extension

- 独自の入力部品: `src/wiring/formInputs/inputs/` に登録し、`formInput` に名前を書く(`FieldRenderer/README.md` Usage「登録された入力部品」)。このフォルダは一覧を知らず、Context と型だけを持つ
- 高さの段: fork は CSS の変数 `--control-h-<size>`(`src/styles/core/config.css` の `:root`)を上書きすれば全部品の高さが揃って動く(`src/styles/README.md`「トークンで動く範囲」)
- 高さの上書きの順: 部品の表 → `src/config/ui/variants.config.ts`(入力欄系と引き金は `input` を共有、ボタンは `button`、Stepper は `stepperInput`)→ 要素の `className`(後ろが勝つ。高さを個別に変えるときだけ)

## Internals

### 送信

- 二重送信は同期のロックで防ぐ(`submitLock.ts`): 送信中(検証 → `onSubmit` → メディアのコミット)に来た 2 回目は `onSubmit` を呼ばずに捨て、ロックは成功・失敗のどちらでも外れる。`isSubmitting` / `pending` は次の描画まで効かないので、同じフレームの連打はこのロックが止める
- 失敗 = `onSubmit`(またはメディアのコミット)が投げる(`src/lib/unsavedGuard` の約束)。`AppForm` は失敗すると未保存の守りを戻し、成功の扱い(守りを外したまま)をしない
- 失敗は `<form>` の送信の口で受け止めるので、未処理の reject として外へ漏れない。`onSubmit` の中で await する呼び手(`customSubmit` など)には失敗がそのまま届く

### メディアの自動コミット / 後始末

| イベント | 動作 | 仕組み |
|---------|------|--------|
| フォーム送信成功 | 全メディアを自動コミット | `AppForm` が `commitAll()` を呼び出し |
| ページ離脱 / アンマウント | 未コミットのメディアを自動削除 | `cleanupOnUnmount` による |
| アップロード中 | 送信ボタン自動無効化 | `AppForm` の `fieldset disabled` |
| アップロードが失敗したまま | 送信を止めてトーストを出す(欄は無効にしない。やり直し・取り消しで外れる) | 登録の `hasFailed`(`backgroundFailure.ts`) |

- 自動コミットするもの: `FieldRenderer`(メディアの欄を含む)・`ConfiguredMediaField`・`ControlledMediaField`(どれも `AppForm` の中で)
- 裏で処理する欄が失敗したままなら送らない(古い値で黙って保存しない)。メディア以外の非同期の欄も、`registerMediaHandle` に渡す `MediaHandleEntry` の `hasFailed` を返せば同じく止まる(`FieldRenderer` の `onHandleChange` も同じ)
- サイズの上限はサーバーが用途の `maxBytes` を署名に入れて GCS が強制する(`validationRule` は画面の事前の確認だけ)

### 説明文と読み上げ

- 説明文(`helperText` / `description`)は枠(ControlledField)がラベルの下に描き、入力の `aria-describedby` が指す。組み込み・登録部品(`frame: true`)・メディア(`ConfiguredMediaField` / `ConfiguredMediaMultiField`)のどれも同じ
- Field(ControlledField / ConfiguredField)の入力の `aria-describedby` は、実際に描いた説明文(`description`)とエラーだけを指す(`Form/Field/FieldControl.tsx`)

### 非同期の候補の取得

- `AsyncComboboxInput` / `AsyncMultiSelectInput` / `Overlays/AsyncPickerModal` の取得エンジン(browse ページング・Enter 検索・searchRank・無限スクロール・requestId 競合破棄・ラベル cache)は `Input/Manual/AsyncOptionSource/useAsyncOptionSource` 1 本
- 新しいピッカーはこのフック + `AsyncOptionList` / `AsyncOptionInitialState` / `AsyncOptionListFooter` を使い、各部品が持つのは選択モデル(単一 / 複数 / session snapshot)とクロームだけ
- アクションボタンから「マスタから N 件取り込む」用途はフォームの欄でなく `Overlays/AsyncPickerModal`

### Controlled と Manual

- Controlled Input は Manual Input を中でラップし、`field` を `value` / `onChange` へ変える

## Verification

- 入力部品の読み上げの約束: `pnpm test src/components/Form/Input/`(`Input/a11yContract.test.tsx` の表。表に無い部品・3 つを落とす部品で落ちる)
- 二重送信・失敗の扱い: `submitLock.test.ts`・`backgroundFailure.test.ts`・`*.render.test.tsx`(このフォルダ)

## Related

- 自動保存: `AutoSave/README.md`
- 設定から欄を並べる: `FieldRenderer/README.md`
- 登録する入力部品: `src/wiring/formInputs/inputs/README.md`
- 余白の段: `src/components/Layout/README.md`
- 高さのトークン: `src/styles/README.md`
