# requestMemo — リクエストスコープの無効化可能メモ化

## Overview

- 同一サーバーリクエスト内で繰り返される「同じ行の読み取り」を 1 回の DB クエリに圧縮する基盤。入口 `@/lib/requestMemo`
- React `cache()` の素のラップと違い、書き込み時に invalidate できるので、同一リクエスト内の read-your-writes(書いた直後に読み直すと新しい値が返ること)を保てる
- SSR の 1 リクエストは独立した多数のサブシステム(認可ガード・お知らせ取得・各機能の判定ロジック等)を通り、それぞれが同じ行(グローバル設定・セッションユーザー等)を取る。呼び出し側は他のサブシステムが何を取ったかを知り得ないので、重複排除はサービス層(またはその下)が持つ

## Usage

### CRUD サービスで使う

```ts
// features/<domain>/services/server/drizzleBase.ts
export const base = createCrudService(SomeTable, {
  requestMemo: true, // get のメモ化 + 全書き込みメソッドの自動 invalidate
});
```

- `get(id)`(オプションなし呼び出しのみ)がリクエストスコープでメモ化される
- `update` / `remove` / `bulkUpdate` など全書き込みメソッドが完了時に自動でメモを破棄する
- 生 SQL に落ちる前に: システム管理カラムの更新・SQL 式(アトミック加算等)・WHERE 条件の一括更新は `systemUpdate` / `systemBulkUpdateByQuery` / `bulkUpdateByQuery`(`src/lib/crud/README.md`)で正規経路のまま書ける
- 採用例: user・setting の drizzleBase

### 手で配線する

```ts
import { createRequestMemo } from "@/lib/requestMemo";

const memo = createRequestMemo((id: string) => fetchRow(id));

// 読み取り: 同一リクエスト内の同一キーは DB に 1 回しか行かない
const row = await memo.read("some-id");

// 書き込み後: メモを破棄して read-your-writes を保つ
await writeRow("some-id", data);
memo.invalidate("some-id"); // または memo.invalidateAll()
```

### どの読み取りをメモ化するか

- 向く物: キーが同じなら同一リクエスト内で同じ結果が返るべき読み取り(id 指定の get、シングルトン設定)で、独立した複数のサブシステムから繰り返し呼ばれ、書き込みのパスが有限で invalidate を漏れなく配線できる物
- 向かない物: list / search / count の結果(パラメータ空間が広くヒット率が低い。形状もオプション依存)・リクエストをまたいで共有したいキャッシュ(→ `withAnalyticsCache` 等の別基盤)・リアルタイム性が要る値のポーリング

## API

| オプション(`createRequestMemo(fn, options)`) | 説明 |
| --- | --- |
| `key` | 引数からメモ化キーを導出する関数。省略時は第一引数の `String()` |
| `shouldBypass` | true を返した呼び出しをメモ化せず素通しする(取得オプション付き呼び出し等、戻り形状が変わるケース向け) |

- 戻り: `{ read, invalidate, invalidateAll }`
- CRUD の統合: `createCrudService` の `requestMemo: true`、手動の破棄 `base.invalidateRequestMemo()`

## Internals

### 実行コンテキストごとの挙動

| コンテキスト | 挙動 |
| --- | --- |
| RSC / Server Component レンダリング | メモ化される（リクエスト内共有） |
| Route Handler / Server Action | React のリクエストスコープに従う（スコープ外なら素通し） |
| cron / CLI / スクリプト | `cache()` が素通しになり**毎回素の呼び出し**（従来と同一動作） |

### 既知の限界

- 返却オブジェクトの共有: 同一リクエスト内の複数呼び出し元は同じオブジェクト参照を受け取る。返却値を直接ミューテートすると他の呼び出し元に漏れる
- トランザクション中の読み取り: invalidate は書き込みメソッドの return 時点で発火する。未コミットのトランザクション中に同テーブルを(tx executor を使わず)読むと、コミット前の値がメモに残りうる
- 失敗時: reject された Promise はキャッシュしない。書き込みメソッドは失敗時もメモを破棄する(部分書き込みを安全側に扱う)
- CRUD の実装: `src/lib/crud/drizzle/requestMemo.ts`

## Related

- CRUD サービス(システム更新・一括更新): `src/lib/crud/README.md`
- リクエストをまたぐキャッシュ: `src/features/core/analytics/README.md`
