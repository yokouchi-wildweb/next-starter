# ドキュメント案内

このファイルは、`docs/` 配下のドキュメントを素早く把握し、必要な情報へ到達するための索引です。目的や状況に応じて、以下のカテゴリから参照してください。

## ✅ 最優先で確認するドキュメント（`docs/!must-read/`）
| ドキュメント | 概要 |
| --- | --- |
| [アプリ構築における構成層.md](./!must-read/アプリ構築における構成層.md) | Next.js App Router を前提とした層構造とデータフローの責務を定義。SSR・API・サービス層の切り分けを行う際の基準になります。 |
| [コンポーネントの設計と切り分け方.md](./!must-read/コンポーネントの設計と切り分け方.md) | UI レイヤーの分類、セクションコンテナの作り方、フックの呼び出し位置などフロントエンド実装の必須ルールを整理。 |
| [エラーハンドリング方針.md](./!must-read/エラーハンドリング方針.md) | `HttpError` / `DomainError` を軸とした例外管理フローと、各層のエラー責務を解説。 |
| [ドメイン内のエンティティ管理方針.md](./!must-read/ドメイン内のエンティティ管理方針.md) | `entities/` 配下での Zod スキーマ・型管理方法とフォーム側の分離方針をまとめています。 |
| [Tailwindと汎用部品を利用した共通スタイル設計.md](./!must-read/Tailwindと汎用部品を利用した共通スタイル設計.md) | プロジェクト固有のスタイル指針と汎用コンポーネントの使い分けを記載。UI 実装前に必ず確認してください。 |

## 🧠 コンセプトと設計思想（`docs/concepts/`）
- [ディレクトリ構造の全体図と構成ファイルの説明.md](./concepts/ディレクトリ構造の全体図と構成ファイルの説明.md)：リポジトリの大枠と各層の位置付けを俯瞰できます。
- [プロジェクトファイルの命名規則.md](./concepts/プロジェクトファイルの命名規則.md)：命名ルールやディレクトリ命名の共通語彙を確認。
- [汎用CRUD設計ガイドライン.md](./concepts/汎用CRUD設計ガイドライン.md)：CRUD 共通部品を導入する際の考え方と流れ。
- [ユーザー登録と認証の方針.md](./concepts/ユーザー登録と認証の方針.md)、[ユーザーセッションの管理方針と実装.md](./concepts/ユーザーセッションの管理方針と実装.md)：認証・セッション戦略を整理。
- [chat機能の構成方針.md](./concepts/chat機能の構成方針.md)：チャット関連機能を実装する際の全体設計。

## 📘 コア仕様（`docs/core-specs/`）
- [DB種別の違いによる機能の差異.md](./core-specs/DB種別の違いによる機能の差異.md)：Neon / Firestore などストレージの選定指針。
- [汎用サービスの詳細仕様と各メソッドの要求型について.md](./core-specs/汎用サービスの詳細仕様と各メソッドの要求型について.md)：プロジェクト共通サービス層の仕様を定義。

## 🔧 How-To ガイド（`docs/how-to/`）
- **初期セットアップ**（`initial-setup/`）
  - [クイックスタート_環境構築からデプロイまでの方法.md](./how-to/initial-setup/クイックスタート_環境構築からデプロイまでの方法.md)：開発環境の構築からデプロイまでの一連の手順。
  - [Neon_Firebaseなど各種バックエンドサービスの設定方法.md](./how-to/initial-setup/Neon_Firebaseなど各種バックエンドサービスの設定方法.md)：バックエンドサービスの連携設定まとめ。
  - [GoogleCloud側で必要なIAMロールと設定方法.md](./how-to/initial-setup/GoogleCloud側で必要なIAMロールと設定方法.md)・[FirebaseAuthのTwitter認証設定_APIキーの取得方法.md](./how-to/initial-setup/FirebaseAuthのTwitter認証設定_APIキーの取得方法.md)：外部サービス連携時の権限・認証手順。
  - [firebase統合についての説明.md](./how-to/initial-setup/firebase統合についての説明.md)：Firebase との統合方針を解説。
- **実装ガイド**（`implementation/`）
  - [アプリへの新規ドメイン追加ガイド.md](./how-to/implementation/アプリへの新規ドメイン追加ガイド.md)：ドメインフォルダのセットアップとルール。
  - [汎用CRUDのフック使用方法.md](./how-to/implementation/汎用CRUDのフック使用方法.md)：CRUD 用フックの実装手順と注意点。
  - [入力フォームの設計方法.md](./how-to/implementation/入力フォームの設計方法.md)・[ユーザーのセッション管理やロールやステータスによるルート制限の方法.md](./how-to/implementation/ユーザーのセッション管理やロールやステータスによるルート制限の方法.md)：フォーム設計・認可の実践的な実装手順。
  - [Neonのマイグレーション実行手順.md](./how-to/implementation/Neonのマイグレーション実行手順.md)：データベースマイグレーションの操作方法。
- **スタイル & デザイン**（`style-and-design/`）
  - [カスタムCSSとアニメーション定義マニュアル.md](./how-to/style-and-design/カスタムCSSとアニメーション定義マニュアル.md)：Tailwind CSS v4 + Next.js 16 環境でのカスタムスタイルガイド。
  - [テーブルのデザイン一括変更について.md](./how-to/style-and-design/テーブルのデザイン一括変更について.md)：テーブル UI を共通調整する際の手順。
- **ユーティリティ**（`utility/`）
  - [GitでMainにマージ済みのブランチを一括削除する方法.md](./how-to/utility/GitでMainにマージ済みのブランチを一括削除する方法.md)：Git 運用の便利手順。
  - [Neonで既存のテーブル構造をDump.md](./how-to/utility/Neonで既存のテーブル構造をDump.md)：Neon でスキーマをエクスポートする方法。

## 📚 リファレンス（`docs/reference/`）
- [使用ライブラリ一覧.md](./reference/使用ライブラリ一覧.md)：採用ライブラリと役割の一覧。
- [NextJS_バージョンごとの重要な変更点.md](./reference/NextJS_バージョンごとの重要な変更点.md)：Next.js 16 の新機能と過去から継続する互換ポイントの整理。

## 🆘 トラブルシューティング（`docs/troubleshooting/`）
- [FirebaseのHostingにデプロイ後にDBが更新されない問題.md](./troubleshooting/FirebaseのHostingにデプロイ後にDBが更新されない問題.md)：Firebase Hosting でキャッシュが効きすぎる際の対処法。
- [Shadcn×Zod×RHFバリデーションが表示されないときに読むDoc.md](./troubleshooting/Shadcn×Zod×RHFバリデーションが表示されないときに読むDoc.md)：フォームバリデーションが動作しない場合の確認手順。
- [position_fixedが画面ではなく親要素基準になる問題について.md](./troubleshooting/position_fixedが画面ではなく親要素基準になる問題について.md)：CSS `position: fixed` が意図通りに動かないときのチェックポイント。

## 🪄 テンプレート利用ガイド
- [テンプレート利用ガイド.md](./テンプレート利用ガイド.md)：このリポジトリをプロジェクトテンプレートとして活用する際の全体像と注意事項をまとめています。

---
上記に目的の情報がない場合は、カテゴリ内をさらに検索するか `rg "キーワード" docs` を活用してください。
