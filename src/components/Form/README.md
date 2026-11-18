# Form コンポーネント

## 目的

このプロジェクトでは、フォームは **3つの方法** で構築できる。  
各方法は **Controlled（react-hook-form）** と **Manual（useState 等）** の2系統がある。  
本ドキュメントは「どの場面でどのコンポーネントを使うか」を即判断できることを目的とする。

---

## フォーム構築の3つの方法

| 方法 | 特徴 | 主な用途 |
|---|---|---|
| **Input を組み合わせる** | 自由度が最も高い | 変則レイアウト / 独自UI |
| **Field を使う** | 標準的で安定 | 一般的なフォーム |
| **Renderer を使う** | 自動生成 | 管理画面のCRUDフォーム |

---

## Controlled / Manual の対応

| 項目 | Controlled | Manual |
|---|---|---|
| 状態管理 | react-hook-form | useState / useReducer |
| バリデーション | zod + react-hook-form | 自前実装 |
| コンテナ | `AppForm` | `<form>` |
| Input | `Form/Input/Controlled/*` | `Form/Input/Manual/*` |

Controlled Input は Manual Input を内部でラップして、`field` を `value/onChange` へ変換する。

`AppForm` は二重送信を同期のロックで防ぐ（`submitLock.ts`）。送信中（検証 → `onSubmit` → メディアのコミット）に来た 2 回目の送信は `onSubmit` を呼ばずに捨て、ロックは成功・失敗のどちらでも外れる。`isSubmitting` / `pending` は次の描画まで効かないため、同じフレームの連打はこのロックが止める。フォームの側で ref ロックを足す必要はない。

送信の失敗は `onSubmit`（またはメディアのコミット）が投げて知らせる（失敗 = throw。`src/lib/unsavedGuard` の約束）。`AppForm` は失敗すると未保存の守りを戻し、成功の扱い（守りを外したままにする）をしない。失敗は `<form>` の送信の口で受け止めるので、未処理の reject として外へ漏れない。報告（エラーの toast）は投げた側が出し、`AppForm` は何も出さない。`onSubmit` の中で await する呼び手（`customSubmit` など）には失敗がそのまま届く。

---

独自の入力部品は `src/wiring/formInputs/inputs/` に登録し、`formInput` に名前を書く（`FieldRenderer/README.md`「登録された入力部品」）。このフォルダは一覧を知らず、Context と型だけを持つ。

## フィールド種別（必ず意識する）

フォームの入力は **単一フィールド** と **インライングループ** に分かれる。  
どちらを選ぶかで使うコンポーネントが変わる。

| 種別 | 説明 | Controlled | Manual | 典型例 |
|---|---|---|---|---|
| 単一フィールド | 1入力を1ラベルで扱う | `ControlledField` | `ManualField` | メール、名前 |
| インライングループ | 複数入力を1ラベルで横並び表示 | `ControlledFieldGroup` | `ManualFieldGroup` | 生年月日、郵便番号+住所 |

インライングループは **1つのフィールドとして扱う** ため、  
ラベル・説明・エラー表示はグループ単位でまとめて扱う。

---

## フィールドレベルの分類（早見表）

フォームの粒度・設定情報の多さで使うコンポーネントが変わる。

| レベル | 目的 | 代表コンポーネント | 向いている場面 | 備考 |
|---|---|---|---|---|
| **Manual** | 低レベル / 自由レイアウト | `ManualField` / `ManualFieldGroup` / `ManualFieldController` | useState 前提、または RHF で自由配置したい場合 | ManualFieldController は RHF 専用 |
| **Controlled** | RHF 連携の標準形 | `ControlledField` / `ControlledFieldGroup` | 一般的なフォーム | エラー自動取得 |
| **Configured** | 設定駆動で描画 | `ConfiguredField` / `ConfiguredFieldGroup` / `ConfiguredFields` | domain.json を使う運用 | `FieldConfig` を渡す |
| **Media** | メディアアップロード | `ControlledMediaField` / `ConfiguredMediaField` | 画像/動画のアップロード | `useMediaUploaderField` を利用 |
| **Renderer** | まとめて自動生成 | `FieldRenderer` | 管理画面CRUD | `mediaUploader` も扱える |

---

## 1. Input を使う（自由度が最も高い）

### Controlled

ManualFieldController は Manual 配下の自由レイアウト用コンテナとして整理しています。

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

### Manual

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

- 見えるラベルを出さないスイッチ・チェックボックス(一覧の行内トグル等)は `aria-label="〇〇を有効にする"` を渡して読み上げ用の名前を付ける(input にそのまま渡る)。Field 経由なら FormLabel が名前になるので不要
- Field(ControlledField / ConfiguredField)の入力の `aria-describedby` は、実際に描画した説明文(`description`)とエラーだけを指す(`Form/Field/FieldControl.tsx`)。`_shadcn/form` の `FormControl` を直接使わない
- 入力部品の約束: Form/Input の部品は `id`・`aria-describedby`・`aria-invalid`(`FormControlA11yProps`)を受け、フォーカスされる要素(input・トリガーのボタン)へ付ける。選択肢の組・複合の部品(radio・checkGroup・ColorValueInput)は `role="group"` / `"radiogroup"` の入れ物へ付ける。部品を足したら `src/components/Form/Input/a11yContract.test.tsx` の表に描き方を足す(`pnpm test src/components/Form/Input/`。表に無い部品・3 つを落とす部品で落ちる)

---

## 2. Field を使う（標準的なフォーム）

### 単一フィールド（Controlled）

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

### インライングループ（Controlled）

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

### 単一フィールド（Manual）

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

### インライングループ（Manual）

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

---

## レイアウトプロパティ（layout / inputLayout）

ControlledField / ManualField / ControlledFieldGroup / ManualFieldGroup / ConfiguredFieldGroup で使用可能。

### layout（ラベルと入力の配置）

- `"vertical"`: 縦並び（デフォルト）
- `"horizontal"`: 横並び
- `"responsive"`: モバイルは縦、`md` 以上で横並び

### inputLayout（グループ内の入力配置）

ControlledFieldGroup / ManualFieldGroup / ConfiguredFieldGroup のみ。

- `"vertical"`: 入力を縦並び
- `"horizontal"`: 入力を横並び
- `"responsive"`: モバイルは縦、`md` 以上で横並び

inputLayout 未指定時のデフォルトは `layout` に連動します。

- `layout="vertical"` → `inputLayout="horizontal"`
- `layout="horizontal"` → `inputLayout="vertical"`
- `layout="responsive"` → `inputLayout="responsive"`

`inputLayout="responsive"` かつ `fieldWidths` 未指定の場合、モバイルは `w-full`、`md` 以上は `flex-1` を採用します。

---

## 設定駆動フィールドの使い分け

`FieldConfig` を渡して描画する高レベルコンポーネント。  
表示順・一括描画・インライン化の用途で使い分ける。

- 欄の説明文は `FieldConfig.helperText` の 1 つだけ(domain.json の欄・設定の欄 `ui.field` も同じ名前)。枠(ControlledField)がラベルの下に描き、入力の `aria-describedby` が指す。組み込み・登録部品(`frame: true`)・メディア(`ConfiguredMediaField` / `ConfiguredMediaMultiField`)のどれも枠が描き、入力部品の中には描かない
- props の `description`(色・位置も指定できる)を渡したときはそちらが優先。枠を持たない入力(`switchInput`・`stepperInput`・登録部品の `frame: false`)は helperText を描かない

| 目的 | コンポーネント | 入力 | 使いどころ | 注意点 |
|---|---|---|---|---|
| 単一フィールド | `ConfiguredField` | `fieldConfig` | 1項目だけ差し込みたいとき | `mediaUploader` は非対応 |
| 横並びグループ | `ConfiguredFieldGroup` | `fieldConfigs[]` | 生年月日/住所など | ラベルは先頭の `label` を利用可 |
| 縦並び一括 | `ConfiguredFields` | `fieldConfigs[]` / `names[]` | まとめて描画したいとき | `Stack` で縦間隔制御 |

---

## メディアフィールドの使い分け

| 目的 | コンポーネント | 入力 | 使いどころ | 注意点 |
|---|---|---|---|---|
| 単独配置 | `ControlledMediaField` | `purpose` など | 単体フォームに手動で配置 | RHF の `methods` が必要 |
| 設定駆動 | `ConfiguredMediaField` | `MediaUploaderFieldConfig` | 設定ベースで配置 | `fieldConfig` を渡す |

---

## メディアの自動コミット / クリーンアップ

`AppForm` 内でメディアフィールドを使用すると、**自動的にコミットとクリーンアップが行われる**。

### 自動化される動作

| イベント | 動作 | 仕組み |
|---------|------|--------|
| フォーム送信成功 | 全メディアを自動コミット | `AppForm` が `commitAll()` を呼び出し |
| ページ離脱 / アンマウント | 未コミットのメディアを自動削除 | `cleanupOnUnmount` による |
| アップロード中 | 送信ボタン自動無効化 | `AppForm` の `fieldset disabled` |
| アップロードが失敗したまま | 送信を止めてトーストを出す(欄は無効にしない。やり直し・取り消しで外れる) | 登録の `hasFailed`(`backgroundFailure.ts`) |

### 対応コンポーネント

| コンポーネント | AppForm 内での自動コミット |
|---------------|--------------------------|
| `FieldRenderer`（メディアフィールド含む） | ✓ 自動 |
| `ConfiguredMediaField` | ✓ 自動 |
| `ControlledMediaField` | ✓ 自動 |
| `AppForm` 外で使用 | 手動で `commit()` を呼ぶ必要あり |

### 使用例

```tsx
// 複数のメディアフィールドがあっても、commit を意識する必要なし
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

### 注意事項

- `AppForm` 外でメディアフィールドを使う場合は、手動で `commit()` を呼ぶ必要がある
- キャンセルボタンで `resetAll()` を呼ぶ必要はない（ページ離脱時に自動クリーンアップ）
- `disableAutoCommitMedia` prop で自動コミットを無効化可能
- 裏で処理する欄(アップロードなど)が失敗したままなら送らない(古い値で黙って保存しない)。メディア以外の非同期の欄も、`registerMediaHandle` に渡す `MediaHandleEntry` の `hasFailed` を返せば同じく止まる(`FieldRenderer` の `onHandleChange` も同じ)
- 消したメディアのフォーム値は `""`(必須の欄は「〇〇は必須です。」で止まる)。生成のスキーマが任意の欄の `""` を null にして保存する。サイズの上限はサーバーが用途の `maxBytes` を署名に入れて GCS が強制する(`validationRule` は画面の事前の確認だけ)

---

## 3. Renderer を使う（管理画面向け）

domain.json からフォームを自動生成する。**Controlled のみ対応**。

カスタマイズ（フィールドのパッチ・挿入、セクション分け `fieldGroups`、UI差し込みスロット `beforeAll` / `beforeField` / `beforeGroup` 等）の詳細は [FieldRenderer/README.md](./FieldRenderer/README.md) を参照。

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

`inlineGroups` は **インライングループ用の定義**。  
単一フィールドは `baseFields` にそのまま定義する。

---

## コンテナ（フォーム全体）

| react-hook-form | コンテナ |
|---|---|
| 使う | `AppForm` |
| 使わない | `<form>` |

`AppForm` は `fieldSpace` で縦方向の間隔を統一できる。`fieldSpace` は `SpacingValue` 型(余白の段の名前 `none`〜`4xl` か画面幅ごとのオブジェクト、`src/components/Layout/README.md`「余白」)を受け取り、デフォルトは `"lg"`(24px)。

---

## どれを使うべきか（早見表）

| 目的 | 推奨 |
|---|---|
| 一般的なフォーム | `ControlledField` / `ControlledFieldGroup` |
| 独自レイアウト | `ManualFieldController` + Controlled Input |
| 管理画面CRUD | `FieldRenderer` |
| 設定駆動フォーム | `ConfiguredField` / `ConfiguredFieldGroup` / `ConfiguredFields` |
| メディアアップロード | `ControlledMediaField` / `ConfiguredMediaField` |
| 単一入力 | `ControlledField` / `ManualField` |
| 横並び入力 | `ControlledFieldGroup` / `ManualFieldGroup` |

---

## 操作部品の高さ(size)

ボタン・入力欄・選ぶ欄の引き金は、同じ名前の `size` で同じ高さになる。高さは段のトークン `--control-h-<size>`(`src/styles/core/config.css` の `:root`)から取り、数値の `h-*` は持たない。fork は CSS の変数を上書きすれば全部品の高さが揃って動く(`src/styles/README.md`「トークンで動く範囲」)。

| size | xxxs | xxs | xs | sm | md(既定) | lg | xl | xxl | xxxl |
|---|---|---|---|---|---|---|---|---|---|
| 高さ | 24px | 28px | 32px | 36px | 44px(640px 以上 40px) | 44px | 48px | 56px | 64px |

- md だけ画面の幅で変わる(スマホで押しやすい 44px、640px 以上 = `@media (min-width: 40rem)` で 40px)
- `Button` / `LinkButton` / `PseudoButton` / `FilePickButton`: 9 段すべて。`icon`(36px の正方形)と `none` は段の外
- `TabletButton`: 別の段 `--tablet-control-h-xxs`〜`xl`(48 / 56 / 64 / 72 / 80 / 96px)。`icon` / `icon-lg` は段の外
- 入力欄系(`Input` / `TextInput` / `EmailInput` / `NumberInput` / `PasswordInput` / `OneTimeCodeInput` / `DateInput` / `TimeInput` / `DatetimeInput` / `ColorInput`、Controlled も同じ): `size` は xs〜xl(既定 md)、高さ固定 + `py-0` で中身を上下中央に置く。表 `INPUT_SIZE_CLASSES` / `inputVariants`(`Input/Manual/Input.tsx`)
- 選ぶ欄の引き金(`SelectInput` / `ComboboxInput` / `AsyncComboboxInput` / `MultiSelectInput` / `AsyncMultiSelectInput`): 入力欄と同じ xs〜xl。引き金は 1 行(選んだ物が多いときは省略)。素の層 `Primitives/Select` の `SelectTrigger` は `default` 36px / `sm` 32px / `none`(高さを付けない)
- 欄の中の小さなボタン(クリア ×・パスワードの表示の切り替え・暦 / 時計): 欄の段 − 8px の正方形(上下・右に 4px)、欄の右の余白は段の高さ。表 `INNER_BUTTON_CLASSES` / `INNER_BUTTON_PADDING`(`Input.tsx`)。fork が自分の欄に中のボタンを置くときもこの表を使う
- `StepperInput`: 名前は xs / s / m / l のまま(既定 s)、外枠と両端のボタンが段 xxs 28px / sm 36px / md 44・40px / xl 48px
- HTML の `size` 属性(表示する文字数の目安)は `htmlSize` で渡す(`size` は高さの段)
- 隣に並べるボタンと欄は同じ `size` を渡せば揃う。高さを合わせるための `h-auto py-3` や `data-[size=sm]:h-*` の上書きは書かない
- 上書きの順: 部品の表 → `src/config/ui/variants.config.ts`(入力欄系と引き金は `input` を共有、ボタンは `button`、Stepper は `stepperInput`)→ 要素の `className`(後ろが勝つ。高さを個別に変えるときだけ使う)
- 対象外(段に乗らない): `Textarea`(`min-h-16` で内容に合わせて伸びる)・`SwitchInput`・チェックボックス・ラジオ・カード型チェック(それぞれ自分の size)

---

## Input コンポーネント一覧

| コンポーネント | 用途 |
|---|---|
| `Input` / `TextInput` | テキスト入力 |
| `NumberInput` | 数値入力 |
| `Textarea` | 複数行テキスト |
| `SelectInput` | 単一選択 |
| `ComboboxInput` | 単一選択（検索付き） |
| `AsyncComboboxInput` | 単一選択（非同期検索） |
| `MultiSelectInput` | 複数選択 |
| `AsyncMultiSelectInput` | 複数選択（非同期検索） |

`AsyncComboboxInput` / `AsyncMultiSelectInput` / `Overlays/AsyncPickerModal` の取得エンジン（browse ページング・Enter 検索・searchRank・無限スクロール・requestId 競合破棄・ラベル cache）は `Input/Manual/AsyncOptionSource/useAsyncOptionSource` に 1 本化されている。非同期候補を扱う新しいピッカーを作るときは、このフック + `AsyncOptionList` / `AsyncOptionInitialState` / `AsyncOptionListFooter` を消費し、取得ロジックを再実装しない。各コンポーネントが持つのは選択モデル（単一 / 複数 / session snapshot）とクロームだけ。アクションボタン起点で「マスタから N 件取り込む」用途はフォーム項目ではなく `Overlays/AsyncPickerModal` を使う。

**行の描き分け（renderOption）:** `AsyncComboboxInput` / `AsyncMultiSelectInput` / `AsyncPickerModal` は同じ形の `renderOption?: AsyncOptionRenderer<T>` = `(option, item) => ReactNode` を受け、候補の行（単一の上に留める選んだ行・複数の「選択済み」の行も）をその node で描く（状態のバッジ・版を並べる等）。`item` は取得の cache にある元の行（初期表示のラベルだけで未取得なら `undefined`）。トリガーの表示（単一のラベル・複数のチップ）は `label` のまま。`AsyncMultiSelectInput` の `selectedView="inline"` の印（選択中・`optionBadge`）は `label` に添える物なので、`renderOption` を渡すと行は呼び手の node で描かれる（印も呼び手が描く）。

**範囲のタブと「すべて」（AsyncComboboxInput だけ）:** `scopes={[{ value, label, count? }]}` で検索欄の下にタブを出し（`count` は「(n)」）、選んだ範囲は `searchFn(params, { scope })` の第 2 引数で渡る（1 引数の searchFn はそのまま使える）。範囲を替えると今のモード（先読み / 検索）の 1 ページ目を取り直す。既定は `defaultScope` か先頭、制御は `scope` + `onScopeChange`。`allOption={{ value: "__all__", label: "すべて" }}` は候補の一番上に常に出る行で、選ぶと `onChange(allOption.value)`、その値のときトリガーに `label` を出す（値は呼び手が決める。未選択 = `null`・クリアとは別）。
| `RadioGroupInput` | ラジオボタン（`displayType`: `standard` 既定 / `classic` 丸い印 / `bookmark` / `rounded` / `segmented` = 1 つの溝に横並び、選んだものだけ白い札が浮く切り替え。2 つ以上いくつでも、高さ 36px = Button sm と同じ） |
| `CheckGroupInput` | チェックボックスグループ |
| `BooleanCheckboxInput` | 単一チェックボックス |
| `BooleanRadioGroupInput` | はい/いいえ ラジオ |
| `SingleCardCheckbox` | カード型チェックボックス |
| `SwitchInput` | トグルスイッチ |
| `DateInput` | 日付 |
| `TimeInput` | 時刻 |
| `DatetimeInput` | 日時 |
| `EmailInput` | メールアドレス |
| `PasswordInput` | パスワード（`autoComplete` 必須: 登録済みを入れる欄 = `"current-password"`、新しく決める欄・管理者が他人に設定する欄 = `"new-password"`。未指定だと Safari 等が管理者自身の保存済みパスワードを自動入力する） |
| `OneTimeCodeInput` | ワンタイムコード（大文字化・ハイフン区切りの自動整形、`length` 文字そろうと `onComplete`。ペアリングコード・確認コード用） |
| `StepperInput` | 数値ステッパー |
| `FileInput` | ファイル選択 |

---

## 選択肢の無効化（Options.disabled）

「表示はするが選べない」選択肢（使用中・在庫切れ・権限なし・上限到達など）は、`Options` に `disabled: true` を付ける。

```tsx
const tableOptions: Options[] = tables.map((t) => ({
  value: t.id,
  label: t.occupied ? `${t.name} (使用中)` : t.name,
  disabled: t.occupied,
}));
```

- 対応: `SelectInput` / `ComboboxInput` / `MultiSelectInput` / `RadioGroupInput` / `CheckGroupInput`（全 displayType） / `AsyncOptionList` 系（`getOptionFromResult` で `disabled` を返す。既存の `disabledValues` とは OR）
- 既に選択済みの値は選択されたまま残り、その項目からは解除できない（値は勝手に書き換えない）
- 「(使用中)」等の文言は core が付けない → `label` に含める（`AsyncOptionList` のみ `disabledLabelSuffix` も使える）
- UX 用の表示制御のみ。Zod もサーバーも拒否しないので、選べてはいけない値は ServerService 側で必ず検証する
- FieldRenderer / 設定駆動フィールド: `FieldConfig.options` の各要素に `disabled` を付ければそのまま渡る（domain.json には定義しない。実行時の状態なので、画面側で options を組み立てて渡す）

---

## AutoSave（自動保存）

編集フォームで自動保存を有効にする方法については、[AutoSave/README.md](./AutoSave/README.md) を参照。

---

## ファイル選択のボタン（FilePickButton）

ボタンの形をしたファイル選択は `FilePickButton`(`@/components/Form`)。`label` の中に隠した file の `Input` を持ち、見た目は同じ `variant` / `size` の `Button` と同じ。生の `label` に `buttonVariants` を付けて組まない。

- `onFiles(files: File[])` で選んだファイルを受け、その後 input を空に戻す(同じファイルを続けて選んでも毎回呼ばれる)
- キーボード: Tab で止まり Enter / Space で開く。`disabled` では止まらず開かない
- ボタンを押した後に別の処理を挟んでから開く形は `Button` + `Input`(`type="file" hidden`、ref で `click()`)で組む

```tsx
<FilePickButton variant="outline" size="xs" accept="video/mp4" onFiles={([file]) => setVideo(file)}>
  映像を選択
</FilePickButton>
```

## Button の読み込み中（loading / loadingLabel）

`Button`（`@/components/Form/Button`）と `TabletButton` は、実行中の表示を `loading` で持つ。ボタンの中に Spinner を手で組まない。

- `loading`: true のとき押せなくし（`disabled`）、`aria-busy` を付け、子の前に Spinner（既定の形）を出す。`disabled` の式に実行中の値を足さなくてよい
- `loadingLabel`: 読み込み中に子の代わりに出す中身。未指定 = 子のまま（Spinner + 子）、文字 = Spinner + その文字、`null` = Spinner だけ
- 渡さなければ今の出力のまま（DOM・class とも変わらない）
- `asChild` では効かない: 子（Link など）に Spinner を足さず、`disabled` / `aria-busy` だけ付く
- `PseudoButton`（div で描く）は持たない

```tsx
<Button onClick={save} disabled={!canSave} loading={isSaving} loadingLabel="保存中...">
  保存
</Button>
<Button variant="outline" onClick={apply} loading={isApplying} loadingLabel={null}>
  適用
</Button>
```

---

## ディレクトリ構造

```
src/components/Form/
├── AppForm.tsx
├── AutoSave/                        # 自動保存機能（→ AutoSave/README.md）
├── Field/
│   ├── types.ts                    # 共通型定義（FieldConfig, FormInputType 等）
│   ├── Manual/                     # 低レベル（手動でエラーを渡す/自由レイアウト）
│   │   ├── ManualField.tsx
│   │   ├── ManualFieldGroup.tsx
│   │   └── ManualFieldController.tsx
│   ├── Controlled/                 # React Hook Form 統合
│   │   ├── ControlledField.tsx
│   │   ├── ControlledFieldGroup.tsx
│   │   └── ControlledMediaField.tsx
│   └── Configured/                 # 設定ベース（FieldConfig から自動生成）
│       ├── ConfiguredField.tsx
│       ├── ConfiguredFieldGroup.tsx
│       ├── ConfiguredFields.tsx
│       ├── ConfiguredMediaField.tsx
│       └── inputResolver.tsx
├── Input/
│   ├── Controlled/
│   └── Manual/
├── FieldRenderer/                   # 動的フォーム描画（→ FieldRenderer/README.md）
├── Button/
├── FilePickButton/                  # ボタンの形をしたファイル選択
├── MediaHandler/
└── Label.tsx
```
