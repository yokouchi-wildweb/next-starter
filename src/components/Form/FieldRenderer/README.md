# FieldRenderer

フィールド定義（`FieldConfig`）の配列からフォームフィールドを動的に描画するレンダラー。react-hook-form と連携し、`AppForm` 配下で使用する。domain.json ベースの管理画面フォームの中核。

## 利用経路

- **生成コンポーネント経由（推奨）**: `dc:generate` が生成する `XxxFields` / `XxxForm` は本コンポーネントの props をそのままパススルーする。ドメインのフォームをカスタマイズする場合はこちらに props を渡す
- **直接利用**: `import { FieldRenderer } from "@/components/Form/FieldRenderer"`。domain.json に依らないフォーム（プロフィール等）で使用

## Props 一覧

| props | 型 | 役割 |
|---|---|---|
| `control` / `methods` | react-hook-form | フォーム連携（必須） |
| `baseFields` | `FieldConfig[]` | ベースのフィールド定義 |
| `fieldPatches` | `Partial<FieldConfig>[]` | フィールドの部分上書き・追加 |
| `insertBefore` / `insertAfter` | `InsertFieldsMap` | フィールド定義の挿入 |
| `fieldGroups` | `FieldGroup[]` | セクション分け（後述） |
| `inlineGroups` | `InlineFieldGroup[]` | 横並び表示（後述） |
| `beforeAll` / `afterAll` | `ReactNode` | 全フィールドの前後にUI差し込み |
| `beforeField` / `afterField` | `Partial<Record<フィールド名, ReactNode>>` | 特定フィールドの前後にUI差し込み |
| `beforeGroup` / `afterGroup` | `GroupContentMap`（キー: `FieldGroup.key`） | 特定グループの先頭・末尾にUI差し込み（後述） |
| `onMediaStateChange` | `(state: MediaState \| null) => void` | メディアアップロード状態の通知（`AppForm` 配下では省略可） |

カスタマイズ手段は大きく2系統ある。**スキーマに影響するのはフィールド定義系のみ**。

- **フィールド定義系**（`FieldConfig` を増減・変更する）: `fieldPatches`, `insertBefore`, `insertAfter`
- **UI差し込み系**（任意の `ReactNode` を描画に挟む。スキーマ・値には影響しない）: `beforeAll` / `afterAll`, `beforeField` / `afterField`, `beforeGroup` / `afterGroup`

## フィールド定義のカスタマイズ

### fieldPatches

- 同名フィールド: 位置を維持したままベース定義にマージ（上書き）
- 新規フィールド: 末尾に追加（完全な `FieldConfig` 定義が必要）

### insertBefore / insertAfter

`InsertFieldsMap`（キー: 挿入先フィールド名 または `"__first__"` / `"__last__"`）でフィールド定義を挿入する。挿入されたフィールドに対しても `insertBefore` / `insertAfter` が再帰的に適用される。

処理順序: `insertBefore.__first__` → `baseFields`（パッチ適用 + 前後挿入）→ `fieldPatches` の新規分 → `insertAfter.__last__`

## fieldGroups（セクション分け）

`FieldGroup[]` を渡すと、フィールドが `<fieldset>` ベースのセクション（`FieldGroupSection`）に分かれて描画される。domain.json のトップレベル `fieldGroups` でも宣言でき、生成された `XxxFields` が自動で読み込む（スキーマ定義: `src/features/README.md`「FieldGroup（フィールドグループ）」）。

| プロパティ | 型 | 説明 |
|---|---|---|
| `key` | string | グループキー（一意識別子。`beforeGroup` / `afterGroup` のキーにもなる） |
| `label` | string | セクションの表示ラベル（legend） |
| `fields` | string[] | グループに含むフィールド名 |
| `collapsible` | boolean | 折りたたみ可能か（既定: false） |
| `defaultCollapsed` | boolean | 初期状態で折りたたむか（既定: false） |
| `bgColor` | string | 背景色（CSSカラーコード） |

- どのグループにも属さないフィールドは、全グループの後ろに「グループ外枠」としてまとめて描画される
- グループの `fields` に解決できるフィールドが1つも無い場合、そのセクションは描画されない（ただしスロット指定がある場合は描画される。後述）

## beforeGroup / afterGroup（グループ単位のUI差し込み）

`FieldGroup.key` をキーに、セクション内の先頭（legend 直下・フィールド一覧の上）/ 末尾（フィールド一覧の下）へ任意の `ReactNode` を差し込む。セクションの背景・枠線の内側に描画されるため、通知がそのグループに属していることが視覚的に伝わる。

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

挙動の要点:

- `fieldGroups` 指定時のみ有効。フラット表示では無視される
- 折りたたみ時はフィールドと同様に非表示になる
- グループ外枠には予約キー `UNGROUPED_GROUP_KEY`（`"__ungrouped__"`）で差し込める
- グループの全フィールドが解決不能（パッチアウト等）でも、スロット指定があればセクションは描画される（「このセクションは無効です」等の通知が出せる）

典型用途: 親/グローバル設定によるオーバーライド警告、セクション単位の非推奨案内、セクション用の補足説明ブロック。

**使い分け**: セクションに紐づく通知は `beforeGroup` / `afterGroup` を使う。`beforeField` を「グループ先頭のフィールド」に付ける方法は、フィールドの並び替え・パッチアウトで壊れるため使わない。

## inlineGroups（横並び表示）

`InlineFieldGroup[]` で複数フィールドを1つのフィールドのように横並び表示する。`key` / `label` / `fields` / `fieldWidths`（Tailwind 幅クラス。省略時は均等）/ `required` / `description` を指定。

## custom フィールドのUI実装

`formInput: "custom"` のフィールドは自動描画されない（スキーマには含まれる）。`beforeField` / `afterField` で独自コンポーネントを注入する（例: `src/features/README.md`「custom の使い方」）。

## メディアアップロード

`mediaUploader` / `mediaUploaderMulti` フィールドのアップロード状態は集約され、`onMediaStateChange` で通知される。`AppForm` 配下では context 経由で自動連携するため通常は指定不要。
