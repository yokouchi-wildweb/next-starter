# requestMemo — リクエストスコープの無効化可能メモ化

同一サーバーリクエスト内で繰り返される「同じ行の読み取り」を1回のDBクエリに圧縮するための基盤。
React `cache()` の素のラップと違い、**書き込み時に invalidate できる**ため、同一リクエスト内の
read-your-writes（書いた直後に読み直すと新しい値が返ること）を維持できる。

## 背景

SSRの1リクエストは独立した多数のサブシステム（認可ガード・お知らせ取得・各機能の判定ロジック等）を
通過し、それぞれが自分の用途のために同じ行（グローバル設定・セッションユーザー等）を取得する。
呼び出し側は他のサブシステムが既に何を取得したかを知り得ないため、重複排除は呼び出し側ではなく
**サービス層（またはその下）の責務**になる。

## 使い方

```ts
import { createRequestMemo } from "@/lib/requestMemo";

const memo = createRequestMemo((id: string) => fetchRow(id));

// 読み取り: 同一リクエスト内の同一キーはDBに1回しか行かない
const row = await memo.read("some-id");

// 書き込み後: メモを破棄して read-your-writes を維持する
await writeRow("some-id", data);
memo.invalidate("some-id"); // または memo.invalidateAll()
```

### オプション

| オプション | 説明 |
| --- | --- |
| `key` | 引数からメモ化キーを導出する関数。省略時は第一引数の `String()` |
| `shouldBypass` | true を返した呼び出しをメモ化せず素通しする（取得オプション付き呼び出し等、戻り形状が変わるケース向け） |

## CRUDサービスとの統合（推奨経路）

個別のサービスで手動配線する前に、`createCrudService` のオプションを検討すること。

```ts
// features/<domain>/services/server/drizzleBase.ts
export const base = createCrudService(SomeTable, {
  requestMemo: true, // ← これだけで get のメモ化 + 全書き込みメソッドの自動invalidateが有効になる
});
```

- `get(id)`（オプションなし呼び出しのみ）がリクエストスコープでメモ化される
- `update` / `remove` / `bulkUpdate` など**全書き込みメソッドが完了時に自動でメモを破棄**する
  （呼び忘れが構造的に起きない）
- `createCrudService` を経由しない生SQL書き込み（`db.update(Table)` 等）をした場合のみ、
  直後に `base.invalidateRequestMemo()` を手動で呼ぶこと（**必須ルール**）

実装: `src/lib/crud/drizzle/requestMemo.ts` / 採用例: user・setting の drizzleBase

## どの読み取りをメモ化すべきか（採用基準）

対象にしてよいのは以下を満たす読み取りのみ:

- **identity-stable**: キーが同じなら同一リクエスト内で同じ結果が返るべきもの（id指定のget、シングルトン設定）
- **高fan-in**: 独立した複数のサブシステムから同一リクエスト内に繰り返し呼ばれる
- **書き込み頻度が低い**: 書き込みパスが有限で、invalidate 配線を漏れなく維持できる

対象にしないもの:

- list / search / count の結果（パラメータ空間が広くヒット率が低い。形状もオプション依存）
- リクエストをまたいで共有したいキャッシュ → `withAnalyticsCache`（ANALYTICS_PERF）等の別基盤
- リアルタイム性が要求される値のポーリング

## 実行コンテキストごとの挙動

| コンテキスト | 挙動 |
| --- | --- |
| RSC / Server Component レンダリング | メモ化される（リクエスト内共有） |
| Route Handler / Server Action | React のリクエストスコープに従う（スコープ外なら素通し） |
| cron / CLI / スクリプト | `cache()` が素通しになり**毎回素の呼び出し**（従来と同一動作） |

## 注意点・既知の限界

- **返却オブジェクトの共有**: 同一リクエスト内の複数呼び出し元は同じオブジェクト参照を受け取る。
  返却値を直接ミューテートすると他の呼び出し元に漏れる。読み取り結果は不変として扱うこと。
- **トランザクション中の読み取り**: invalidate は書き込みメソッドの return 時点で発火する。
  未コミットのトランザクション中に同テーブルを（tx executor を使わず）読むと、コミット前の値が
  メモに残る可能性がある。tx 内の読み取りは tx executor 経由で行う既存の原則を守ること。
- **失敗時**: reject された Promise はキャッシュされない。書き込みメソッドは失敗時もメモを破棄する
  （部分書き込みを安全側に扱うため）。
