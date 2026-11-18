# `src/lib/firestore`

## Overview

- Firestore をクライアント側で操作するためのアプリケーションレイヤー。入口 `@/lib/firestore/client`
- `src/lib/firebase/*` は Firebase SDK を初期化する低レイヤー(`fstore` インスタンスの提供等)で、最小限の責務を持つ
- こちらはその SDK インスタンスを使って、アプリ共通の要件を持つ: リアルタイム購読(`onSnapshot`)のラッパーとデータ変換・単発ドキュメント操作・バッチ書き込みのチャンク分割・トランザクション(read-then-write)・エラーの正規化と日本語メッセージ変換

## Usage

- 呼び手はドメインの ClientService。Hook は ClientService を経由して使う

```
Hook → ClientService (features/*/services/client/)
  → lib/firestore/client/ (subscribe, batch, converter)
    → lib/firebase/client/app.ts (fstore インスタンス)
      → Firebase SDK
```

- このライブラリで対応できない SDK の細かなオプション調整など、特殊なケースだけ `src/lib/firebase/*` を直接読む

## API

- 購読: `subscribeCollection` / `subscribeCollectionChanges` / `subscribeDoc`(`onSnapshot` のラッパー、コレクション / 単一ドキュメント。型 `SubscribeOptions` / `CollectionChangesSnapshot` / `DocChange`)
- 単発操作: `getDoc` / `queryDocs` / `setDoc` / `updateDoc` / `deleteDoc`(型 `QueryResult`)
- バッチ: `executeBatch`(`writeBatch` のヘルパー、500 件ごとに自動でチャンク分割。型 `BatchOperation`)
- トランザクション: `executeTransaction`(`runTransaction` のラッパー、read-then-write のアトミック操作。型 `TransactionContext`)
- 変換: `convertTimestamps`(Firestore Timestamp → JS Date の再帰的変換)
- 誤り: `normalizeFirestoreError`(Firestore エラーの正規化と日本語メッセージ変換)
- 共通型: `types.ts`

## Related

- SDK の初期化: `src/lib/firebase/README.md`
