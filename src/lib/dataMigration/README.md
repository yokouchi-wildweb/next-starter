# データマイグレーションライブラリ

管理画面向けに、CSV + ZIP を使ったデータのエクスポート/インポートを提供します。
レコード数が多い場合でもタイムアウトしないよう、チャンク単位の処理が前提です。

## できること
- 単一ドメインのエクスポート/インポート（manifest v1.0）
- リレーションを含む複数ドメインのエクスポート/インポート（manifest v1.1）
- 画像ファイルの同梱/再アップロード
- チャンク単位の進捗表示と部分成功

## ファイル構成（主要）
- export: `src/lib/dataMigration/export/`
- import: `src/lib/dataMigration/import/`
- UI: `src/lib/dataMigration/components/`
- 設定: `src/lib/dataMigration/config.ts`
- リレーション収集: `src/lib/dataMigration/relations.ts`

## エクスポートの流れ
1. `/api/data-migration/export` にリクエスト
2. サーバーで CSV を生成し ZIP に格納
3. `manifest.json` を同梱して返却

### 出力形式（概要）
- `chunk_XXX/data.csv` をチャンク単位で作成（`CHUNK_SIZE = 100` 固定）
- `assets/{fieldName}/` に画像を格納（`includeImages = true` の場合）

### オプション
- `includeImages`: 画像を含める
  - false の場合も ZIP で出力（CSV のみ）
- `includeRelations`: リレーションを含める
  - hasMany は UI で選択されたもののみ

### 検索条件
- `searchQuery` のみ使用（他のクエリは無視）

## インポートの流れ
1. クライアントで ZIP を展開（JSZip）
2. チャンクごとに `/api/data-migration/import-chunk` へ送信
3. チャンク単位で結果を集計

## manifest について
- v1.0: 単一ドメイン
- v1.1: 複数ドメイン（`related -> main -> hasMany -> junction` の順で import）

## 仕様上の注意点
- `null` と `""` は import 時に区別されず、空文字は `null` 扱い
- 型変換は **メインドメインのみ** `fieldType` を参考に実施
  - 関連ドメイン/中間テーブルは文字列のまま
- `maxRecordLimit` は export のみで制限
  - チャンク import では総件数の制限を行わない
- `updateImages = false` はアップロードをスキップし、CSV の値をそのまま保存
- システムフィールド（`createdAt` など）はそのまま渡すだけで、永続化はスキーマ次第

## 主要エンドポイント
- `POST /api/data-migration/export`
- `POST /api/data-migration/import-chunk`
