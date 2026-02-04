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

---

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
      <Stack space={2}>
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
  <Stack space={2}>
    <SwitchInput value={notify} onChange={setNotify} label="通知設定" />
    <Para tone="muted" size="xs">補足テキスト</Para>
  </Stack>
</form>
```

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

| 目的 | コンポーネント | 入力 | 使いどころ | 注意点 |
|---|---|---|---|---|
| 単一フィールド | `ConfiguredField` | `fieldConfig` | 1項目だけ差し込みたいとき | `mediaUploader` は非対応 |
| 横並びグループ | `ConfiguredFieldGroup` | `fieldConfigs[]` | 生年月日/住所など | ラベルは先頭の `label` を利用可 |
| 縦並び一括 | `ConfiguredFields` | `fieldConfigs[]` / `names[]` | まとめて描画したいとき | `Stack` で縦間隔制御 |

---

## メディアフィールドの使い分け

| 目的 | コンポーネント | 入力 | 使いどころ | 注意点 |
|---|---|---|---|---|
| 単独配置 | `ControlledMediaField` | `uploadPath` など | 単体フォームに手動で配置 | RHF の `methods` が必要 |
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
    uploadPath="images/main"
  />
  <ControlledMediaField
    control={control}
    methods={methods}
    name="subImage"
    label="サブ画像"
    uploadPath="images/sub"
  />
  <Button type="submit">送信</Button>
</AppForm>
```

### 注意事項

- `AppForm` 外でメディアフィールドを使う場合は、手動で `commit()` を呼ぶ必要がある
- キャンセルボタンで `resetAll()` を呼ぶ必要はない（ページ離脱時に自動クリーンアップ）
- `disableAutoCommitMedia` prop で自動コミットを無効化可能

---

## 3. Renderer を使う（管理画面向け）

domain.json からフォームを自動生成する。**Controlled のみ対応**。

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

`AppForm` は `fieldSpace` で縦方向の間隔を統一できる。`fieldSpace` は `StackSpace` 型（Tailwind spacing scale: 0, 0.5, 1, 1.5, 2, ... 96）を受け取り、デフォルトは `6`。

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
| `RadioGroupInput` | ラジオボタン |
| `CheckGroupInput` | チェックボックスグループ |
| `BooleanCheckboxInput` | 単一チェックボックス |
| `BooleanRadioGroupInput` | はい/いいえ ラジオ |
| `SingleCardCheckbox` | カード型チェックボックス |
| `SwitchInput` | トグルスイッチ |
| `DateInput` | 日付 |
| `TimeInput` | 時刻 |
| `DatetimeInput` | 日時 |
| `EmailInput` | メールアドレス |
| `PasswordInput` | パスワード |
| `StepperInput` | 数値ステッパー |
| `FileInput` | ファイル選択 |

---

## AutoSave（自動保存）

編集フォームで自動保存を有効にする方法については、[AutoSave/README.md](./AutoSave/README.md) を参照。

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
├── FieldRenderer/
├── Button/
├── MediaHandler/
└── Label.tsx
```
