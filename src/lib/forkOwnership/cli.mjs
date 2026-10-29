// pnpm ownership:check — fork の所有の検査。終了コード: 0 = 合格(Tier1 は対象外)/ 1 = 違反あり / 2 = 未検証・設定の不足
// 引数: --parent=<remote> --branch=<branch> --json --verbose。仕様: ./README.md「使い方」

import { runCheck } from "./check.mjs";

const EXIT = { pass: 0, tier1: 0, fail: 1, unverified: 2 };

const LABELS = {
  added: "fork が足したファイル",
  intake: "受け口の中の書き換え",
  region: "fork の区画の中だけ",
  marker: "印より下だけ",
  append: "追記だけ",
  generated: "生成物",
  "generator-region": "生成器の区画の中だけ",
  permitted: "一時許可で合格",
  deleted: "削除",
  renamed: "rename・移動",
  "ancestor-lib-add": "祖先の lib の中への追加",
  "outside-intake": "受け口の外の書き換え",
  "outside-region": "fork の区画の外の書き換え",
  "region-markers": "fork の区画の印が壊れている",
  "above-marker": "印より上の書き換え",
  "not-append": "基準の中身の書き換え(追記でない)",
  debt: "upstream の負債の箇所(一時許可が要る)",
  "permit-same-as-base": "一時許可の残骸: 基準と同じに戻った",
  "permit-unused": "一時許可の残骸: 違反の無いファイル",
};

const PERMIT_STATES = {
  none: "許可なし",
  refresh: "許可の後に書き換えた(中身を見て許可し直す)",
  "expired-base": "失効: 親がこのファイルに触った(取り込んだ版で見直す)",
  "expired-resolved": "失効: 依頼がすべて解決した(受け口へ移す・元に戻す)",
};

function parseArgs(argv) {
  const options = { json: false, verbose: false };
  for (const arg of argv) {
    if (arg === "--json") options.json = true;
    else if (arg === "--verbose") options.verbose = true;
    else if (arg.startsWith("--parent=")) options.parent = arg.slice("--parent=".length);
    else if (arg.startsWith("--branch=")) options.branch = arg.slice("--branch=".length);
    else throw new Error(`不明な引数: ${arg}`);
  }
  return options;
}

function print(result, { verbose }) {
  const lines = [];
  if (result.status === "tier1") {
    lines.push(`親なし(Tier1: ${result.ownerId}): 対象外`);
    return lines;
  }
  if (result.status === "unverified") {
    lines.push(`未検証: ${result.reason}`);
    if (result.base) lines.push(`基準: ${result.remote}/${result.branch} ${result.base.slice(0, 10)}`);
    for (const id of result.unrecorded ?? []) lines.push(`  台帳に無い: ${id}`);
    for (const error of result.errors ?? []) lines.push(`  ${error.line} 行目: ${error.message}`);
    return lines;
  }

  const violations = result.entries.filter((entry) => entry.verdict === "violation");
  const problems = violations.length + result.leftovers.length + result.permitErrors.length;
  lines.push(result.status === "pass" ? "合格" : `違反 ${problems} 件`);
  lines.push(`基準: ${result.remote}/${result.branch} ${result.base.slice(0, 10)}(fork: ${result.ownerId})`);
  lines.push("");
  lines.push("件数:");
  for (const [key, count] of Object.entries(result.counts).sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`  ${LABELS[key] ?? key}(${key}): ${count}`);
  }

  if (violations.length > 0) {
    lines.push("", "違反(受け口へ移す・元に戻す・一時許可のどれかで片付ける):");
    for (const entry of violations) {
      const path = entry.from ? `${entry.from} → ${entry.path}` : entry.path;
      lines.push(`  [${entry.reason}] ${path}${entry.permit && entry.permit !== "none" ? ` — ${PERMIT_STATES[entry.permit]}` : ""}`);
      lines.push(`    許可の下書き: ${entry.permitDraft}`);
    }
  }
  if (result.leftovers.length > 0) {
    lines.push("", `一時許可の残骸(${result.permitFile} から行を消す):`);
    for (const leftover of result.leftovers) lines.push(`  [${leftover.reason}] ${leftover.line} 行目 ${leftover.path}`);
  }
  if (result.permitErrors.length > 0) {
    lines.push("", `一時許可の書式の誤り(${result.permitFile}):`);
    for (const error of result.permitErrors) lines.push(`  ${error.line} 行目: ${error.message}`);
  }
  if (verbose) {
    lines.push("", "合格:");
    for (const entry of result.entries.filter((item) => item.verdict !== "violation")) {
      lines.push(`  [${entry.verdict === "permitted" ? "permitted" : entry.reason}] ${entry.path}`);
    }
  }
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
  const result = runCheck(process.cwd(), options);
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(print(result, options).join("\n"));
  }
  process.exit(EXIT[result.status]);
}

main();
