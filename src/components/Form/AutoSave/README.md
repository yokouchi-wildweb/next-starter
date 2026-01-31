# AutoSave（自動保存）

## 概要

フォームの入力内容をフィールド操作ごとに自動保存する機能。
編集フォームで明示的な「保存」ボタンを押さずに変更を即座に反映できる。

---

## 従来型フォーム → オートセーブへの移行

**3箇所の変更だけ**で従来型フォームをオートセーブに移行できる。

### 前提条件

- `SampleForm.tsx`（テンプレート）に `autoSave` props が定義されていること
- `AppForm` に `autoSave` が渡されていること

### 変更手順（EditSampleForm.tsx の例）

```diff
+ import { useAutoSaveConfig } from "@/components/Form/AutoSave";

  const { trigger, isMutating } = useUpdateSample();
+ const autoSave = useAutoSaveConfig(trigger, sample.id);

  <SampleForm
    methods={methods}
    onSubmitAction={submit}
    isMutating={isMutating}
    submitLabel="更新"
-   onCancel={() => router.push(redirectPath)}
+   autoSave={autoSave}
  />
```

### 変更のポイント

1. **import追加** - `useAutoSaveConfig` をインポート
2. **hook呼び出し** - `useAutoSaveConfig(trigger, itemId)` で設定を作成
3. **props変更** - `onCancel` を削除し、`autoSave` を渡す

`onCancel` を渡さないことで、キャンセルボタンも自動的に非表示になる。

---

## インプットタイプごとの保存タイミング

| カテゴリ | タイプ | 動作 |
|---------|--------|------|
| **immediate** | textInput, numberInput, textarea, select, radio, multiSelect, switchInput, dateInput, timeInput, datetimeInput, emailInput, passwordInput | blur時に即座に保存 |
| **debounce** | checkbox, stepperInput | blur時にデバウンス（1秒）して保存 |
| **none** | hidden, none, mediaUploader | blur経由の保存なし（独自処理） |

### メディアアップローダーの挙動

メディアアップローダーはblur経由ではなく、**独自のオートセーブ処理**を持つ:

- **アップロード完了時**: 即座にコミット → 保存
- **画像削除時**: 即座にコミット → 保存

従来のペンディング→コミット/ロールバックの仕組みは、オートセーブ時は使用されない。

---

## 設定オプション

```typescript
useAutoSaveConfig(trigger, itemId, options?)
```

| オプション | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `debounceMs` | `number` | `1000` | デバウンス時間（ms） |

### 使用例

```typescript
// デフォルト（1秒デバウンス）
const autoSave = useAutoSaveConfig(trigger, sample.id);

// カスタムデバウンス（2秒）
const autoSave = useAutoSaveConfig(trigger, sample.id, { debounceMs: 2000 });
```

---

## UI の変化

オートセーブ有効時、以下のUI変化が自動的に適用される:

| 項目 | 動作 |
|------|------|
| キャンセルボタン | `onCancel` を渡さなければ非表示 |
| 保存中カーソル | `cursor: progress`（矢印+処理中インジケーター） |
| フォーム無効化 | 保存中も編集可能（無効化されない） |
| トースト | 「保存中…」→「保存しました」を表示 |

---

## 注意事項

- オートセーブと明示的な送信ボタンは併用可能（送信ボタンで最終確定も可）
- バリデーションエラー時は保存されない
- 同じ `trigger` を使うため、`isMutating` はオートセーブ中も `true` になる
