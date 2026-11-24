#!/usr/bin/env node
// scripts/structure/extensions/generate.mjs
// 全拡張点の生成一覧(<持ち主>/extensions/<点>.ts・src/wiring/<lib>.ts)を宣言と項目から丸ごと書く(pnpm generate extensions)。
// 問題があれば書き出さずに止まる(問題が選ぶ点の物だけなら、ほかの一覧は書いて選ぶ点の生成物を残し、止まる)。宣言が消えた古い一覧(目印のヘッダを持つ)は消す。
// 手で置いたファイルは消さずに失敗を出す。本体は ./extensions.mjs の writeExtensions。書式と失敗の条件: ./README.md

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { writeExtensions } from "./extensions.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const result = writeExtensions(repoRoot);
for (const line of result.warn) console.warn(line);
for (const line of result.out) console.log(line);
for (const line of result.err) console.error(line);
process.exitCode = result.code;
