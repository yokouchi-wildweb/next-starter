// scripts/structure/role/generateAll.mjs — 門の入口(pnpm generate role [-- <引数>]): 引数で動作を選ぶ
//   引数なし / --all             = 全ロール・プロフィールの生成物を作り直す(generate.mjs --all)
//   <roleId>                     = そのロールを生成(generate.mjs <roleId>)
//   --delete <roleId> [<旗>]     = ロールを消す(deleteRole.mjs。--confirm <id>・--keep-generated・--remove-json・-i)
//   --toggle <roleId> [--on|--off] = ロールの有効・無効(toggleRole.mjs)
//   --profile <name> | --profile --all = プロフィールを生成(generateProfile.mjs)
//   --delete-profile <name> [<旗>] = プロフィールを消す(deleteProfile.mjs)
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2).filter((a) => a !== "--");
const ACTIONS = { "--delete": "deleteRole.mjs", "--toggle": "toggleRole.mjs", "--profile": "generateProfile.mjs", "--delete-profile": "deleteProfile.mjs" };
const action = args.find((a) => a in ACTIONS);
let argv;
if (action) argv = [join(here, ACTIONS[action]), ...args.filter((a) => a !== action)];
else if (args.length && !args[0].startsWith("-")) argv = [join(here, "generate.mjs"), ...args];
else if (args.length && args.some((a) => a !== "--all")) {
  console.error(`知らない引数です: ${args.join(" ")}(使い方: pnpm generate role [-- <roleId> | --delete <id> | --toggle <id> | --profile <name> | --delete-profile <name>])`);
  process.exit(2);
} else argv = [join(here, "generate.mjs"), "--all"];
const r = spawnSync(process.execPath, argv, { stdio: "inherit" });
process.exitCode = r.status ?? 1;
