// src/registry/screenRoutesRegistry.ts
// `pnpm test:screens` の fork 所有の設定(構造の検査の除外と例外リスト)。
//
// test:screens は src/app 全体のページ(_ で始まるディレクトリと src/app/api を除く。fork の独自エリアも含む)を
// 自動検出し、全てが「1 行スイッチ(+ _screen/ または _components/ の Screen)」であることを検査する。
// 新しいページを作るときも、新しいエリアを作るときも登録は不要。
// upstream は全て空で出荷し、以後このファイルの中身を編集しない(src/styles 直下の fork の CSS と同じ扱い。export の追加だけは
// .notices で告知して行う。fork は merge 時に自分の値を残しつつ新しい export を取り込む)。
//
// FORK_SCAN_ROOTS: 廃止(src/app 全体を走査するようになった)。export は互換のため残す。行が残っているとテストが
//   「登録不要。行を外す」で失敗する。
// FORK_SCAN_EXCLUDES: 構造の検査から外すディレクトリとその配下(repo 相対の src/app/...)。upstream の SCAN_EXCLUDES と同じ意味。
//   _ で始まるディレクトリは元から走査されないので書かなくてよい。除外してもルート地図(src/app/route-map.jsonl)には載る。
//   存在しない登録・重複・他の除外の中にある登録は失敗する(一覧の鮮度)。
// FORK_LEGACY_ROUTES: まだ移行していないルートだけを理由付きで書く(黙って古いままにはできない)。
//   移行が済んだらその行を外す(残っているとテストが「除外リストから外す」と指摘する)。
//   upstream 自身の未移行ルートは src/lib/screens/screens.test.mjs の UPSTREAM_LEGACY_ROUTES が持つ。
//
// 例:
//   export const FORK_SCAN_EXCLUDES: string[] = ["src/app/lab"];
//   export const FORK_LEGACY_ROUTES: LegacyRouteEntry[] = [
//     { dir: "src/app/(user)/(protected)/play", reason: "2026-11 のガチャ改修で移行予定" },
//   ];
//
// 詳細: src/lib/screens/README.md(§9「仕組みによる保護」、§10「未移行ルートの扱い」、§13「ルート地図」)

import type { LegacyRouteEntry } from "@/lib/screens/types";

export const FORK_SCAN_ROOTS: string[] = [];

// --- fork entries start (upstream never edits inside) ---
export const FORK_SCAN_EXCLUDES: string[] = [];

export const FORK_LEGACY_ROUTES: LegacyRouteEntry[] = [];
// --- fork entries end ---
