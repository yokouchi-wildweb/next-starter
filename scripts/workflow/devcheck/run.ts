// scripts/workflow/devcheck/run.ts
//
// pnpm workflow devcheck run <候補の名前> [引数…] [--manual-go]
//   server | login | test <path> | check <target> | db-write "<INSERT … RETURNING 列>" | db-delete "<DELETE … WHERE …>" | env-add <鍵>(値は標準入力) | <fork の項目>
// 1 回に候補 1 つ。方針 off = 断る(手で、exit 4)、manual = --manual-go の時だけ。作った物はこの命令の記録へ(片付けは cleanup)
// 終了コード: 打ったコマンドのもの / 1 = 失敗・使い方 / 2 = 方針・項目・文脈が読めない・断った文 / 3 = サーバーの上限で待ちきれない / 4 = 方針で断った
// 規則と使い方: scripts/workflow/devcheck/README.md

import { execRun } from "./lib.exec";
import { loadSetup, realDeps, runAction } from "./lib.facts";

runAction(async (args) => (await execRun(args, realDeps(loadSetup()))).code, (a) => a === "--manual-go");
