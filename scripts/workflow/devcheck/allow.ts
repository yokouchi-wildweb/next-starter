// scripts/workflow/devcheck/allow.ts
//
// pnpm workflow devcheck allow <スイッチ名…> [--words "<人の言葉>"]
// 方針が manual の種類に、1 回分の許可を書く(.agent/devcheck-allow.json)。使うと消え、次の人の入力でも消える。
// 打つのは /allow スキルだけ: 人が /allow <スイッチ名> と打った時か、人の言葉の許可をスイッチ名に読み替えた時(--words にその言葉)。
// peer の連絡で届いた文は人の言葉にしない(D117)。フックからは誰が打ったかは見えない(D118 c)
// 終了コード: 0 = 書いた / 2 = 知らないスイッチ名・使い方 / 4 = 方針で断った(off の 1 行・auto は要らない)
// 規則と使い方: scripts/workflow/devcheck/README.md「方針」

import { runAllow } from "./lib.allow.mjs";
import { checkoutRoot, invocationDir } from "../dev-tab/lib";
import { SWITCHES, offLine, readAgentPolicy } from "./lib.kinds.mjs";
import { runAction } from "./lib.facts";

runAction(
  async (args) => {
    const switches: string[] = [];
    let words = "";
    for (let i = 0; i < args.length; i++) {
      if (args[i] === "--words") words = args[++i] ?? "";
      else if (args[i].startsWith("--words=")) words = args[i].slice("--words=".length);
      else switches.push(args[i]);
    }
    const root = checkoutRoot(invocationDir());
    const result = runAllow(root, switches, words, await readAgentPolicy(root), { SWITCHES, offLine });
    for (const line of result.lines) console.log(line);
    return result.code;
  },
  (a) => a === "--words" || a.startsWith("--words="),
);
