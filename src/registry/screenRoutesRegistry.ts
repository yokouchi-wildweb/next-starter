// src/registry/screenRoutesRegistry.ts
// `pnpm test:screens` の例外リスト(fork 所有)。
//
// test:screens は src/app/(user)/** と (marketing)/**、dc:generate の管理画面ルートの page.tsx を
// 自動検出し、全てが「1 行スイッチ(+ _screen/ または _components/ の Screen)」であることを検査する。
// 新しいページを作るときに登録は不要(page.tsx 1 行 + _screen/<Name>Screen.tsx を置くだけで検査対象になる)。
//
// ここに書くのは「まだ移行していないルート」だけ。理由を添えて明示する(黙って古いままにはできない)。
// 移行が済んだらその行を外す(残っているとテストが「除外リストから外す」と指摘する)。
// upstream は空で出荷し、以後このファイルを編集しない(src/styles/custom/** と同じ扱い)。
// upstream 自身の未移行ルートは src/lib/screens/screens.test.mjs の UPSTREAM_LEGACY_ROUTES が持つ。
//
// 例:
//   export const FORK_LEGACY_ROUTES: LegacyRouteEntry[] = [
//     { dir: "src/app/(user)/(protected)/play", reason: "2026-11 のガチャ改修で移行予定" },
//   ];
//
// 詳細: src/lib/screens/README.md(「未移行ルートの扱い」)

import type { LegacyRouteEntry } from "@/lib/screens/types";

export const FORK_LEGACY_ROUTES: LegacyRouteEntry[] = [];
