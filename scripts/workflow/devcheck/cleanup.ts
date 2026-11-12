// scripts/workflow/devcheck/cleanup.ts
//
// pnpm workflow devcheck cleanup — この命令が作った DB の行を消し、立てたサーバーを止め、記録 .agent/devcheck.json を消す。
// 計画の最後にいつも置く片付け。画面から作った行はこの命令では分からない(残した行として報告に書く)
// 終了コード: 0 = 片付けた(片付けるもの無しも)/ 1 = 消せない・止められない物が残った(記録に残す)
// 規則と使い方: scripts/workflow/devcheck/README.md

import { execCleanup } from "./lib.exec";
import { loadSetup, realDeps, runAction } from "./lib.facts";

runAction(async () => execCleanup(realDeps(loadSetup())).code, () => false);
