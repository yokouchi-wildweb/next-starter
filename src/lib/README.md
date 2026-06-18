# src/lib ライブラリ目次

`src/lib/` に存在する共通ライブラリの一覧（目次）。
「必要なものが既にあるか」を一瞬で判断するための索引です。
**各ライブラリの詳細な仕様・使い方は、サブフォルダ内の `README.md` を参照**（README 欄 ✓ のもの）。

> 新しいユーティリティ/基盤を作る前に、まずこの表で同等品が無いか確認すること（重複実装の防止）。

## API / サーバー基盤

| ライブラリ | 用途 | README |
|---|---|---|
| `routeFactory` | 全 API ルートの生成ファクトリ。認可を構造的に強制（直書きハンドラは禁止） | ✓ |
| `crud` | `createCrudService` 汎用 CRUD。サービス/フック/管理UIを生成 | ✓ |
| `domain` | `domain.json` 設定の読取・フィールド/リレーション抽出（`getDomainConfig` 等） | |
| `cron` | `/api/cron/*` 定期タスク基盤。CLI からも同タスクを実行 | ✓ |
| `audit` | 監査ログ基盤（ALS コンテキスト・diff・denylist） | |
| `userDirty` | コミット後の再計算回収口。ALS で対象 user_id を収集し post-commit で flush | |
| `errors` | `DomainError` / `HttpError` 定義 | |
| `request` | リクエスト情報取得（`getClientIp`） | |
| `url` | 実行環境オリジン取得（`getAppBaseUrl`） | |

## DB / データ

| ライブラリ | 用途 | README |
|---|---|---|
| `drizzle` | PostgreSQL（Neon）クライアント + トランザクションヘルパ | |
| `firestore` | Firestore のクライアント操作レイヤー | ✓ |
| `dataMigration` | CSV+ZIP のエクスポート/インポート（管理画面・チャンク処理） | ✓ |
| `csv` | CSV ダウンロード / ヘッダ付きパース | |
| `zod` | Zod スキーマからのデフォルト値抽出（`getZodDefaults`） | |

## 認証 / セキュリティ

| ライブラリ | 用途 | README |
|---|---|---|
| `jwt` | JWT の署名 / 検証 / Cookie 抽出の薄いラッパ | ✓ |
| `crypto` | AES-256-GCM 対称暗号化（トークン・機密データの暗号化保存） | ✓ |
| `recaptcha` | Google reCAPTCHA v3/v2 ハイブリッドのボット対策 | ✓ |
| `spamGuard` | 使い捨てメール / Hide My Email 等の検出・ガード | |

## 外部サービス連携

| ライブラリ | 用途 | README |
|---|---|---|
| `firebase` | Firebase SDK のクライアント/サーバー初期化・ユーティリティ | ✓ |
| `storage` | Firebase Storage の共通サービスレイヤー（client/server/hooks） | ✓ |
| `mail` | メール送信（Resend / SendGrid）+ React Email テンプレート | |
| `line` | LINE 連携（Push通知・Bot応答・LIFF・Webhook 検証） | ✓ |
| `x` | X(Twitter) API（認証・投稿・メディア・Webhook 検証） | ✓ |
| `aiVision` | Claude Vision による画像の事前判定ユーティリティ | ✓ |
| `clarity` | Microsoft Clarity 解析タグ | |

## UI / コンポーネント

| ライブラリ | 用途 | README |
|---|---|---|
| `tableSuite` | テーブル系 UI（DataTable / EditableGridTable / RecordSelectionTable） | ✓ |
| `mediaInputSuite` | メディア入力（メタデータ取得→プレビュー→Storage アップロード） | ✓ |
| `structuredDocument` | 構造化ドキュメント（文書タイプ別の構造定義 + レンダラー） | ✓ |
| `transitionGuard` | ページ遷移ガード（フロー離脱時に最初からやり直させる） | ✓ |
| `sortableList` | ドラッグ&ドロップの並べ替えリスト UI | |
| `toast` | トースト通知システム（`GlobalToast` / `useToast`） | |
| `seamlessVideo` | 変換済み fmp4 を MSE で継ぎ目なく連結再生（映像+音声・progressive・A/V同期・BGM・共有URL） | ✓ |

## ユーティリティ

| ライブラリ | 用途 | README |
|---|---|---|
| `cn` | Tailwind className 結合（clsx + tailwind-merge） | |
| `date` | dayjs ラッパ + 柔軟な日付パース | |
| `metadata` | Next.js `generateMetadata` 生成ヘルパ（`createMetadata`） | |
| `browserStorage` | localStorage / sessionStorage の React フック | |
