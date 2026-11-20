# components ディレクトリ概要

## Overview

- `src/components/` にはアプリ全体で共有する汎用 UI コンポーネントをカテゴリごとに配置します
- カテゴリのフォルダに入口の `index` は置かない。部品はそれを定義するファイル(フォルダの部品はそのフォルダ)から `@/components/<カテゴリ>/<部品>` で読む(まだ入口があるのは `Form/`・`AppStatusGuard/`)
- 本ファイルは**カテゴリの索引**です。使う時の決まりはカテゴリの札 `.claude/rules/items/components/<カテゴリ>.md`、使い方・仕組みは各サブディレクトリの README（コロケーション）に置き、複雑な仕組みを持つカテゴリには必ず README を併設します

### カテゴリ一覧

- `Admin/`: 管理画面の画面部品（ListTop・SecTitle・SearchBox・SelectFilter・SortSelect・ItemNavigator。props だけ）。管理ヘッダーの中身はページが AdminPage の props で渡す | 詳細: [Admin/README.md](./Admin/README.md)
  - ItemNavigator = 前後の項目へ移るだけの選択欄で props だけ。データは `src/lib/crud` の `useDomainItemNavigation`、管理の編集画面は `src/app/admin/_layout/AdminEditItemNavigator` を `<AdminPage actions>` に置く
- `Animation/`: アニメーション演出（`CountUp`、`PageTransition` など）
- `AppFrames/`: 解体中の旧フォルダ。枠の部品は `src/app/(user)/_layout/`・`src/app/admin/**/_layout/` へ移動済み | 詳細: [AppFrames/User/README.md](./AppFrames/User/README.md)・[src/app/(user)/_layout/README.md](../app/(user)/_layout/README.md)
  - 部品は無い（キオスク用のビューポート固定枠 `KioskFrame` は `Layout/`、管理画面の部品は `Admin/`。枠の部位を隠すのはルートの `frame.ts` / `frame.override.ts`）
- `AppStatusGuard/`: メンテナンス・デプロイを検知してリダイレクト / リロードするガード。長時間滞在する画面に配置
- `Badge/`: バッジ（`SolidBadge`、`SoftBadge` など）
- `Functional/`: 動作をカプセル化した部品（`DarkModeSwitch`（サイトテーマの切替。同期の `SiteThemeSync` は `@/lib/siteTheme`、詳細: [styles/README.md](../styles/README.md)）、`FirebaseAnalytics` など）
- `Form/`: フォーム構築の全部品（Input / Field / `FieldRenderer` / `AppForm` / AutoSave） | 詳細: [Form/README.md](./Form/README.md)・[Form/FieldRenderer/README.md](./Form/FieldRenderer/README.md)・[Form/AutoSave/README.md](./Form/AutoSave/README.md)
- `Icons/`: プロジェクト固有アイコンを Lucide 互換 API で一元管理 | 詳細: [Icons/README.md](./Icons/README.md)
- `Layout/`: レイアウトラッパー（`Block` / `Flex` / `Grid` / `Stack` / `Main` / `Section` など）とキオスク用のビューポート固定枠 `KioskFrame`。raw HTML の代替。余白の段は閉じた lib `@/lib/spacing` | 詳細: [Layout/README.md](./Layout/README.md)
- `Media/`: 画像・メディア表示（`AppImage`: next/image ラッパー。raw `<img>` / next/image 直接使用の代替。`PreviewImage`: blob: など選んだ直後の画像の下見） | 詳細: [Media/AppImage/README.md](./Media/AppImage/README.md)・[Media/PreviewImage/README.md](./Media/PreviewImage/README.md)
- `Navigation/`: ナビゲーション | 詳細: [Navigation/Link/README.md](./Navigation/Link/README.md)
  - `Link`: next/link の包み。リンクは全部これを使い next/link を直接 import しない（lint `link-via-shelf`）。口 `LinkVisibilityProvider` は既定で何も隠さず、アプリでは `src/wiring/AppProviders.tsx` の門番の `GateProvider` が閉じた機能のパスを隠す判定を差し込む
  - `PageTab`
  - `StateTabs`: 状態で切り替えるタブ。`variant="underline"` = PageTab の UnderlineTabs と同じ下線の形、`listEnd` = タブの列と同じ行の右端に置く物
  - `Pagination`: 送り方は `makeHref` = リンク か `onPageChange` = ボタン のどちらか一方、`compact` = 前 / p / N / 次 だけ
- `Overlays/`: 画面に重ねて表示する UI（モーダル / ダイアログ / ポップオーバー / ツールチップなど）の完成品と、自作の重ねる物を body 直下へ出す `BodyPortal`。低レベル部品は `Primitives/`（`Dialog` / `Command` / `Popover` / `Tooltip` / `HoverCard`）。**自作前に必ず一覧を確認** | 詳細: [Overlays/README.md](./Overlays/README.md)
- `Primitives/`: 部品の棚の低レベル部品（Radix などの外部の振る舞いを結ぶ素の部品。置き場の勧め: core/components.md primitives_place）。画面からは通常、完成品（`Form/`・`Overlays/`・`Badge/` など）を使う
  - 1 部品 = 1 フォルダ、読むのは入口 `@/components/Primitives/<部品>`（`Primitives/index.ts` は無い）
  - 部品: `Badge`（`BadgeCore`）・`Button`・`Calendar`・`Carousel`・`Checkbox`・`Command`・`Dialog`・`HoverCard`・`Input`（`Input` / `Textarea`）・`Label`・`Popover`・`RadioGroup`・`Select`・`Skeleton`・`Slot`・`Tabs`・`Tooltip`
  - Radix は統合版の `radix-ui` からだけ読む（`@radix-ui/*` の個別パッケージは lint `radix-unified` が止める）
- `Skeleton/`: `BaseSkeleton` を基盤としたローディングプレースホルダー | 詳細: [Skeleton/README.md](./Skeleton/README.md)
- `TextBlocks/`: 文章構造コンポーネント（`PageTitle` / `SecTitle` / `Para` / `Span`）。見出し・段落の raw HTML の代替
- `Widgets/`: 完成品ウィジェット（`FadeSlider`、`ScrollSlider`、`InfiniteScrollList` など） | 詳細: [Widgets/FadeSlider/README.md](./Widgets/FadeSlider/README.md)・[Widgets/ScrollSlider/README.md](./Widgets/ScrollSlider/README.md)・[Widgets/InfiniteScrollList/README.md](./Widgets/InfiniteScrollList/README.md)

## Usage

### 配置判断

- 配置の決まりは CLAUDE.md の CODE_PLACEMENT・COMPONENTS と `.claude/rules/core/components.md`（slots・core parts）
- 複数ドメインで使う汎用 UI → ここ、特定ドメイン専用 UI → `src/features/<domain>/components/common/`、特定ページ専用 UI → `app/<route>/_screen/`（ルートを作った側）か `app/<route>/_components/`（fork）

### 包み

- 生の HTML の代わりの部品（包み）の対応表は `.claude/rules/core/components.md` の wrappers。そこに無い対応（`img` の選んだ直後の blob: の下見 → `Media/PreviewImage`、ボタンの形のファイル選択 → `Form/FilePickButton`、`span` → `TextBlocks/Span`）は `eslint-rules/raw-elements.mjs` の `WRAPPERS`

## Extension

- **カテゴリの追加・仕様の複雑化時**: サブディレクトリに README を追加し、本ファイルの索引にも1行追加する

## Internals

- **生の要素の lint**: `raw-elements/no-raw-element`(`eslint-rules/raw-elements.mjs`)が、包みのある要素(div・span・p・見出し・section 系・main・button・input・textarea・label・img・a)を生で書くと止める
  - 上流リポだけ error、fork は off(fork の既存の生の要素は直させない)。対象外 = `src/components/**`(包みそのもの)とテスト
  - 包みの無い要素(ul・li・dl・select・option・form・pre・code・br・strong・iframe 等)と飾り(svg・video・canvas・motion.*)は止めない
  - 包みで同じ形にできない 1 か所だけの物は理由つきの行ごとの `eslint-disable-next-line raw-elements/no-raw-element -- <理由>`(例: toast = components から読まれる土台)
