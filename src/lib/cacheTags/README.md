# cacheTags — 書き込みの要求で捨てるキャッシュの札を集め、終わりにまとめて捨てる

## Overview

- データの読みのキャッシュ(`"use cache: remote"` + `cacheTag`)を、書き込みの後に捨てる側の芯。入口 `@/lib/cacheTags/server`(集める・捨てる)・`@/lib/cacheTags`(札の名前の形だけ、client でも server でも)
- 札は 3 種類(誰が付け、誰が消すか):
  - ドメインの札 `"<domain>"`(`cacheTagOf(domain)`): list・名前付きの読み・件数が付け、そのドメインの書き込みが必ず消す。他のドメインを読む読みは、そのドメインの札も付ける(宣言の readsDomains)
  - 行の札 `"<domain>:<id>"`(`cacheTagOf(domain, id)`): get が付け、その行を書いた書き込みが消す
  - 行の全部の札 `"<domain>:*"`(`cacheRowsTagOf(domain)`): get が行の札と一緒に付け、どの行を書いたか分からない書き込み(条件の一括・並べ替え・置き換え・全削除)が消す
- 書き込みの側は `markCacheTags(...)` を呼ぶだけ。DB にも Next にも触れず、トランザクションを伸ばさない。捨てるのは入口が敷いた範囲の終わりに 1 回
- 範囲を敷く入口: routeFactory の createApiRoute(createDomainRoute・createMeRoute を含む)と createDeviceRoute、lib/cron の route。pnpm task・seed・起動時は包まない(範囲の外)
- 積む側: createCrudService の option `cacheTags: { domain }`(`src/lib/crud/README.md`「cacheTags」)。生 SQL の書き込みは `service.markCacheTags(ids?)`
- 読む側: ドメインの読みは宣言 cache と pnpm generate cache の生成物。ドメインの宣言に乗らない仕組み(analytics の withAnalyticsCache)は `defineSharedRead`(同じ置き場 `"use cache: remote"`・同じ札・同じ落ち方 readThrough)。手で `"use cache: remote"` を書けるのはこの lib と生成物だけ(lint use-cache/remote-only-generated)

## Usage

```ts
import { cacheTagOf, markCacheTags, runWithCacheTags } from "@/lib/cacheTags/server";
// 入口(routeFactory・cron)は既に包んでいる。自分の入口を作る時だけ

// 入口: 要求の処理を包む(終わりに集めた札を捨てる)
const response = await runWithCacheTags(() => handler(request));

// 書き込みの側: 書いた行とドメインの札を積む
await db.update(posts).set(values).where(eq(posts.id, id));
markCacheTags(cacheTagOf("post"), cacheTagOf("post", id));
```

- 札の名前は `cacheTagOf` で作る(読みの側の `cacheTag(...)` と同じ名前になる)。手で `"post:" + id` を組まない
- 余分に積むのは無害(捨てた後の最初の読みが DB を読み直すだけ)。積み忘れは古い値が残る

## API

- `cacheTagOf(domain, id?)`: `"<domain>"` / `"<domain>:<id>"`。空の domain・空の id・id `"*"`・`:` を含む domain・256 字を超える札は投げる
- `cacheRowsTagOf(domain)`: `"<domain>:*"`
- `readThrough(name, cached, direct)`(`./server`): cached を呼び、置き場の失敗で投げたら direct(DB を直に読む)を返す。DomainError はそのまま投げる。落ちた時は `console.error` `{"event":"cache read fell back to the database","read":<name>,"error":<message>}`。pnpm generate cache の生成物が使う
- `defineSharedRead(name, read)`(`./server`): read を名前で覚え、`(options, ...args) => Promise<T>` を返す。options = `{ life: { stale?, revalidate, expire }(秒), tags }`(呼ぶたびに決めてよい、鍵の一部)。体は `"use cache: remote"` + `cacheLife(life)` + `cacheTag(...tags)` で、名前で引いた read を呼ぶ(関数は引数に乗らない: Next の use cache は関数を pass-through でしか受けない)。readThrough で包む。args と戻り値は直列化できる値だけ(素のオブジェクト・配列・Date・Map・Set)。同じ名前の別の read は投げる(同じ定義の読み直し = 開発中の再読み込みは置き換える)。同じ鍵の同時の取りこぼしはそれぞれ計算する(process の中の相乗りは無い)
- `markCacheTags(...tags)`: 今の範囲に積む(同じ札は 1 つ、空の札は無視)。範囲の外では投げずに記録の 1 行
- `runWithCacheTags(fn, deps?)`: 範囲を敷いて `fn` を走らせ、`fn` の値(または throw)をそのまま返す。`deps.revalidate` = 札を捨てる関数(既定 `revalidateTag(tag, { expire: 0 })`、test が差し替える)
- 記録の行(1 行の JSON、秘密は載せない):
  - `console.warn` `{"event":"cache tags not revalidated outside a request","count":<この process で何回目か>,"tags":[頭の 5 件],"tagCount":<数>}`
  - `console.error` `{"event":"cache tags revalidate failed","tagCount":<積んだ数>,"failedCount":<失敗の数>,"tags":[失敗の頭の 5 件],"error":<最初の失敗の message>}`

## Internals

- 範囲は node の `AsyncLocalStorage`。`await`・`Promise`・タイマーをまたいで同じ範囲に積まれる。既に範囲の中で `runWithCacheTags` を呼ぶと新しい範囲を敷かず、外側の終わりに 1 回だけ捨てる
- 捨てるのは `fn` が成功しても throw しても(`finally`)。途中で確定した書き込みの古い値を残さない
- なぜ `expire: 0` か: 捨てた直後の読みが待って DB を読み直す(書いた本人の次の画面が古い値を出さない)。`"max"` は古い値を返して裏で作り直すため、書いた直後に古い値が見える
- `revalidateTag` は Next の要求(Route Handler・Server Function)の中でしか呼べない。範囲の外(`pnpm task`・起動時・test)の書き込みは捨てられないので、投げずに数えて記録の 1 行を出す。永続の再送は持たない(キャッシュは有限の寿命で自然に切れる)
- 捨てるのに失敗しても要求は成功させる(書き込みはもう確定している)。残りの札も捨て、記録の 1 行を出す
- 既定の置き場(Next のキャッシュ)ではその process の分だけが捨てられる。複数の地域・複数の process をまたいで届くかは未測

## Verification

- `src/lib/cacheTags/context.test.mts`: 積む・重複・入れ子・成功と throw の両方で捨てる・捨てるのに失敗しても要求は成功・範囲の外は 1 行で投げない・札の形の検査
- `src/lib/cacheTags/sharedRead.test.mts`: 寿命と札を置き場に渡す・名前で引いた読みに引数を渡す・置き場が投げたら直に読む・同じ名前の別の読みは投げる(next/cache は差し替え。共有の置き場そのものは Next の中でだけ動く)

## Related

- `src/lib/userDirty`: 同じ形(要求の範囲に集めてコミットの後に流す)の再計算の回収口(入口 `@/lib/userDirty/server`)
- `src/lib/requestMemo`: 1 つの要求の中だけのメモ化(要求をまたぐキャッシュはこの lib の側)
