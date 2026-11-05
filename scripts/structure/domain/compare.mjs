#!/usr/bin/env node
// dc:compare: fork がドメインごとに generate を true / false に決めるための比較（読み取りだけ。本体は cli/compare/）。
//   pnpm dc:compare                     # 全 business ドメイン。base = upstream の remote との merge-base
//   pnpm dc:compare <Domain>... --detail  # 名指しのドメインをファイルごとに
//   pnpm dc:compare --base <ref> --json <file>
import { getCliArgs } from "./cli/args.mjs";
import { runCompare } from "./cli/compare/run.mjs";
import { runCli } from "./cli/run.mjs";

runCli(() => runCompare(getCliArgs()));
