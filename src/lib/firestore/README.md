# `src/lib/firestore`

## Overview

- Firestore をクライアント側で操作するためのアプリケーションレイヤー。閉じた lib(`package.json` の exports)で、外からは 2 つの入口だけで読む
  - `@/lib/firestore/client`(入口 `./client`、ブラウザの Firestore SDK を読む): 購読・単発操作・バッチ・トランザクション・変換・誤りの正規化
  - `@/lib/firestore`(入口 `.`、client でも server でも読める。SDK は読まない): 共通の型 `Unsubscribe`・`FirestoreClientError` と、Timestamp を Date に戻す再帰 `convertTimestampsWith`
- `src/lib/firebase`(この lib は入口 `@/lib/firebase/client` だけを読む)は Firebase SDK を初期化する低レイヤー(`fstore` インスタンスの提供等)で、最小限の責務を持つ
- こちらはその SDK インスタンスを使って、アプリ共通の要件を持つ: リアルタイム購読(`onSnapshot`)のラッパーとデータ変換・単発ドキュメント操作・バッチ書き込みのチャンク分割・トランザクション(read-then-write)・エラーの正規化と日本語メッセージ変換

## Usage

- 呼び手はドメインの ClientService。Hook は ClientService を経由して使う

```
Hook → ClientService (domains/*/services/client/)
  → lib/firestore/client/ (subscribe, batch, converter)
    → @/lib/firebase/client (fstore インスタンス)
      → Firebase SDK
```

- このライブラリで対応できない SDK の細かなオプション調整など、特殊なケースだけ `@/lib/firebase/client` を直接読む

## API

- 購読: `subscribeCollection` / `subscribeCollectionChanges` / `subscribeDoc`(`onSnapshot` のラッパー、コレクション / 単一ドキュメント。型 `SubscribeOptions` / `CollectionChangesSnapshot` / `DocChange`)
- 単発操作: `getDoc` / `queryDocs` / `setDoc` / `updateDoc` / `deleteDoc`(型 `QueryResult`)
- バッチ: `executeBatch`(`writeBatch` のヘルパー、500 件ごとに自動でチャンク分割。500 件を超えるとチャンクの間はアトミックでない。型 `BatchOperation`)
- トランザクション: `executeTransaction`(`runTransaction` のラッパー、read-then-write のアトミック操作。型 `TransactionContext`)
- 変換: `convertTimestamps`(クライアント SDK の Timestamp → JS Date の再帰的変換。再帰は入口 `.` の `convertTimestampsWith` に `instanceof Timestamp`(firebase/firestore)を渡す)
- 誤り: `normalizeFirestoreError`(Firestore エラーの正規化と日本語メッセージ変換)
- 共通型(入口 `@/lib/firestore`。`types.ts`): `Unsubscribe`・`FirestoreClientError`
- Timestamp の変換の再帰(入口 `@/lib/firestore`。`timestamps.ts`): `convertTimestampsWith(data, isTimestamp)`(isTimestamp が真の値を `toDate()` で Date に、配列と素のオブジェクト(prototype が Object か null)の中も辿り、Date・GeoPoint・参照などのインスタンスはそのまま返す。型 `TimestampLike`)。判定は呼ぶ側の SDK で渡す: 画面側は `./client` の `convertTimestamps`、保存側は `src/lib/crud/firestore/timestamps.ts`(firebase-admin/firestore の Timestamp)。再帰の写しは作らない

## Related

- SDK の初期化: `src/lib/firebase/README.md`
