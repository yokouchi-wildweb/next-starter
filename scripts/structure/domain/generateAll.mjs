// scripts/structure/domain/generateAll.mjs — 段階の入口(pnpm generate domain [-- <引数>]): 引数で動作を選ぶ
//   引数なし / 旗だけ   = 全ドメインを生成(index.mjs --generate --all <旗>。例: -- --dry-run、-- --only registry)
//   <Domain> [<旗>]     = そのドメインを生成(index.mjs --generate <Domain> <旗>。例: -- Sample --dry-run、-- Sample -i)
//   --delete <Domain> --confirm <snake_name> = 生成物を消す(index.mjs --delete)
//   --unmark [<Domain>] = generate: false のドメインから生成物の印を外す(index.mjs --unmark、D222)
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2).filter((a) => a !== "--");
let argv;
if (args.includes("--delete") || args.includes("--unmark")) argv = [join(here, "index.mjs"), ...args];
else if (args.length && !args[0].startsWith("-")) argv = [join(here, "index.mjs"), "--generate", ...args];
else argv = [join(here, "index.mjs"), "--generate", ...(args.includes("--all") ? [] : ["--all"]), ...args];
const r = spawnSync(process.execPath, argv, { stdio: "inherit" });
process.exitCode = r.status ?? 1; // process.exit は cli/ だけ(tests/structure.test.mjs)
