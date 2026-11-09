// pnpm workflow ownership who <path...> — パスごとの持ち主・できること・根拠(読むだけ)。終了コード: 0 = 答えた / 2 = 未検証・引数の誤り
// 引数: --parent=<remote> --branch=<branch> --no-fetch --json。仕様: ./README.md「持ち主を調べる(pnpm workflow ownership who)」

import { relative, resolve, sep } from "node:path";

import { whoOwns } from "./who.mjs";

const OWNER_LABELS = {
  tier1: "Tier1",
  middle: "中間 Tier",
  fork: "この fork",
  generated: "生成物",
  missing: "なし(基準にも HEAD にも無い)",
};

const TIER_LABELS = { tier1: "Tier1 の物", middle: "中間 Tier の物", fork: "この fork の物" };

/** 型(fork がこのパスを変えたいときにすること) */
const TYPE_LABELS = {
  1: "型 1 丸ごと置き換え",
  2: "型 2 重ね(一部の上書き)",
  3: "型 3 受け口に足す",
  4: "型 4 置き場",
  generated: "生成物(作り直す)",
  own: "自分の物(そのまま書き換える)",
  none: "変えられない(依頼する)",
};

function parseArgs(argv) {
  const options = { json: false, fetch: true, paths: [] };
  for (const arg of argv) {
    if (arg === "--json") options.json = true;
    else if (arg === "--no-fetch") options.fetch = false;
    else if (arg.startsWith("--parent=")) options.parent = arg.slice("--parent=".length);
    else if (arg.startsWith("--branch=")) options.branch = arg.slice("--branch=".length);
    else if (arg.startsWith("--")) throw new Error(`不明な引数: ${arg}`);
    else options.paths.push(arg);
  }
  if (options.paths.length === 0) throw new Error("使い方: pnpm workflow ownership who <path...> [--json] [--no-fetch] [--parent=<remote>] [--branch=<branch>]");
  return options;
}

const toRepoPath = (repoRoot, arg) => relative(repoRoot, resolve(repoRoot, arg)).split(sep).join("/");

function ownerLine(owner) {
  const label = owner.kind === "middle" && owner.forkId ? `中間 Tier ${owner.forkId}` : OWNER_LABELS[owner.kind];
  if (owner.kind !== "generated") return label;
  const tier = owner.tier === "middle" && owner.forkId ? `中間 Tier ${owner.forkId} の物` : TIER_LABELS[owner.tier];
  return `${label}(${tier})`;
}

function printResult(result) {
  const lines = [result.path];
  lines.push(`  持ち主: ${ownerLine(result.owner)}`);
  if (result.type) {
    lines.push(`  型: ${TYPE_LABELS[result.type] ?? result.type}${result.how ? ` — ${result.how}` : ""}`);
    if (result.write) lines.push(`  置くファイル: ${result.write}`);
    if (result.keys) lines.push(`  鍵: ${result.keys.join(", ")}`);
    if (result.source) lines.push(`  元: ${result.source}`);
    if (result.order) lines.push(`  依頼: ${result.order}`);
  }
  // できる / できない = このファイル自体を書き換える・足すこと(型の答えがあるときは、そう分かるように名乗る)。
  // 型が 1-4 / generated / own なら変え方は上の型にあるので、このファイル自体の「受け口が無い → /order」は出さない(--json は同じ)
  const self = result.type ? "このファイル自体: " : "";
  for (const item of result.allowed) {
    if (item.action === "none" && result.type && result.type !== "none") lines.push(`  ${self}書き換えない(変え方は上の型)`);
    else lines.push(`  ${self}できる: ${item.action} — ${item.how}`);
  }
  for (const item of result.blocked) lines.push(`  ${self}できない: ${item.action}(${item.reason})`);
  const { evidence } = result;
  const where = [`基準に${evidence.inBase ? "ある" : "無い"}`, `Tier1 の版に${evidence.inTier1 ? "ある" : "無い"}`, `HEAD に${evidence.inHead ? "ある" : "無い"}`];
  lines.push(`  根拠: ${where.join(" / ")}`);
  lines.push(
    evidence.intake
      ? `  受け口: intake.txt ${evidence.intake.line} 行目 \`${evidence.intake.kind} ${evidence.intake.glob}\`${evidence.intake.note ? ` # ${evidence.intake.note}` : ""}`
      : "  受け口: 当たる行なし",
  );
  if (evidence.current) {
    const path = evidence.current.from ? `${evidence.current.from} → ` : "";
    lines.push(`  今の差分: ${path}${evidence.current.status} ${evidence.current.reason}(${evidence.current.verdict === "violation" ? "違反" : "合格"})`);
    if (evidence.current.permitDraft) lines.push(`    許可の下書き: ${evidence.current.permitDraft}`);
  } else if (evidence.inBase || evidence.inHead) {
    lines.push("  今の差分: なし");
  }
  if (evidence.permit) lines.push(`  一時許可: ${evidence.permit.line} 行目 upreq:${evidence.permit.upreqs.join(",")}(${evidence.permit.state})`);
  return lines;
}

function print(answer) {
  const lines = [];
  if (answer.status === "unverified") {
    lines.push(`未検証: ${answer.reason}`);
    if (answer.base) lines.push(`基準: ${answer.remote}/${answer.branch} ${answer.base.slice(0, 10)}`);
    for (const id of answer.unrecorded ?? []) lines.push(`  台帳に無い: ${id}`);
    for (const error of answer.errors ?? []) lines.push(`  ${error.line} 行目: ${error.message}`);
    return lines;
  }
  if (answer.status === "tier1") {
    lines.push(`このリポ = Tier1(${answer.ownerId}): どのファイルも自分の物で、自由に編集できる。以下は直接の fork から見た答え(基準 = HEAD)`);
  } else {
    lines.push(`基準: ${answer.remote}/${answer.branch} ${answer.base.slice(0, 10)}(fork: ${answer.ownerId})`);
    const via = answer.tier1.chain.map((step) => `${step.name}@${step.sha.slice(0, 10)}`).join(" → ");
    lines.push(`Tier1 の版: ${answer.tier1.sha.slice(0, 10)}${via ? `(${via} からたどった)` : ""}`);
  }
  for (const result of answer.results) lines.push("", ...printResult(result));
  return lines;
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
  const repoRoot = process.cwd();
  const answer = whoOwns(
    repoRoot,
    options.paths.map((arg) => toRepoPath(repoRoot, arg)),
    { parent: options.parent, branch: options.branch, fetch: options.fetch },
  );
  console.log(options.json ? JSON.stringify(answer, null, 2) : print(answer).join("\n"));
  process.exit(answer.status === "unverified" ? 2 : 0);
}

main();
