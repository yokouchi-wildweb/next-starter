# components ディレクトリ概要

`src/components/` にはアプリ全体で共有する汎用 UI コンポーネントをカテゴリごとに配置します。

本ファイルは**カテゴリの索引**です。詳細な仕様・使い分けは各サブディレクトリの README（コロケーション）に置き、複雑な仕組みを持つカテゴリには必ず README を併設します。

## 配置判断

- 複数ドメインで使う汎用 UI → ここ（`src/components/`）
- 特定ドメイン専用 UI → `src/features/<domain>/components/common/`
- 特定ページ専用 UI → `app/<route>/_components/`

## カテゴリ一覧

| ディレクトリ | 役割 | 詳細ドキュメント |
|---|---|---|
| `Animation/` | アニメーション演出（`CountUp`、`PageTransition` など） | - |
| `AppFrames/` | 管理者用・ユーザー用アプリのレイアウトフレーム（ヘッダー / フッター / メニュー、ページ単位の表示制御） | [AppFrames/User/README.md](./AppFrames/User/README.md) |
| `AppStatusGuard/` | メンテナンス・デプロイを検知してリダイレクト / リロードするガード。長時間滞在する画面に配置 | - |
| `Badge/` | バッジ（`SolidBadge`、`SoftBadge` など） | - |
| `BulkSendEmail/` | 選択ユーザーへの一括メール送信モーダル | - |
| `Fanctional/` | 動作をカプセル化した部品（`DarkModeSwitch`、`BodyPortal` / `HeadPortal`、`FirebaseAnalytics` など） | - |
| `Form/` | フォーム構築の全部品（Input / Field / `FieldRenderer` / `AppForm` / AutoSave） | [Form/README.md](./Form/README.md)・[Form/FieldRenderer/README.md](./Form/FieldRenderer/README.md)・[Form/AutoSave/README.md](./Form/AutoSave/README.md) |
| `Icons/` | プロジェクト固有アイコンを Lucide 互換 API で一元管理 | [Icons/README.md](./Icons/README.md) |
| `Layout/` | レイアウトラッパー（`Block` / `Flex` / `Grid` / `Stack` / `Main` / `Section` など）。raw HTML の代替 | [Layout/README.md](./Layout/README.md) |
| `Media/` | 画像・メディア表示（`AppImage`: next/image ラッパー。raw `<img>` / next/image 直接使用の代替） | [Media/AppImage/README.md](./Media/AppImage/README.md) |
| `Navigation/` | ナビゲーション（`PageTab`、`StateTabs`、`Pagination`） | - |
| `Overlays/` | 画面に重ねて表示する UI（モーダル / ダイアログ / ポップオーバー / ツールチップなど）。**自作前に必ず一覧を確認** | [Overlays/README.md](./Overlays/README.md) |
| `Providers/` | 外部サービスの Provider（`RecaptchaProvider` など） | - |
| `Skeleton/` | `BaseSkeleton` を基盤としたローディングプレースホルダー | [Skeleton/README.md](./Skeleton/README.md) |
| `TextBlocks/` | 文章構造コンポーネント（`PageTitle` / `SecTitle` / `Para` / `Span`）。見出し・段落の raw HTML の代替 | - |
| `Three/` | three.js を利用した 3D 表現 | - |
| `Widgets/` | 完成品ウィジェット（`FadeSlider`、`ScrollSlider` など） | [Widgets/FadeSlider/README.md](./Widgets/FadeSlider/README.md)・[Widgets/ScrollSlider/README.md](./Widgets/ScrollSlider/README.md) |
| `_shadcn/` | shadcn/ui からインストールした原本。**直接インポート禁止**（ラッパー経由で使用） | [_shadcn/README.md](./_shadcn/README.md) |

## 共通ルール

- **raw HTML よりラッパー優先**: `div` → `Layout/Block・Flex・Grid・Stack`、`main` → `Layout/Main`、`section` → `Layout/Section`、`button` → `Form/Button`、`p` → `TextBlocks/Para`、`h2` → `TextBlocks/SecTitle`、`img` → `Media/AppImage`（`next/image` 直接使用も不可）など（一覧: CLAUDE.md「COMPONENTS」）
- **`_shadcn` 直接使用禁止**: 必ず対応するラッパー（`Form/Button`、`Form/Input`、`Skeleton/BaseSkeleton` など）を使用する。ラッパーが無い場合は新規ラッパーの作成を提案する
- **shadcn/ui の更新**: `_shadcn/` 内のファイルを更新し、差分はラッパー側で吸収する
- **カテゴリの追加・仕様の複雑化時**: サブディレクトリに README を追加し、本ファイルの索引にも1行追加する
