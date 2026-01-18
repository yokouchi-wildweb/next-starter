# Form コンポーネント

## 概要

このプロジェクトでは、フォームの構築方法が **3種類** あり、それぞれに **Controlled（react-hook-form使用）** と **Manual（useState等）** の2パターンが存在する。

---

## フォーム構築の3つの方法

| 方法 | 自由度 | 手間 | 用途 |
|---|---|---|---|
| **Input を使う** | ◎ 高い | 多い | カスタムUI、特殊なレイアウト |
| **Field を使う** | ○ 中程度 | 中程度 | 一般的なフォーム、ラベル・エラー表示が必要 |
| **Renderer を使う** | △ 低い | 少ない | 管理画面のCRUDフォーム自動生成 |

---

## Controlled vs Manual

| 項目 | Controlled | Manual |
|---|---|---|
| 状態管理 | react-hook-form | useState / useReducer 等 |
| バリデーション | zod + react-hook-form | 自前実装 |
| コンテナ | `AppForm` | `<form>` |
| Input | `Form/Controlled/*` | `Form/Manual/*` |

### 依存関係

```
Controlled Input
    ↓ 内部で使用
Manual Input（実際のUI実装）
```

Controlled は Manual をラップして、`field` prop を `value/onChange` に変換している。

---

## 1. Input を使う（自由度高）

最も自由度が高い方法。レイアウトを完全にコントロールできる。

### Controlled の場合

`FieldWrapper` で field を取得し、Controlled Input に渡す。

```tsx
import { FieldWrapper } from "@/components/Form/Field";
import { SwitchInput } from "@/components/Form/Controlled";

<AppForm methods={form} onSubmit={handleSubmit}>
  <FieldWrapper control={control} name="notify">
    {(field) => (
      <div className="自由なレイアウト">
        <SwitchInput field={field} label="通知設定" />
        <span>補足テキスト</span>
      </div>
    )}
  </FieldWrapper>
</AppForm>
```

### Manual の場合

Input を直接使用する。ラッパー不要。

```tsx
import { SwitchInput } from "@/components/Form/Manual";

const [notify, setNotify] = useState(false);

<form onSubmit={handleSubmit}>
  <div className="自由なレイアウト">
    <SwitchInput value={notify} onChange={setNotify} label="通知設定" />
    <span>補足テキスト</span>
  </div>
</form>
```

---

## 2. Field を使う（簡単に組み立て）

ラベル・説明・エラーメッセージを自動的に付与する。一般的なフォームに最適。

### Controlled の場合

```tsx
import { FieldItem } from "@/components/Form/Field";
import { EmailInput } from "@/components/Form/Controlled";

<AppForm methods={form} onSubmit={handleSubmit}>
  <FieldItem
    control={control}
    name="email"
    label="メールアドレス"
    required
    description={{ text: "確認メールを送信します" }}
    renderInput={(field) => <EmailInput field={field} />}
  />
</AppForm>
```

### Manual の場合

```tsx
import { ManualFieldItem } from "@/components/Form/Field";
import { Input } from "@/components/Form/Manual";

const [email, setEmail] = useState("");
const [error, setError] = useState<string>();

<form onSubmit={handleSubmit}>
  <ManualFieldItem
    label="メールアドレス"
    error={error}
    required
  >
    <Input
      type="email"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
    />
  </ManualFieldItem>
</form>
```

---

## 3. Renderer を使う（全自動）

ドメインJSONからフォームを自動生成。管理画面のCRUD操作に最適。

```tsx
import { DomainFieldRenderer } from "@/components/Form/DomainFieldRenderer";

<AppForm methods={form} onSubmit={handleSubmit}>
  <DomainFieldRenderer
    control={control}
    methods={form}
    domainJsonFields={domainJson.fields}
    fieldGroups={[
      { key: "basic", label: "基本情報", fields: ["name", "email"] },
    ]}
    inlineGroups={[
      { key: "period", label: "期間", fields: ["startDate", "endDate"] },
    ]}
  />
</AppForm>
```

※ DomainFieldRenderer は Controlled のみ対応

---

## コンテナ

| react-hook-form | コンテナ |
|---|---|
| 使う | `AppForm` |
| 使わない | `<form>` |

### AppForm の機能

- `FormProvider`（react-hook-form の Context）
- `handleSubmit` のラップ
- Enter キー送信抑止（IME対応）
- `pending` 状態での fieldset 無効化
- `fieldSpace` でフィールド間隔の統一

---

## ディレクトリ構造

```
src/components/Form/
├── AppForm.tsx              # フォームコンテナ（react-hook-form用）
├── Controlled/              # Controlled Input の再エクスポート
├── Manual/                  # Manual Input の再エクスポート
├── Field/
│   ├── FieldItem.tsx        # Controlled用フィールド（ラベル・エラー付き）
│   ├── FieldItemGroup.tsx   # 複数フィールド横並び（Controlled）
│   ├── FieldWrapper.tsx     # field を渡すだけの薄いラッパー（※作成予定）
│   ├── ManualFieldItem.tsx  # Manual用フィールド
│   └── ManualFieldItemGroup.tsx
├── Input/
│   ├── Controlled/          # react-hook-form 用 Input
│   └── Manual/              # value/onChange パターンの Input
├── DomainFieldRenderer/     # ドメインJSONからフォーム自動生成
├── Button/                  # ボタン類
├── MediaHandler/            # メディアアップロード
└── Label.tsx
```

---

## Input コンポーネント一覧

| コンポーネント | 用途 |
|---|---|
| `Input` / `TextInput` | テキスト入力 |
| `NumberInput` | 数値入力 |
| `Textarea` | 複数行テキスト |
| `Select` / `SelectInput` | 単一選択 |
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

## まとめ表

| 方法 | Controlled | Manual |
|---|---|---|
| Input を使う | `FieldWrapper` + Controlled Input | Manual Input を直接 |
| Field を使う | `FieldItem` | `ManualFieldItem` |
| Renderer | `DomainFieldRenderer` | - |
| コンテナ | `AppForm` | `<form>` |
