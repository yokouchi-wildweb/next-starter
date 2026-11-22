// scripts/structure/proxies/testGate.mjs — 門番のテストを段階で回す段(当議会 D133、check.ts が呼ぶ。段階 ship だけ、build では回さない D294)
//
// FEATURE_GATE_CHECK=all で src/featureGate と scripts/structure/proxies のテストを pnpm test の runner で回し、
// 落ちたテストを「違反」と「環境の依存の不足」(DB・Firebase の未設定、モジュールが見つからない)に分けて返す。
// どちらも段階を止める(exit 1、黙って飛ばさない)。分けるのは直す所が違うから: 違反 = 門番の規則・住所・コード、
// 環境 = テストが外の物に頼っている(門番のテストは env なしで通る前提。依存を外すのが直し方)。

import { spawnSync } from "node:child_process";
import path from "node:path";

export const GATE_TEST_TARGETS = ["src/featureGate", "scripts/structure/proxies"];

/** 環境の依存の不足に当たる印(落ちたテストの説明のどこかにあれば環境の側) */
export const ENV_MARKERS = [
  /DatabaseNotConfiguredError/,
  /FirebaseNotConfiguredError/,
  /ERR_MODULE_NOT_FOUND/,
  /MODULE_NOT_FOUND/,
  /Cannot find (module|package)/,
];

/**
 * node:test の spec の出力から落ちたテストを拾い、違反と環境に分ける。
 * 落ちたテストの一覧(「✖ failing tests:」の後、「test at <場所>」で始まる塊)を読む。
 * @returns {{ violations: { at: string, name: string }[], environment: { at: string, name: string, reason: string }[] }}
 */
export function classifyFailures(output) {
  const lines = output.split("\n");
  const start = lines.findIndex((line) => line.trim() === "✖ failing tests:");
  const result = { violations: [], environment: [] };
  if (start < 0) return result;
  let block = null;
  const flush = () => {
    if (!block) return;
    const body = block.lines.join("\n");
    const name = (block.lines.find((line) => line.startsWith("✖ ")) ?? "✖ (名前なし)").slice(2).replace(/ \([\d.]+m?s\)$/, "");
    const marker = ENV_MARKERS.find((re) => re.test(body));
    if (marker) result.environment.push({ at: block.at, name, reason: body.match(marker)[0] });
    else result.violations.push({ at: block.at, name });
    block = null;
  };
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("test at ")) {
      flush();
      block = { at: line.slice("test at ".length).trim(), lines: [] };
    } else if (block) block.lines.push(line);
  }
  flush();
  return result;
}

/** 門番のテストを回す。ok = 全部通った、落ちたら違反と環境に分けた結果(通ったときは空)と出力の要約 */
export function runGateTests(repoRoot) {
  const run = spawnSync(process.execPath, [path.join(repoRoot, "scripts/runner/test/run.mjs"), ...GATE_TEST_TARGETS], {
    cwd: repoRoot,
    env: { ...process.env, FEATURE_GATE_CHECK: "all" },
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${run.stdout ?? ""}\n${run.stderr ?? ""}`;
  const summary = output.split("\n").filter((line) => /^ℹ (tests|pass|fail) /.test(line));
  if (run.status === 0) return { ok: true, summary, violations: [], environment: [], status: 0 };
  return { ok: false, summary, ...classifyFailures(output), status: run.status };
}
