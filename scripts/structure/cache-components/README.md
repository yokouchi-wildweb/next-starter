# scripts/structure/cache-components

## Overview

- Next の cacheComponents が有効のまま組み上がっているかを見る門の対象です。上流も fork も同じ道具が回ります(fork ごとの入切は無い)。
- 2 つの判定を持ちます。門 `ship`(/ship・/flux の区間の検査)は `next.config.ts` の値を、門 `build:post`(`pnpm build` の next build の後)は build の成果物を見ます。

## Usage

```
pnpm check cache-components                     # next.config.ts の値を見る
pnpm check cache-components --phase=build:post   # .next の成果物を見る(先に next build)。pnpm build の末尾で毎回回る
```

- exit 0 = 通る / 1 = 問題あり / 2 = build の成果物が無い(build:post だけ。未検証で、通過ではない)

## API

- `checkConfig(config)`(lib.mjs): `cacheComponents` が `true`・`partialPrefetching` が boolean(段 3 までは false。書かないと Next が警告)
- `checkBuild(distDir)`(lib.mjs): `<distDir>/required-server-files.json` の `config.cacheComponents` が `true`・`<distDir>/prerender-manifest.json` の `routes` に `/api` の下の route が無い(静的に焼き付いた API = build の表の ○)。成果物が無ければ null

## Internals

- 静的に焼き付いた API: request を読む前に返す GET は cacheComponents の build で ○ になり、応答が build の時の値に固まる。route.ts は wiring の Factory(`createApiRoute` 等、cron は `createCronTaskRoute`)で書けば、Factory の芯が最初に `connection()` を待つので焼き付かない(src/lib/routeFactory/README.md)
- fork の取り込み(/flux)の区間の検査は build をしないので、/flux で効くのは `ship` の門の設定の判定。成果物の判定は fork の `pnpm build`(Vercel の build も)と /ship --safe の全部の検査で効く
- build:post は offline の門(DB・外部の env を空にして回る)。この判定は .next のファイルを読むだけ

## Verification

- `pnpm test scripts/structure/cache-components/lib.test.mjs`
