# scripts/structure/next-config

## Overview

- Next の設定の約束を見る段階の対象です(D300)。各リポの素の `next.config.ts`(型 5 self)は Tier1 の本体 `next.config.core.ts` を読み、足す・包む・外す。読み忘れた・外しすぎた版が黙って約束を落とさないよう、解いた最後の設定を見ます(ESLint の必須の規則 `pnpm check eslint` と同じ作り)
- 上流も fork も同じ道具が回ります(fork ごとの入切は無い)(cacheComponents の検査を広げた物)
- 2 つの判定を持ちます。段階 `build`・`ship` は解いた設定を、段階 `build:post`(`pnpm build` の next build の後)は build の成果物を見ます

## Usage

```
pnpm check next-config                     # 素の next.config.ts を解いた設定を見る
pnpm check next-config --phase=build:post  # .next の成果物を見る(先に next build)。pnpm build の末尾で毎回回る
```

- exit 0 = 通る / 1 = 問題あり / 2 = build の成果物が無い(build:post だけ。未検証で、通過ではない)

## API

- `resolveConfig(exported, { phase, defaultConfig })`(lib.mjs): Next と同じ手順で解く。default export が関数なら `(phase, { defaultConfig })` で呼んで待つ(`withSentryConfig` のような包みも解ける)
- `checkConfig(config, expected)`(lib.mjs): 約束ごとに 1 行の問題を返す
  - `env.FEATURE_GATE_TIER1` = `String(readForkIdentity(root).isTier1)`(門番の全開スイッチの Tier1 の判別。読み手 `src/featureGate/openSwitch.ts`)
  - `env.APP_ENV` = `getAppEnv()`(client の段階の答え、`@/lib/appEnv`)
  - `generateBuildId` があり、その答えが `env.NEXT_BUILD_ID`(読み手 `/api/health` のデプロイの検知)
  - `images.remotePatterns`: 本体の `imageRemotePatterns`(上流の置き場、同じ env で計算)が全部残り、どの許可もホスト全体を許さない(hostname に `*` が無く、pathname の最初の段が固定)
  - `rewrites` に Firebase の認証の転送 `/__/:path*` → `https://<project>.web.app/__/:path*`(配列でも beforeFiles / afterFiles / fallback の組でもよい)
  - `cacheComponents` が `true`・`partialPrefetching` が boolean(段 3 までは false。書かないと Next が警告)
- `checkBuild(distDir)`(lib.mjs): `<distDir>/required-server-files.json` の `config.cacheComponents` が `true`・`<distDir>/prerender-manifest.json` の `routes` に `/api` の下の route が無い(静的に焼き付いた API = build の表の ○)。成果物が無ければ null

## Extension

- fork が素の版で変えてよい物: 約束の外の鍵は自由(`allowedDevOrigins`・包み・自分の `env` の鍵)。画像の許可は自分の置き場のパスを足してよい(自分の CDN 等。ホスト全体は不可)。rewrites は本体の物を残して足す

## Internals

- ホスト全体の画像の許可を止める理由: 第三者のファイルの最適化に自分の課金枠を使われる踏み台になる(`next.config.core.ts` の注記)
- git は読まない: 名前は `repo.json`(`readForkIdentity`)、段階は env。`.git` の無い Vercel の build でも段階 `build` で回る
- 段階 `build` は offline(DB・外部の env を空にして回る)。設定を読み込むだけで、外へは届かない
- 静的に焼き付いた API: request を読む前に返す GET は cacheComponents の build で ○ になり、応答が build の時の値に固まる。route.ts は wiring の Factory(`createApiRoute` 等、cron は `createCronTaskRoute`)で書けば、Factory の芯が最初に `connection()` を待つので焼き付かない(src/lib/routeFactory/README.md)
- fork の取り込み(/flux)の区間の検査は build をしないので、/flux で効くのは `ship` の段階の設定の判定。成果物の判定は fork の `pnpm build`(Vercel の build も)と /ship --safe の全部の検査で効く

## Verification

- `pnpm test scripts/structure/next-config/lib.test.mjs`
