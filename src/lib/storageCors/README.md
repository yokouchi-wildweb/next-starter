# storageCors

別ドメイン(Firebase Storage 等)の **バイト列をブラウザで読み取る** 機能で、`CORS 未設定` を
**エラー発生地点で開発者に気づかせる** ための自己診断ユーティリティ。

> ⚠ このライブラリは「気づきの安全網」。CORS 設定そのものの手順・判定ルール・前提(権限/env)は
> 一次情報に集約しています → [StorageのCORS設定（リモートメディア読み取りの基盤前提）](../../../docs/how-to/initial-setup/StorageのCORS設定（リモートメディア読み取りの基盤前提）.md)

## なぜ必要か

ドキュメントを整備しても、辿り着かなかった開発者は CORS 未設定のまま実装を進め、本番で初めて
`Failed to fetch`(MSE/fetch) や tainted canvas(`SecurityError`) に直面する。素のエラーは原因が分かりにくい。
そこで **開発時(`NODE_ENV !== "production"`)に限り**、原因の可能性・対処コマンド・一次ドキュメントへの導線を
`console.warn` で案内する。

## 設計方針

- **断定しない**: `Failed to fetch` はネットワーク断 / URL 誤り / 認証失敗でも起きるため「可能性」として案内。
- **本番では何もしない / ブラウザ以外でも何もしない**(CORS はブラウザの fetch/canvas の概念)。
- **連投しない**: 同一 URL/文脈の案内は一度だけ(多数フラグメントのループ取得で console を汚さない)。
- **一次情報は持たない**: 手順・前提は docs に集約し、ここからは参照のみ。

## API

fetch 側 / canvas 側で対称な「診断プリミティブ + ラッパー」を提供する。

| 用途 | 関数 |
| --- | --- |
| fetch 失敗を診断(catch 内で呼ぶ) | `diagnoseStorageFetchError(error, url?)` |
| fetch ラッパー(失敗時に自動診断→再 throw) | `fetchStorageBytes(url, init?)` |
| tainted canvas を診断(catch 内で呼ぶ) | `diagnoseTaintedCanvasError(error, sourceUrl?)` |
| canvas.toBlob ラッパー(汚染時に自動診断→reject) | `canvasToBlobSafe(canvas, type?, quality?, sourceUrl?)` |
| 判定ヘルパ | `isCorsLikeFetchError` / `isLikelyCrossOriginStorageUrl` / `isTaintedCanvasError` |
| 参照用定数 | `STORAGE_CORS_DOC_PATH` / `STORAGE_CORS_SETUP_COMMAND` |

## 使い方

### 別ドメインのバイトを fetch する箇所

```ts
import { fetchStorageBytes } from "@/lib/storageCors";

const res = await fetchStorageBytes(url); // 失敗時、開発中だけ CORS 設定を案内
const buf = await res.arrayBuffer();
```

既存の `fetch` を手放したくない場合は catch 内で診断だけ呼ぶ:

```ts
import { diagnoseStorageFetchError } from "@/lib/storageCors";

try {
  await fetch(url);
} catch (error) {
  diagnoseStorageFetchError(error, url);
  throw error;
}
```

### リモートメディアを canvas に取り込んでサムネ/フレームを書き出す箇所

```ts
import { canvasToBlobSafe } from "@/lib/storageCors";

// <video crossOrigin="anonymous"> を canvas に描画した後
const blob = await canvasToBlobSafe(canvas, "image/png", undefined, videoSrc);
```

## 採用箇所

- `src/lib/seamlessVideo`(URL ソースのフラグメント取得 `core/fragmentBytes.ts`)
