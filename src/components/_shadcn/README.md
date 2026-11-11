# _shadcn

このディレクトリには shadcn/ui からインストールした**オリジナルのコンポーネント**がそのまま配置されています。

## ⚠️ 直接使用禁止

このディレクトリ内のコンポーネントを**直接インポートして使用しないでください**。

### 理由

- shadcn/ui のコンポーネントはプリミティブであり、プロジェクト固有のスタイルや振る舞いが適用されていない
- 一貫したデザインシステムを維持するため、ラッパーコンポーネントを経由する必要がある
- 下流の見た目差し替え(`src/config/ui/variants.config.ts` / `src/styles/` 直下の fork の CSS)はラッパー側に配線されている。直接 import するとその口が効かない
- 将来的な変更に対応しやすくするため

### 正しい使い方(ラッパー対応表)

| _shadcn | 使うべきラッパー |
|---|---|
| `table.tsx` | `@/lib/tableSuite`(`DataTable` / `EditableGridTable` / `RecordSelectionTable`) |
| `form.tsx` | `Form/Field/*`(`ControlledField` / `ConfiguredField` / `FieldRenderer`)。フォーム全体は `Form/AppForm`、Provider だけ要る場合は react-hook-form の `FormProvider`(_shadcn の `Form` はその別名) |
| `card.tsx` | ラッパー無し。`Layout/Block` 等の `appearance`(`surface` / `raised` / `outlined` ...)を使う |
| `accordion.tsx` / `scroll-area.tsx` | 未使用。必要になったら `Overlays/` または `Layout/` にラッパーを作る |

button・badge・input・textarea・select・checkbox・radio-group・label・tabs・skeleton・calendar・carousel・dialog・command・popover・tooltip は `src/components/Primitives/<部品>` へ移した(入口 `@/components/Primitives/<部品>`、画面からは今までどおり `Form/`・`Overlays/`・`Badge/`・`Navigation/`・`Skeleton/`・`Widgets/` の完成品を使う。一覧: `src/components/README.md`)。旧パスの import は lint `deprecated-imports` が置き換え先を出す。Radix は統合版の `radix-ui` から読む(`@radix-ui/*` の個別パッケージは lint `radix-unified` が止める)

### 機械的な強制(ESLint)

`src/components/**` と `src/lib/tableSuite/**`(table の指定ラッパー。セルエディタも primitive 層)以外からの `@/components/_shadcn/*` import は ESLint(`no-restricted-imports`、`eslint.config.mjs`)が error にする。下流固有の UI も対象。

### ラッパーが存在しない場合

必要なラッパーが見つからない場合は、新規作成を検討してください。適切なディレクトリ(`Form/`、`Layout/`、`Overlays/` など)にラッパーコンポーネントを作成し、_shadcn のコンポーネントをインポートして使用します。

### このディレクトリの色について

_shadcn 内には shadcn 由来の生パレット色(`text-white` 等)が残っていますが、見た目はラッパー側のクラスが tailwind-merge で上書きします。ESLint の `style-tokens/no-raw-palette` はこのディレクトリを対象外にしています(vendored。shadcn 更新時に差分を小さく保つため)。`Primitives/` へ移した物は対象に入る(残った生の色は理由付き eslint-disable で明示している)。
