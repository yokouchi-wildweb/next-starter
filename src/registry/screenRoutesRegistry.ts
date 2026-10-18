// src/registry/screenRoutesRegistry.ts
// `pnpm test:screens` の fork 所有の設定(走査範囲の追加と例外リスト)。
//
// test:screens は src/app/(user)/** と (marketing)/**、dc:generate の管理画面ルートの page.tsx を
// 自動検出し、全てが「1 行スイッチ(+ _screen/ または _components/ の Screen)」であることを検査する。
// 新しいページを作るときに登録は不要(page.tsx 1 行 + _screen/<Name>Screen.tsx を置くだけで検査対象になる)。
// upstream は全て空で出荷し、以後このファイルの中身を編集しない(src/styles/custom/** と同じ扱い。export の追加だけは
// .notices で告知して行う。fork は merge 時に自分の値を残しつつ新しい export を取り込む)。
//
// FORK_SCAN_ROOTS: fork が src/app に作った独自エリア(store/ や terminal/ 等、upstream の走査範囲の外)を
//   エリア単位で足す(repo 相対ディレクトリ、ページ単位ではない)。登録したエリアの page.tsx は upstream の
//   ルートと同じ検査を受け、FORK_LEGACY_ROUTES も効く。upstream エリアの中に作ったサブディレクトリ
//   (例: src/app/admin/(protected)/floor-tables)も同じ形で登録できる。
//   src/app 直下に page.tsx を含むのに走査範囲にも upstream 既知のエリア(admin / debug / api)にも属さない
//   ディレクトリがあるとテストが失敗し、ここへの 1 行(走査するなら FORK_SCAN_ROOTS、検査しないなら FORK_SCAN_EXCLUDES)を促す。
//   存在しない登録・upstream の走査範囲に既に含まれる登録・upstream のエリア(src/app/admin 等)を丸ごと含む登録・
//   除外の中にある登録は失敗する(一覧の鮮度)。
// FORK_SCAN_EXCLUDES: 走査から外すディレクトリとその配下(repo 相対)。upstream の SCAN_EXCLUDES と同じ意味。
//   _ で始まるディレクトリは元から走査されないので書かなくてよい。
// FORK_LEGACY_ROUTES: まだ移行していないルートだけを理由付きで書く(黙って古いままにはできない)。
//   移行が済んだらその行を外す(残っているとテストが「除外リストから外す」と指摘する)。
//   upstream 自身の未移行ルートは src/lib/screens/screens.test.mjs の UPSTREAM_LEGACY_ROUTES が持つ。
//
// 例:
//   export const FORK_SCAN_ROOTS: string[] = ["src/app/store", "src/app/terminal", "src/app/admin/(protected)/floor-tables"];
//   export const FORK_SCAN_EXCLUDES: string[] = ["src/app/store/legacy"];
//   export const FORK_LEGACY_ROUTES: LegacyRouteEntry[] = [
//     { dir: "src/app/(user)/(protected)/play", reason: "2026-11 のガチャ改修で移行予定" },
//   ];
//
// 詳細: src/lib/screens/README.md(§9「仕組みによる保護」、§10「未移行ルートの扱い」)

import type { LegacyRouteEntry } from "@/lib/screens/types";

export const FORK_SCAN_ROOTS: string[] = [];

export const FORK_SCAN_EXCLUDES: string[] = [];

export const FORK_LEGACY_ROUTES: LegacyRouteEntry[] = [];
