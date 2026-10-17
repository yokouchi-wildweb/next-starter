# _shadcn

このディレクトリには shadcn/ui からインストールした**オリジナルのコンポーネント**がそのまま配置されています。

## ⚠️ 直接使用禁止

このディレクトリ内のコンポーネントを**直接インポートして使用しないでください**。

### 理由

- shadcn/ui のコンポーネントはプリミティブであり、プロジェクト固有のスタイルや振る舞いが適用されていない
- 一貫したデザインシステムを維持するため、ラッパーコンポーネントを経由する必要がある
- 下流の見た目差し替え(`src/config/ui/variants.config.ts` / `src/styles/custom/`)はラッパー側に配線されている。直接 import するとその口が効かない
- 将来的な変更に対応しやすくするため

### 正しい使い方(ラッパー対応表)

| _shadcn | 使うべきラッパー |
|---|---|
| `button.tsx` | `Form/Button`(`Button` / `LinkButton` / `PseudoButton` / `TabletButton` / `RoundedButton` / `BookmarkTag`) |
| `badge.tsx` | `Badge/`(`SolidBadge` / `SoftBadge` / `BookmarkTagBadge`)。_shadcn/badge は未使用 |
| `input.tsx` | `Form/Input/Manual/*`(`Input` / `NumberInput` / `PasswordInput` / `FileInput` / `ColorInput` 等)または `Form/Input/Controlled/*` |
| `textarea.tsx` | `Form/Input/Manual/Textarea` / `Controlled/Textarea` |
| `select.tsx` | `Form/Input/Manual/Select`(`SelectInput`、ツールバー用は `size="sm"`)/ `Controlled/SelectInput` |
| `checkbox.tsx` | `Form/Input/Manual/BooleanCheckboxInput`(単独のチェックボックスもこれ。`value` / `onChange(boolean)`)/ `SingleCardCheckbox` / `CheckGroupInput`、一覧の選択は `Overlays/Popover/ChecklistPopover` |
| `radio-group.tsx` | `Form/Input/Manual/RadioGroupInput` / `BooleanRadioGroupInput`、ポップオーバー内は `Overlays/Popover/SelectPopover` |
| `command.tsx` | 検索付き選択は `Form/Input/Manual/ComboboxInput` / `AsyncComboboxInput` / `MultiSelectInput` / `AsyncMultiSelectInput`、大量マスタからの選択は `Overlays/AsyncPickerModal`。コマンドパレットなど自前で組む場合は `Overlays/CommandPrimitives` |
| `dialog.tsx` | `Overlays/`(`Dialog` / `Modal` / `TabbedModal` / `DetailModal` / `AsyncPickerModal`、低レベルは `DialogPrimitives`) |
| `popover.tsx` | `Overlays/Popover`(radix 直接。_shadcn/popover は未使用) |
| `tooltip.tsx` | `Overlays/Tooltip`(`Tooltip` / `HelpTip`。_shadcn/tooltip は未使用)、ホバーカードは `Overlays/HoverCard` |
| `tabs.tsx` | `Navigation/PageTab`(`SolidTabs` / `UnderlineTabs`)/ `Navigation/StateTabs` / `Overlays/TabbedModal` |
| `table.tsx` | `@/lib/tableSuite`(`DataTable` / `EditableGridTable` / `RecordSelectionTable`) |
| `skeleton.tsx` | `Skeleton/BaseSkeleton`(`FormSkeleton` / `DetailModalSkeleton` 等) |
| `label.tsx` | `Form/Label` |
| `form.tsx` | `Form/Field/*`(`ControlledField` / `ConfiguredField` / `FieldRenderer`)。フォーム全体は `Form/AppForm`、Provider だけ要る場合は react-hook-form の `FormProvider`(_shadcn の `Form` はその別名) |
| `calendar.tsx` | `Overlays/Calendar` |
| `carousel.tsx` | `Widgets/ScrollSlider` |
| `card.tsx` | ラッパー無し。`Layout/Block` 等の `appearance`(`surface` / `raised` / `outlined` ...)を使う |
| `accordion.tsx` / `scroll-area.tsx` | 未使用。必要になったら `Overlays/` または `Layout/` にラッパーを作る |

### 機械的な強制(ESLint)

`src/components/**` と `src/lib/tableSuite/**`(table の指定ラッパー。セルエディタも primitive 層)以外からの `@/components/_shadcn/*` import は ESLint(`no-restricted-imports`、`eslint.config.mjs`)が error にする。下流固有の UI も対象。

### ラッパーが存在しない場合

必要なラッパーが見つからない場合は、新規作成を検討してください。適切なディレクトリ(`Form/`、`Layout/`、`Overlays/` など)にラッパーコンポーネントを作成し、_shadcn のコンポーネントをインポートして使用します。

### このディレクトリの色について

_shadcn 内には shadcn 由来の生パレット色(`text-white` / `bg-black/50` 等)が残っていますが、見た目はラッパー側のクラスが tailwind-merge で上書きします。ESLint の `style-tokens/no-raw-palette` はこのディレクトリを対象外にしています(vendored。shadcn 更新時に差分を小さく保つため)。
