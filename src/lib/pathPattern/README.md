# pathPattern

## Overview

- 住所(URL のパス)のパターン照合。純粋関数だけ(Node 組み込みも features も読まない)で、proxy(Edge)・Node の道具・テストのどこからでも読める
- `.mjs` なのは、tsx を通さない Node の道具からも同じ物を読むため
- 使う時・直す時の決まりは札 .claude/rules/items/lib/pathPattern.md にある

## Usage

### パターンの書き方

- `"/demo"` … セグメント境界の前方一致(`/demo` と `/demo/**`。`/demo-login` は含まない)。末尾スラッシュは同義
- `"=/mypage"` … そのパスちょうど(fork が同じ URL の下に足したページ `/mypage/<fork のページ>` を巻き込まない)

## API

- 入口 `index.mjs`。import は `@/lib/pathPattern/index.mjs`(TS はフォルダの index.mjs を解かない)
- `matchesPath(pathname, pattern)` … リクエストのパスがパターンに一致するか
- `patternCoversRoute(pattern, routeSegments)` … パターンが src/app のルート(セグメントの配列、動的セグメント `[x]` はどの値にも一致しうる)を覆うか。完全一致のパターンは長さも同じときだけ覆う
- `isExactPattern(pattern)` … `=` 付きの完全一致の書き方か
- `patternSpecificity(pattern)` … パターンの細かさ(大きいほど細かい: 長い住所、同じ長さなら `=` の完全一致)。門番が当たった閉じた住所のうち一番細かい物を答えにするのに使う

## Related

- 門番の判定 `src/featureGate/evaluate.ts`(機能を閉じる規則の `pathPatterns`、`gate.path`)
- ルート地図 `src/lib/screens/routeMap.mjs`(止めたページの `gatedOff`)
- 検査 `src/featureGate/checks/`(`pnpm test src/featureGate scripts/structure/proxies`)
