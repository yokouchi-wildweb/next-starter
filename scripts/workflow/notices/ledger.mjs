// scripts/workflow/notices/ledger.mjs
// 自分の適用台帳 .notices/applied/<repo_id>.md に /flux の行を足す道具(台帳の行の書き方はここだけ。手で足さない)。
// /flux が区間の commit の前(手順 7a)・緊急修正 / 先に取れる修正の pick の後に走らせる。
//
// 実行: pnpm workflow notices ledger --upstream=<rev> (--id=<notice id> [--id=…] | --tail) [--commit=<sha | ->]
//         [--relay=<none | 中継 notice の id>] [--picked=<rev>] [--notes=<text>] [--dry-run]
//   --upstream = その区間の merge 先(pick は git merge-base HEAD <upstream>/<branch>)。完全な sha にして書く
//   --id = 区間の notice の id。1 つにつき 1 行(同じ欄で)
//   --tail = notice の無い末尾の区間(merge だけ): 1 行 `id:tail-<merge 先の sha の頭 9 桁>`。台帳の最後の upstream: が
//     もう merge 先なら(手で足した末尾の行など)何も書かない。deployVerdict は台帳の最後の upstream: だけを読むので、
//     親のセーフポイントが区切りの外の出発の merge にあっても、この行で `at` と読める
//   --relay = 下流を持つ fork(tier root / middle)だけが書く欄で、そのとき要る(--tail は none 固定)。leaf は渡さない
//   --picked = 先取りした元の commit(完全な sha にして picked: に書く)
//   --notes = 欄 notes:(既定 -)。改行・`|` は使えない
//   行の形: - id:<id> | date:<ISO8601> | commit:<sha | -> | upstream:<完全な sha> [| picked:<完全な sha>] [| relay:<…>] | notes:<…>
//   台帳が無ければ見出し `# APPLIED LEDGER fork:<origin の url>` で作る
//   書く台帳 = cwd の git のリポ(道具の置き場ではない)
//   exit 0 = 書いた / 書く物が無い | 2 = 書けない(理由。何も書かない)
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { lastUpstreamSha, readForkIdentity } from "../../../src/lib/forkOwnership/node.mjs";

const tryGit = (repo, args) => {
  try {
    return execFileSync("git", args, { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    return null;
  }
};

const options = (argv, name) => argv.filter((a) => a.startsWith(`--${name}=`)).map((a) => a.slice(name.length + 3));
const option = (argv, name) => options(argv, name).at(-1) ?? null;

/** 台帳の行の id(- id:<id> の行) */
export const ledgerIds = (text) => [...(text ?? "").matchAll(/^- id:(\S+)/gm)].map((m) => m[1]);

/** 末尾の区間の行の id(merge 先の sha の頭 9 桁) */
export const tailId = (sha) => `tail-${sha.slice(0, 9)}`;

/**
 * 足す行を作る(書かない)。{ lines, skip?, path, header? } か、投げる(理由)
 * @param {string} repo
 * @param {string[]} argv
 * @param {{ now?: () => Date }} [deps]
 */
export function planLedger(repo, argv, { now = () => new Date() } = {}) {
  const known = new Set(["upstream", "id", "tail", "commit", "relay", "picked", "notes", "dry-run"]);
  for (const a of argv) {
    const name = a.replace(/^--/, "").split("=")[0];
    if (!a.startsWith("--") || !known.has(name)) throw new Error(`知らない引数 ${a}`);
  }
  const identity = readForkIdentity(repo);
  if (identity.errors.length > 0) throw new Error(identity.errors.join("、"));
  if (!identity.own) throw new Error("repo.json の repo_id が読めない");
  if (identity.isTier1) throw new Error("Tier1 は台帳を持たない(上流が無い)");
  const withRelay = identity.downstream === "yes";
  if (identity.downstream === null) throw new Error(identity.downstreamError ?? "repo.json の tier が読めない");

  const upstreamRev = option(argv, "upstream");
  if (!upstreamRev) throw new Error("--upstream=<rev> が要る(その区間の merge 先)");
  const upstream = tryGit(repo, ["rev-parse", "--verify", "-q", `${upstreamRev}^{commit}`]);
  if (!upstream) throw new Error(`--upstream=${upstreamRev} が commit でない(git fetch の後でもう一度)`);
  const pickedRev = option(argv, "picked");
  const picked = pickedRev === null ? null : tryGit(repo, ["rev-parse", "--verify", "-q", `${pickedRev}^{commit}`]);
  if (pickedRev !== null && !picked) throw new Error(`--picked=${pickedRev} が commit でない`);

  const tail = argv.includes("--tail");
  const ids = options(argv, "id");
  if (tail && ids.length > 0) throw new Error("--tail と --id は一緒に使えない(notice のある末尾の区間は --id だけ)");
  if (!tail && ids.length === 0) throw new Error("--id=<notice id> か --tail が要る");
  if (tail && picked) throw new Error("--tail と --picked は一緒に使えない");

  let relay = option(argv, "relay");
  if (withRelay && tail) relay = relay ?? "none";
  if (withRelay && relay === null) throw new Error("下流を持つ fork は --relay=<none | 中継 notice の id> が要る");
  if (!withRelay && relay !== null) throw new Error("leaf の fork は relay: を書かない(--relay を外す)");
  if (withRelay && tail && relay !== "none") throw new Error("末尾の区間の行は relay:none だけ");

  const commit = option(argv, "commit") ?? "-";
  const notes = option(argv, "notes") ?? "-";
  for (const [name, value] of [["commit", commit], ["relay", relay ?? ""], ["notes", notes], ...ids.map((id) => ["id", id])]) {
    if (/[|\n\r]/.test(value)) throw new Error(`--${name} に改行・| は使えない`);
  }
  for (const id of ids) if (!/^\S+$/.test(id)) throw new Error(`--id=${id} に空白は使えない`);

  const path = join(".notices/applied", `${identity.own}.md`);
  const abs = join(repo, path);
  const text = existsSync(abs) ? readFileSync(abs, "utf8") : null;
  if (tail && text !== null && lastUpstreamSha(text) && upstream.startsWith(lastUpstreamSha(text) ?? "")) {
    return { path, lines: [], skip: `台帳の最後の upstream: がもう ${upstream.slice(0, 9)}(末尾の行は書いてある)` };
  }
  const lineIds = tail ? [tailId(upstream)] : ids;
  const recorded = new Set(ledgerIds(text));
  const dup = lineIds.filter((id) => recorded.has(id));
  if (dup.length > 0) throw new Error(`もう台帳にある id: ${dup.join(", ")}(過去の行は書き換えない)`);
  if (new Set(lineIds).size !== lineIds.length) throw new Error("同じ --id が 2 回ある");

  const date = now().toISOString().replace(/\.\d{3}Z$/, "Z");
  const lines = lineIds.map(
    (id) =>
      `- id:${id} | date:${date} | commit:${commit} | upstream:${upstream}${picked ? ` | picked:${picked}` : ""}${withRelay ? ` | relay:${relay}` : ""} | notes:${notes}`,
  );
  const header = text === null ? `# APPLIED LEDGER fork:${tryGit(repo, ["remote", "get-url", "origin"]) ?? "-"}` : null;
  return { path, lines, header };
}

/**
 * @param {string} repo
 * @param {string[]} argv
 * @param {(line: string) => void} [log]
 * @param {{ now?: () => Date }} [deps]
 */
export function run(repo, argv, log = console.log, deps = {}) {
  let plan;
  try {
    plan = planLedger(repo, argv, deps);
  } catch (e) {
    log(`ledger: 書けない — ${e.message}`);
    return 2;
  }
  if (plan.skip) {
    log(`ledger: 書く物なし — ${plan.skip}`);
    return 0;
  }
  const dryRun = argv.includes("--dry-run");
  for (const line of plan.lines) log(`ledger: ${plan.path}: ${line}${dryRun ? "(--dry-run)" : ""}`);
  if (dryRun) return 0;
  const abs = join(repo, plan.path);
  const before = plan.header === null ? readFileSync(abs, "utf8") : `${plan.header}\n`;
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, `${before}${before.endsWith("\n") ? "" : "\n"}${plan.lines.join("\n")}\n`);
  return 0;
}

// 書く台帳 = cwd の git のリポ(/flux は上流の先端の道具を fork の cwd で走らせる: .claude/skills/flux/tip.mjs)
function main(argv) {
  const repo = tryGit(process.cwd(), ["rev-parse", "--show-toplevel"]);
  if (!repo) {
    console.log("ledger: 書けない — cwd が git のリポでない");
    return 2;
  }
  return run(repo, argv);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = main(process.argv.slice(2));
