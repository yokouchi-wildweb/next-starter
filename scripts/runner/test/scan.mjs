// scripts/runner/test/scan.mjs — テストのファイルの走査・群・ファイルごとの node のフラグ(pnpm test の部品)
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const TEST_FILE = /\.test\.(ts|tsx|mts|mjs|js|cjs)$/;
/** 入口が回さない物: 動いているアプリを外から見る物(tests/e2e、playwright = pnpm e2e)・型のテスト(typecheck が見る) */
export const EXCLUDED = [/^tests\/e2e\//, /\.types\.test\.[a-z]+$/, /(^|\/)node_modules\//];
/** 名指しの時だけ回す物: 別のプログラム(servers/。pnpm test servers/room のようにその下のパスを引数に書いた時だけ) */
export const NAMED_ONLY = /^servers\//;
export const GROUPS = ["unit", "fork", "db"];
/** // test-flags: で宣言してよい node のフラグ(入口が常に付ける --import 下駄・--experimental-test-module-mocks は書かない)。足すのは上流 */
export const ALLOWED_FLAGS = [];

/** 群: db = *.db.test.*(DB に届く)/ fork = tests/ の下(fork のテスト、D55)/ unit = それ以外 */
export function groupOf(file) {
  if (/\.db\.test\.[a-z]+$/.test(file)) return "db";
  if (file.startsWith("tests/")) return "fork";
  return "unit";
}

/** リポジトリのテストのファイル(追跡 + 未追跡で無視されない物、名前順) */
export function listTestFiles(repo, { namedOnly = false } = {}) {
  const r = spawnSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { cwd: repo, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`git ls-files が読めない: ${r.stderr.trim()}`);
  return [...new Set(r.stdout.split("\n").filter((f) => TEST_FILE.test(f) && !EXCLUDED.some((re) => re.test(f)) && (namedOnly || !NAMED_ONLY.test(f))))].sort();
}

/** ファイルの先頭行の // test-flags: <flags>(無ければ [])。許可の一覧に無いフラグは { problem } */
export function flagsOf(text, allowed = ALLOWED_FLAGS) {
  const first = text.split("\n", 1)[0];
  const m = /^\/\/\s*test-flags:\s*(.*)$/.exec(first);
  if (!m) return { flags: [] };
  const flags = m[1].trim().split(/\s+/).filter(Boolean);
  const unknown = flags.filter((f) => !allowed.includes(f.split("=")[0]));
  if (unknown.length) return { flags, problem: `許可されていないフラグ ${unknown.join(" ")}(許可: ${allowed.join(" ") || "なし"}。足すのは上流: scripts/runner/test/scan.mjs の ALLOWED_FLAGS)` };
  return { flags };
}

export const readFlags = (repo, file) => flagsOf(readFileSync(join(repo, file), "utf8"));
