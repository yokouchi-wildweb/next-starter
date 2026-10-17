// src/registry/screenRoutesRegistry.ts
// 中間 Tier の fork(自分もさらに下流の上流になるリポジトリ)が、自分のルートを
// `pnpm test:screens` の検査対象に登録するためのレジストリ。
//
// 設計思想:
//  - upstream(next-starter)のルート一覧は src/lib/screens/screens.test.mjs の UPSTREAM_ROUTES が持つ。
//    そこに fork のルートを足すと upstream の改修ごとに merge 衝突するので、fork はここに書く
//  - 検査内容は UPSTREAM_ROUTES と同じ: `_screen/<Name>Screen.tsx` の存在と named export、
//    loader の規律(server-only + cache())は全てのリポジトリで走り、
//    page.tsx の「1 行スイッチ」検査は `owner` が git の origin URL に一致するリポジトリでだけ走る
//    (page.tsx はそのルートの下流では下流所有なので検査しない)
//  - upstream は空配列で出荷。葉の fork(さらに下流を持たない)は空のままでよい
//  - このファイルは作成後 downstream 所有(upstream は今後編集しない。src/styles/custom/** と同じ扱い)
//
// 登録例(Tier2 が自分のルートを守る):
//   export const FORK_SCREEN_ROUTES: ScreenRouteEntry[] = [
//     {
//       dir: "src/app/(user)/(protected)/play",
//       screen: "PlayScreen",
//       loader: "src/features/gacha/services/server/loaders/play.ts",
//       owner: "[:/]yokouchi-wildweb/oripa-do(\\.git)?/?$",   // 両端をアンカーする(README §10)
//     },
//   ];
//
// 詳細: src/lib/screens/README.md(「中間 Tier の fork が自分のルートを守る」)

import type { ScreenRouteEntry } from "@/lib/screens/types";

export const FORK_SCREEN_ROUTES: ScreenRouteEntry[] = [];
