// src/lib/screens/node.mjs
// 入口 "./node": 画面の構造の検査の部品(Next の外のプログラム = 道具・検査・テストが読む。React と Next を読まない)。
// - checks.mjs: 字面の検査関数(副作用なし。fork が独自の検査を書くときもここから読む)
// - routeTree.mjs: src/app 全体のページの発見(listAppFiles は node:fs で読む)
// - routeMap.mjs / routeMapView.mjs: ルート地図の生成と見る側
// 型と設定は入口 "."(./index.ts)

export * from "./checks.mjs";
export * from "./routeTree.mjs";
export * from "./routeMap.mjs";
export * from "./routeMapView.mjs";
