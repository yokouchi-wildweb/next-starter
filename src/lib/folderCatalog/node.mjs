// src/lib/folderCatalog/node.mjs
// 入口 "./node": 目録(CATALOG.md)の読み手と検査(node:fs で今の木を読む。読み手は eslint.config・テスト・道具 = Next の外)。
// 画面から読む物は無いので入口 "." は置かない。中身: ./README.md

export * from "./catalog.mjs";
