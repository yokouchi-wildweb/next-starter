# `src/lib/firestore`

Firestore をクライアント側で操作するためのアプリケーションレイヤーです。

## `src/lib/firebase/*` との違い

`src/lib/firebase` 配下は Firebase SDK を直接初期化するための低レイヤー（`fstore` インスタンスの提供等）であり、最小限の責務を担います。

一方 `src/lib/firestore` はその SDK インスタンスを利用して、

- リアルタイム購読（`onSnapshot`）のラッパーとデータ変換
- 単発ドキュメント操作（get / set / update / delete）
- バッチ書き込み（`writeBatch`）のヘルパーとチャンク分割
- トランザクション（read-then-write のアトミック操作）
- エラーの正規化と日本語メッセージ変換

といったアプリケーション共通の要件を実装しています。

## 利用指針

- **ドメインの ClientService からこのライブラリの API を使ってください。** Hook は ClientService を経由して間接的に利用します。
- Firebase SDK の細かなオプション調整など、このライブラリでは対応できない特殊なケースのみ `src/lib/firebase/*` を直接参照します。

```
Hook → ClientService (features/*/services/client/)
  → lib/firestore/client/ (subscribe, batch, converter)
    → lib/firebase/client/app.ts (fstore インスタンス)
      → Firebase SDK
```

## ファイル構成

- `client/subscribe.ts` — `onSnapshot` の購読ラッパー（コレクション／単一ドキュメント）
- `client/operations.ts` — 単発ドキュメント操作（get / set / update / delete）
- `client/batch.ts` — `writeBatch` のヘルパー（500件自動チャンク分割）
- `client/transaction.ts` — `runTransaction` のラッパー（read-then-write アトミック操作）
- `client/converter.ts` — Firestore Timestamp → JS Date の再帰的変換
- `client/errors.ts` — Firestore エラーの正規化と日本語メッセージ変換
- `types.ts` — 共通型定義
