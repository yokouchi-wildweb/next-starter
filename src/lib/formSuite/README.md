# formSuite

## Overview

フォームの組み立て一式(閉じた lib、入口 `@/lib/formSuite` だけから読む)。入れ物 `AppForm`、欄の枠 `Field`(Manual / Controlled / Configured)、react-hook-form の `field` を受ける Controlled の入力(`ControlledTextInput` など)、設定から欄を並べる `FieldRenderer`、自動保存 `AutoSave`、送信の行 `FormActions`。

- 素の入力部品(Manual)・ラベル・選択肢の型は棚 `@/components/Input/<部品>`、ボタンは `@/components/Button/<部品>`。棚はこの lib を読まない(この lib が棚を読む)
- 使う時・直す時の決まりは札 .claude/rules/items/lib/formSuite.md にある

- 組み方は 3 つ: Input を組み合わせる(自由度が最も高い、変則レイアウト・独自 UI)| Field を使う(標準、一般的なフォーム)| Renderer を使う(自動生成、管理画面の CRUD フォーム)
- どの組み方にも Controlled(react-hook-form)と Manual(useState 等)の 2 系統がある

| 項目 | Controlled | Manual |
|---|---|---|
| 状態管理 | react-hook-form | useState / useReducer |
| バリデーション | zod + react-hook-form | 自前実装 |
| コンテナ | `AppForm` | `<form>` |
| Input | `Controlled<部品>`(`@/lib/formSuite`) | `@/components/Input/<部品>` |

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
| 自動保存の編集フォーム | `AutoSave`([AutoSave/README.md](./AutoSave/README.md)) |
| react-hook-form を使わない入れ物 | `<form>`(使うなら `AppForm`) |

## Usage

### 1. Input を組み合わせる

Controlled(`ManualFieldController` = Manual 配下の自由レイアウト用の入れ物):

```tsx
import { AppForm, ManualFieldController, ControlledSwitchInput } from "@/lib/formSuite";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";

<AppForm methods={form} onSubmit={handleSubmit}>
  <ManualFieldController control={control} name="notify">
    {(field) => (
      <Stack gap="xs">
        <ControlledSwitchInput field={field} label="通知設定" />
        <Para tone="muted" size="xs">補足テキスト</Para>
      </Stack>
    )}
  </ManualFieldController>
</AppForm>
```

Manual:

```tsx
import { SwitchInput } from "@/components/Input/SwitchInput";
import { Stack } from "@/components/Layout/Stack";
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
import { AppForm, ControlledField, ControlledEmailInput } from "@/lib/formSuite";

<AppForm methods={form} onSubmit={handleSubmit}>
  <ControlledField
    control={control}
    name="email"
    label="メールアドレス"
    required
    description={{ text: "確認メールを送信します" }}
    renderInput={(field) => <ControlledEmailInput field={field} />}
  />
</AppForm>
```

インライングループ(Controlled):

```tsx
import { ControlledFieldGroup, ControlledSelectInput } from "@/lib/formSuite";

<ControlledFieldGroup
  control={control}
  names={["birth_year", "birth_month", "birth_day"] as const}
  label="生年月日"
  required
  renderInputs={(fields) => [
    <ControlledSelectInput key="year" field={fields[0]} options={yearOptions} />,
    <ControlledSelectInput key="month" field={fields[1]} options={monthOptions} />,
    <ControlledSelectInput key="day" field={fields[2]} options={dayOptions} />,
  ]}
/>
```

単一フィールド(Manual):

```tsx
import { ManualField } from "@/lib/formSuite";
import { Input } from "@/components/Input/Input";

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
import { ManualFieldGroup } from "@/lib/formSuite";
import { SelectInput } from "@/components/Input/Select";

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

domain.json からフォームを自動生成する。Controlled のみ。カスタマイズ(パッチ・挿入、`fieldGroups`、差し込み `beforeAll` / `beforeField` / `beforeGroup` 等)は [FieldRenderer/README.md](./FieldRenderer/README.md)。

```tsx
import { AppForm, FieldRenderer } from "@/lib/formSuite";

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

## API

### AppForm

- `fieldSpace`: 欄の縦の間隔。`SpacingValue`(余白の段の名前 `none`〜`4xl` か画面幅ごとのオブジェクト、`src/lib/spacing/README.md`)、既定 `"lg"`(24px)
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

### FieldConfig のキー

- domain.json に書けるキーは `DomainField`(`@/lib/domain`)のまま。`FieldConfig` はそれを広げた物で、キーを写し直さない
- `fieldType` は省ける(画面で手で組む設定は型を書かないことがある。domain.json では必須)。型の名前は `@/lib/domain` の表から導く union(`FieldTypeName` など)で、この lib に一覧は無い
- この lib が狭める物: `formInput`(組み込みの名前 `BuiltinFormInput` + 登録した入力部品の名前)・`options`(`DomainFieldOption`)・`mediaTypePreset`・`validationRule`(メディアの形 `MediaValidationRule`)
- この lib が足す物(画面でだけ使う値): `purpose`(生成の Fields が付ける)・`onMetadataChange`・`asyncApiPath` / `asyncLabelField` / `asyncSearchFields`
- 新しい domain.json のキーは `DomainField` に足す(ここには足さない)

### 関連の選択肢(useRelationOptions)

- `useRelationOptions(写し)` が写し(`entities/display.ts`)の relations から関連先の選択肢を取り、`FieldRenderer` の `insertBefore` の形(`{ insertBefore, isLoading }`)で返す
- どの関連を出すか・全件を読むか・SWR のキーは `@/lib/domain` の `relationOptions.mjs`(SSR の先読みと生成器も同じ判定)

### メディアの欄

| 目的 | コンポーネント | 入力 | 使いどころ | 注意点 |
|---|---|---|---|---|
| 単独配置 | `ControlledMediaField` | `purpose` など | 単体フォームに手動で配置 | RHF の `methods` が必要 |
| 設定駆動 | `ConfiguredMediaField` | `MediaUploaderFieldConfig` | 設定ベースで配置 | `fieldConfig` を渡す |

- 消したメディアのフォーム値は `""`(必須の欄は「〇〇は必須です。」で止まる)。生成のスキーマが任意の欄の `""` を null にして保存する

## Extension

- 独自の入力部品: `src/wiring/formInputs/inputs/` に登録し、`formInput` に名前を書く([FieldRenderer/README.md](./FieldRenderer/README.md) Usage「登録された入力部品」)。この lib は一覧を知らず、Context(`FormInputsProvider`)と型だけを持つ
- 入力部品・ボタンの高さの段とその上書き: `src/components/Input/README.md`・`src/components/Button/README.md`「高さ(size)」

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
- Field(ControlledField / ConfiguredField)の入力の `aria-describedby` は、実際に描いた説明文(`description`)とエラーだけを指す(`Field/FieldControl.tsx`)

### Controlled と Manual

- Controlled の入力(`inputs/`、入口の名前は `Controlled` + 棚の部品の名前)は `src/components/Input` の部品を中でラップし、`field` を `value` / `onChange` へ変える
- 枠が入力へ渡す 3 つ(id・aria-describedby・aria-invalid)の型 `FormControlA11yProps` は棚の `@/components/Input/options` が持つ(この lib はそれを読むだけ)

## Verification

- 入力部品の読み上げの約束: `pnpm test src/lib/formSuite/a11yContract.test.tsx`(棚の Input の単位を全部歩く。表に無い部品・3 つを落とす部品で落ちる)
- 二重送信・失敗の扱い: `submitLock.test.ts`・`backgroundFailure.test.ts`・`*.render.test.tsx`(この lib の直下)

## Related

- 自動保存: [AutoSave/README.md](./AutoSave/README.md) | 設定から欄を並べる: [FieldRenderer/README.md](./FieldRenderer/README.md)

- 素の入力部品・選択肢の型と関数(`Options` など)・FilePickButton・入力の高さ: `src/components/Input/README.md`
- ボタン(読み込み中・形を自分で付ける押し口・高さ): `src/components/Button/README.md`
- 自動保存: `AutoSave/README.md`
- 設定から欄を並べる: `FieldRenderer/README.md`
- 登録する入力部品: `src/wiring/formInputs/inputs/README.md`
- 余白の段: `src/components/Layout/README.md`
- 高さのトークン: `src/styles/README.md`
