// scripts/workflow/notices/freshOutputs.mjs
// push の前に生成物が source と合っているかを、生成器を回して確かめる(/sluice の手順 7・WORKTREE ROUTE・COMMITTED RANGE で毎回)。
// 生成器は作業で検査ではない(core/notices.md checks_in_ship): `pnpm generate --phase=ship` を回し、追跡しているファイルが変われば
// 古い生成物が push されるところだった = 止める(書いた物は作業ツリーに残す。呼び手はそれを commit してから push する)。
// 守る物: 区切りで止まった fork が古い生成物を取ること(order 20261119-111917-district-map-stale-at-ship、D401)。
// 書いた手順(QUICK SHIP の生成器)だけでは止める道具が無く、速い出荷や道具の commit の後に古い地図が出ていった。
//
// 実行: pnpm workflow notices freshOutputs [--onto=<push 先>]
//   --onto = 範囲を `--range=<onto>...HEAD` にする(既定は段階の watch の範囲: 比べる枝との分岐点から HEAD まで + 作業ツリー)
//   exit 0 = 生成物は新しい(何も変わらない) | 1 = 変わったファイルを 1 行ずつ出す(作業ツリーに残す) | 2 = 回せない(作業ツリーが汚れている・生成器が落ちた)
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/** git status --porcelain の行 → パス(改名は先) */
export function changedPaths(porcelain) {
  return porcelain
    .split("\n")
    .filter((line) => line.length > 3)
    .map((line) => line.slice(3).replace(/^.* -> /, ""));
}

const status = (repo) => execFileSync("git", ["-c", "core.quotePath=false", "status", "--porcelain", "--untracked-files=all"], { cwd: repo, encoding: "utf8" });

/** 既定の生成: pnpm generate --phase=ship(出力は stderr へ) */
function runGenerate(repo, onto) {
  const args = ["-s", "generate", "--phase=ship", ...(onto ? [`--range=${onto}...HEAD`] : [])];
  const r = spawnSync("pnpm", args, { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (r.stdout) process.stderr.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  return r.status ?? 1;
}

/**
 * @param {string} repo
 * @param {{ onto?: string | null, generate?: (repo: string, onto: string | null) => number }} [options] generate = テスト用の差し替え
 * @returns {{ code: 0 | 1 | 2, files: string[], reason?: string }}
 */
export function freshOutputs(repo, { onto = null, generate = runGenerate } = {}) {
  if (status(repo).trim() !== "") return { code: 2, files: [], reason: "作業ツリーに変更がある(commit してから回す: どれが生成器の書いた物か分けられない)" };
  const rc = generate(repo, onto);
  if (rc !== 0) return { code: 2, files: changedPaths(status(repo)), reason: `生成器が落ちた(pnpm generate --phase=ship exit ${rc})` };
  const files = changedPaths(status(repo));
  return files.length > 0 ? { code: 1, files } : { code: 0, files: [] };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ontoArg = process.argv.slice(2).find((a) => a.startsWith("--onto="));
  const unknown = process.argv.slice(2).filter((a) => a !== "--" && !a.startsWith("--onto="));
  if (unknown.length > 0) {
    console.error(`freshOutputs: 知らない引数 ${unknown.join(" ")}(使い方: pnpm workflow notices freshOutputs [--onto=<push 先>])`);
    process.exit(2);
  }
  const result = freshOutputs(process.cwd(), { onto: ontoArg ? ontoArg.slice("--onto=".length) : null });
  if (result.code === 0) console.log("freshOutputs: 生成物は新しい(生成器を回して変わったファイル 0)");
  else if (result.code === 1) {
    console.log("freshOutputs: 生成物が古い(生成器が書き直した。commit してから push する):");
    for (const f of result.files) console.log(`  ${f}`);
  } else console.error(`freshOutputs: 回せない: ${result.reason}${result.files.length ? `(変わったファイル: ${result.files.join(", ")})` : ""}`);
  process.exit(result.code);
}
