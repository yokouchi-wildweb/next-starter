# AutoSave（自動保存）

## Overview

フォームの入力内容を欄の操作ごとに自動保存する(`@/lib/formSuite`)。編集フォームで「保存」ボタンを押さずに変更を反映する。

- 明示的な送信ボタンと併用できる(送信ボタンで最終確定も可)

## Usage

### 従来型フォームを自動保存にする

前提: フォームのテンプレート(`SampleForm.tsx` など)に `autoSave` props があり、`AppForm` に `autoSave` が渡っていること。変える所は 3 つ(import・hook の呼び出し・props)。

```diff
+ import { useAutoSaveConfig } from "@/lib/formSuite";

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

- `onCancel` を渡さなければキャンセルボタンは出ない

## API

```typescript
useAutoSaveConfig(trigger, itemId, options?)
```

- `options.debounceMs`(`number`、既定 `1000`): デバウンスの時間(ms)

```typescript
const autoSave = useAutoSaveConfig(trigger, sample.id);
const autoSave = useAutoSaveConfig(trigger, sample.id, { debounceMs: 2000 });
```

### 入力の種類ごとの保存のとき

| カテゴリ | タイプ | 動作 |
|---------|--------|------|
| **immediate** | textInput, numberInput, textarea, select, radio, multiSelect, switchInput, dateInput, timeInput, datetimeInput, emailInput, passwordInput | blur時に即座に保存 |
| **debounce** | checkbox, stepperInput | blur時にデバウンス（既定 1秒）して保存 |
| **none** | hidden, none, mediaUploader | blur経由の保存なし（独自処理） |

### 有効なときの画面の変化

| 項目 | 動作 |
|------|------|
| キャンセルボタン | `onCancel` を渡さなければ非表示 |
| 保存中カーソル | `cursor: progress`（矢印+処理中インジケーター） |
| フォーム無効化 | 保存中も編集可能（無効化されない） |
| トースト | 「保存中…」→「保存しました」を表示 |

## Internals

- メディアアップローダーは blur でなく自前の保存を持つ: アップロード完了時・画像削除時に、すぐコミット → 保存。保留 → コミット / ロールバックの仕組みは自動保存では使わない
- バリデーションエラーのときは保存しない
- 同じ `trigger` を使うので、`isMutating` は自動保存の間も `true`
- `ConfiguredFieldGroup`(`inlineGroups` の横並び)の中の入力は blur で自動保存しない(組み込みの入力も登録の部品も)。送信ボタンか、横並びの外の欄の保存で一緒に送られる
- `onSave` が受けるのは Zod を通す前のフォームの値(`getValues`。数値の欄が文字列のままのことがある)。`useAutoSave` はその欄の検証だけを通し、変換した値は使わない。生成のドメインの `update` はサーバー側の `parseUpdate` が変換と検証をする

## Related

- フォームの部品一式: `../README.md`
- 欄ごとの自動保存の指定(登録の部品の `blurMode`): `../FieldRenderer/README.md` Usage「登録された入力部品」
