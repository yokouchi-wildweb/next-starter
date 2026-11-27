# cache — 宣言した共有の読みを "use cache: remote" で包んだ関数を作る生成器

## Overview

- `pnpm generate cache` = cache を宣言した全ての登録(`entities/<登録名>/entity.json` の `"cache"`、主でない登録も、fork は隣の `entity.override.ts` の `cache` が丸ごと差し替える、D353。`generate: false` の登録も)に `<domain>/services/server/<登録名>CachedReads.ts` を書く。宣言が消えた登録の生成物(印のある物)は消す。`<domain>/cache.json` は廃止(あれば `pnpm check domain` が止めて移し先を言う)
- `pnpm check cache` = 書かずに、生成物が宣言どおりかを見る(段階 build・ship・forge:post)
- 宣言の形・寿命の上限・検査の正は `src/domains/README.md`「cache（共有の読みのキャッシュの宣言）」と `scripts/structure/domain`(`checks/cache.mjs`・`spec/cache.mjs`)。宣言に問題があれば何も書かずに止まる

## Usage

1. 登録の宣言 entity.json に `cache` を書く(`pnpm check domain` が形を見る)。登録をまたぐ読みは domain.json の `cache.reads`(その語彙は cache の議会が決める、まだ書けない)
2. `pnpm generate cache`(`pnpm forge` も段階 forge:post で回す)
3. 読む側は `import { <登録名>CachedReads } from "@/domains/<domain>/services/server/<登録名>CachedReads"` を自分のドメインの中で使う。他のドメインには自分の services/server の入口から再 export して渡す(ドメインの境界)
4. 判断の道(引く・買う・残高・在庫の引当など)は包んだ読みを使わず `base` を直に読む

## API

- 生成物 `<登録名>CachedReads.ts` の export は `<登録名>CachedReads` の 1 つ(キャッシュタグの名前 d = 登録名): `get(id)`(宣言の `get` が false でない時)・`list()`(`list` がある時、`base.search({ limit })`)・名前付きの読み `<name>()`(`base.search({ where, orderBy, limit })`)
- 各読みは指令を持つ `cached<Name>` と、それを `readThrough(name, cached, direct)` で包んだ `<name>`(置き場が投げたら base を直に読む。DomainError はそのまま)
- どの `cached<Name>` も `"use cache: remote"` + `cacheLife(<宣言の life>)`。`tagged` は `cacheTag`:
  - get: 行のキャッシュタグ `cacheTagOf(d, id)` + 行の全部のキャッシュタグ `cacheRowsTagOf(d)` + 読むドメインのキャッシュタグ
  - list・名前付きの読み: ドメインのキャッシュタグ `cacheTagOf(d)` + 読むドメインのキャッシュタグ
  - `ttl` はキャッシュタグを付けない(書き込みで消さず寿命で切れる)
- 宣言のある登録の `services/server/<登録名>Base.ts`（その登録の土台）は `export const <登録名>Base = createCrudService(..., { cacheTags: { domain: "<登録名>" } })` を持つ。`generate: true` の登録は `pnpm generate domain` が書き、手で管理する登録は無ければこの生成器が名指して止まる

## Internals

- ドメインの一覧は今の木の地区(`src/lib/districtMap` の `readDistrictMapAt`)。生成物 `src/registry/district-map.jsonl` は読まない(他の生成器の入力にしない)
- 宣言は `normalizeCacheDeclaration`(`scripts/structure/domain/spec/cache.mjs`)で既定を埋めてから書く。where / orderBy は宣言のままのリテラル(型は crud の `WhereExpr`・`OrderBySpec` が受ける)
- 生成物の頭の行 `// 生成物・編集不可: pnpm generate cache が <宣言の置き場> の cache から生成する` が印。消すのは印のある物だけ
- 包んだ関数の中は要求の外の読みになる(requestMemo は素通し)。戻り値は直列化される

## Verification

- `scripts/structure/cache/cache.test.mjs`: 生成物の形(tagged / ttl・get false・list・名前付きの読み・読むドメインのキャッシュタグ・寿命の object)、登録ごとの書き込み(主でない登録・fork の上書きの cache)、宣言の消えた登録の消去、宣言の誤り・手書きの base の名指しで書かないこと、実の木で check が通ること、domain の生成器の option

## Related

- `src/lib/cacheTags`: キャッシュタグの名前と、書き込みの側(積む・入口で消す)
- `src/lib/crud` の option `cacheTags`: 書き込みのメソッドがキャッシュタグを積む
