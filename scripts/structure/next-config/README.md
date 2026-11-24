# scripts/structure/next-config

## Overview

- Next の設定の約束を見る段階の対象です(D300)。各リポの素の `next.config.ts`(型 5 self)は Tier1 の本体 `next.config.core.ts` を読み、足す・包む・外す。読み忘れた・外しすぎた版が黙って約束を落とさないよう、解いた最後の設定を見ます(ESLint の必須の規則 `pnpm check eslint` と同じ作り)
- 上流も fork も同じ道具が回ります(fork ごとの入切は無い)(cacheComponents の検査を広げた物)
- 2 つの判定を持ちます。段階 `build`・`ship` は解いた設定を、段階 `build:post`(`pnpm build` の next build の後)は build の成果物を見ます
- build の成果物の判定には殻の検査が入ります。殻 = 全員に同じ物が配られる、build で焼いた最初の HTML です。管理・ログイン必須・debug の範囲のページの殻に、見える文字とメニュー・リンクが無いことを見ます(段 3 で殻に入れるのは会員の枠と公開の範囲のページだけ)。「枠」は見える物で、空の外枠の入れ物(`data-frame-root` の div)は殻に入ってよい(D55)。ログイン必須の範囲でも、全員に同じ会員の枠(ロゴ・ヘッダーの器・フッター)は殻に入ってよく、その部位を除いた本文の側を見る(D57)。
- 逆向きに、公開の範囲で会員の枠の下のページの殻に会員の枠が入っていることも見ます(どこかの読みが Suspense の外に出ると、枠ごと root の穴に落ちて殻が空になる)。

## Usage

```
pnpm check next-config                     # 素の next.config.ts を解いた設定を見る
pnpm check next-config --phase=build:post  # .next の成果物と殻を見る(先に next build)。pnpm build の末尾で毎回回る
```

- exit 0 = 通る / 1 = 問題あり / 2 = build の成果物(required-server-files.json・prerender-manifest.json)が無い(build:post だけ。未検証で、通過ではない)
- 殻の HTML は build の形ごとの置き場から引く(`locateShells`): 素の build は `.next/server/app/<path>.html`、adapter の build(Vercel は env `NEXT_ADAPTER_PATH` で adapter を挿す)は `.next/server/route-cache/APP_PAGE/<鍵>/$/<path>.html`。どちらにも無い時は止めずに `未検証: 殻の HTML が見つからない…` の 1 行を出して exit 0(殻の検査は手元の `pnpm build` で確かめる)

## API

- `resolveConfig(exported, { phase, defaultConfig })`(lib.mjs): Next と同じ手順で解く。default export が関数なら `(phase, { defaultConfig })` で呼んで待つ(`withSentryConfig` のような包みも解ける)
- `checkConfig(config, expected)`(lib.mjs): 約束ごとに 1 行の問題を返す
  - `env.FEATURE_GATE_TIER1` = `String(readForkIdentity(root).isTier1)`(門番の全開スイッチの Tier1 の判別。読み手 `src/featureGate/openSwitch.ts`)
  - `env.APP_ENV` = `getAppEnv()`(client の段階の答え、`@/lib/appEnv`)
  - `generateBuildId` があり、その答えが `env.NEXT_BUILD_ID`(読み手 `/api/health` のデプロイの検知)
  - `images.remotePatterns`: 本体の `imageRemotePatterns`(上流の置き場、同じ env で計算)が全部残り、どの許可もホスト全体を許さない(hostname に `*` が無く、pathname の最初の段が固定)
  - `rewrites` に Firebase の認証の転送 `/__/:path*` → `https://<project>.web.app/__/:path*`(配列でも beforeFiles / afterFiles / fallback の組でもよい)。本体は `NEXT_PUBLIC_FIREBASE_PROJECT_ID` がある時だけ作るので、検査は env に値が無ければ代わりの id(`check.ts` の `STAND_IN_FIREBASE_PROJECT_ID`、この検査の process の中だけ)で解いて形を確かめる
  - `cacheComponents` が `true`・`partialPrefetching` が `true`(全体で。fork ごとのスイッチ・セグメントごとの `prefetch = 'partial'` は使わない。Next の次の大きな版で唯一の動きになる)
- `checkBuild(distDir)`(lib.mjs): `<distDir>/required-server-files.json` の `config.cacheComponents` が `true`・`<distDir>/prerender-manifest.json` の `routes` に `/api` の下の route が無い(静的に焼き付いた API = build の表の ○)。成果物が無ければ null
- `checkShells(distDir, rows)`(lib.mjs): `rows` = `src/app/route-map.jsonl` の行。戻り値 `{ problems, holePages, publicPages, framedPages }`。公開の範囲で会員の枠の下(`isUserFrame`)のページ(殻のあるもの、`[param]` を除く)は殻に `data-frame-root` と部位の包み `data-frame-part` があり、外枠が未公開の区画の外にあること(`frameRootHidden`、`framedPages` = 見た本数)。route-map の鎖の loader が `shell: true` の公開のページは、殻の本文の側(会員の枠の部位と開かれない区画を除く)に見える文字があること(無い = 宣言したのに request を読む部品がある)、守りの鎖の loader の `shell: true` は問題(load を省いただけのページは宣言ではないので見ない)。`checkShells(distDir, rows, { repoRoot })` は loader の文を repoRoot から読む。殻に入れない範囲(`isHoleRange`)のページごとに、殻の HTML(`shellPath`)の body に見える文字とメニュー・リンク(`readShellBody`: script・style・template・noscript の外の文字と `nav`・`a`・`role="navigation"`)が無いこと、殻の HTML があること(無い = ページが殻を作らない形になった。閉じた機能のページ `gatedOff` は飛ばす)を見る。殻の HTML(`locateShells`)が 1 本も無ければ null
- `isUserFrame(row)`: page のファイルが `src/app/(user)/` の下(会員の枠 UserLayout の下) | `stripSlots(html, slots)`: data-slot が slots の要素を中身ごと除く。会員の枠の下のログイン必須の範囲は `USER_FRAME_PART_SLOTS`(header・footer・bottom-nav)を除いてから文字・リンクを見る(D57)
- `isHoleRange(row)`: 鎖に `public` でない guard がある(保護の範囲)か、ページが管理の枠 `src/app/admin/` の下にある(`/admin/login`・`/admin/setup` も)。殻に入れない範囲(D50: 管理・ログイン必須・debug)
- `locateShells(distDir)`: path → 殻の HTML のファイル(素の build の `server/app` と adapter の build の `server/route-cache/APP_PAGE/<鍵>/$/` の両方、両方にあれば素の build の物) | `shellPath(distDir, path)`: 素の build の道 `<distDir>/server/app/<path>.html`(`/` は `index.html`、`[param]` は名前のまま) | `unrevealedSegments(html)`: 殻の中で開かれない区画(`<div hidden id="S:n">` のうち、殻の中の `$RC("B:x","S:n")` が開かない物 = 穴の読み手を待つ区画)の範囲。中身の揃った区画は殻の `$RC` がその場で開くので数えない | `frameRootHidden(html)`: 外枠がその区画の中なら true(枠は殻の DOM に入っても、同じ境界の Suspense の無い読み手が届く流れの終わりまで見えない) | `stripHiddenSegments(html)`: その区画を中身ごと除く(殻を開いた時に見える物) | `loaderShellMode(source)`: loader の文が `shell: true` なら "shell"、createLoader({ … }) に `load:` が無ければ "no-load"、それ以外 null | `readShellBody(html)`: `{ frameRoot, text, navs }`(frameRoot は公開の範囲の判定用、殻に入れない範囲では問題にしない)。穴の残る殻は `</body>` で閉じないので、`<body>` から終わりまでを読む

## Extension

- fork が素の版で変えてよい物: 約束の外の鍵は自由(`allowedDevOrigins`・包み・自分の `env` の鍵)。画像の許可は自分の置き場のパスを足してよい(自分の CDN 等。ホスト全体は不可)。rewrites は本体の物を残して足す

## Internals

- ホスト全体の画像の許可を止める理由: 第三者のファイルの最適化に自分の課金枠を使われる踏み台になる(`next.config.core.ts` の注記)
- git は読まない: 名前は `repo.json`(`readForkIdentity`)、段階は env。`.git` の無い Vercel の build でも段階 `build` で回る
- 段階 `build` は offline(DB・外部の env を空にして回る)。設定を読み込むだけで、外へは届かない
- 静的に焼き付いた API: request を読む前に返す GET は cacheComponents の build で ○ になり、応答が build の時の値に固まる。route.ts は wiring の Factory(`createApiRoute` 等、cron は `createCronTaskRoute`)で書けば、Factory の芯が最初に `connection()` を待つので焼き付かない(src/lib/routeFactory/README.md)
- fork の取り込み(/flux)の区間の検査は build をしないので、/flux で効くのは `ship` の段階の設定の判定。成果物の判定は fork の `pnpm build`(Vercel の build も)と /ship --safe の全部の検査で効く
- build:post は offline の段階(DB・外部の env を空にして回る)。この判定は .next のファイルを読むだけ
- 殻に入れない範囲を殻で見る理由: 殻は全員(未ログインも)に同じ物が配られるので、管理のメニューや保護された本文が殻に入ると未ログインの応答に載る。見える部分(メニュー・リンク・本文)は Suspense の内側(穴)に置き、request ごとに流し込む
- 空の外枠を許す理由(D55): 中身の無い入れ物は何も見せない。root の Provider を殻へ出すと管理の枠の外側(`AdminLayout` の外枠の div)は殻に入るが、サイドバー・メニューは管理の守り(`guard()`)の内側で穴のまま
- 会員の枠が殻に入る理由: root の children の Suspense の中身は、ページの読みを `(user)/loading.tsx` の境界が受けるので完了し、枠(根は URL もセッションも読まない)が殻に焼かれる。ログインで変わる部分(ヘッダーのメニュー・ボトムナビの項目)と本文は穴
- ログイン必須の範囲の会員の枠を許す理由(D57): 枠は全員に同じ物で、未ログインに見せてはいけない物(保護された本文)は穴のまま

## Verification

- `pnpm test scripts/structure/next-config/lib.test.mjs`
