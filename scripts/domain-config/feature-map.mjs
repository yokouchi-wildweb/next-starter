#!/usr/bin/env node
// dc:feature-map: ドメインの一覧 src/features/feature-map.txt を書き出す（本体は cli/featureMap.mjs）。
//   pnpm dc:feature-map           # 書き出す（dc:generate も書き込みの最後に書き直す）
//   pnpm dc:feature-map --check   # 今のフォルダ・generate と一致するか（ずれていれば exit 1）
import { runFeatureMap } from "./cli/featureMap.mjs";
import { runCli } from "./cli/run.mjs";
import { createWorkspace } from "./domain/workspace.mjs";

runCli(() => runFeatureMap(createWorkspace(), { check: process.argv.slice(2).includes("--check") }));
