// scripts/claude-rules/coreRules.test.mjs
// CLAUDE.md と .claude/rules/core/*.md(パス指定ルール)の契約テスト。実行: pnpm test:core-rules (node:test)
// ディレクトリの移動・改名で `paths:` がどのファイルにも当たらなくなると、ルールが黙って読み込まれなくなる。それを検出する。
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, matchesGlob } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const coreDir = ".claude/rules/core";
const MAX_CLAUDE_MD_LINES = 200;
const MAX_CLAUDE_MD_LINE_CHARS = 400;

const claudeMd = readFileSync(join(repoRoot, "CLAUDE.md"), "utf8");
const ruleFiles = readdirSync(join(repoRoot, coreDir)).filter((f) => f.endsWith(".md")).sort();
const tracked = execFileSync("git", ["ls-files"], { cwd: repoRoot, encoding: "utf8" }).split("\n").filter(Boolean);

// 先頭の frontmatter から `paths:` の配列を取り出す(`  - "glob"` 形式のみ)
export function parsePaths(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return null;
  const lines = m[1].split("\n");
  const start = lines.indexOf("paths:");
  if (start < 0) return null;
  const paths = [];
  for (const line of lines.slice(start + 1)) {
    const item = line.match(/^\s+-\s+"([^"]+)"\s*$/);
    if (!item) break;
    paths.push(item[1]);
  }
  return paths;
}

// ワイルドカードを含む最初の区切りより前の固定部分(例: "src/features/*/room/**" → "src/features")
export function staticPrefix(pattern) {
  const segs = pattern.split("/");
  const i = segs.findIndex((s) => /[*?[{]/.test(s));
  return i < 0 ? null : segs.slice(0, i).join("/");
}

test(`CLAUDE.md は ${MAX_CLAUDE_MD_LINES} 行未満`, () => {
  const lines = claudeMd.split("\n").length - (claudeMd.endsWith("\n") ? 1 : 0);
  assert.ok(lines < MAX_CLAUDE_MD_LINES, `CLAUDE.md が ${lines} 行です。細部は README か ${coreDir}/ へ移してください`);
});

test(`CLAUDE.md の各行は ${MAX_CLAUDE_MD_LINE_CHARS} 字以内`, () => {
  // FORMAT_RULE: 長い行は sub-bullet に割る(字数は JS の文字列長 = UTF-16 単位で数える)
  const long = claudeMd
    .split("\n")
    .map((text, index) => ({ line: index + 1, length: text.length }))
    .filter((item) => item.length > MAX_CLAUDE_MD_LINE_CHARS);
  assert.deepEqual(long, [], `${MAX_CLAUDE_MD_LINE_CHARS} 字を超える行: ${long.map((item) => `${item.line} 行目(${item.length} 字)`).join(", ")}。sub-bullet に割ってください`);
});

test(`${coreDir}/ のファイルが 1 つ以上ある`, () => {
  assert.ok(ruleFiles.length > 0);
});

for (const file of ruleFiles) {
  test(`${coreDir}/${file}: paths が実在のファイルに当たる`, () => {
    const paths = parsePaths(readFileSync(join(repoRoot, coreDir, file), "utf8"));
    assert.ok(paths && paths.length > 0, "frontmatter に paths: がありません");
    const problems = [];
    for (const p of paths) {
      const prefix = staticPrefix(p);
      if (prefix === null) {
        if (!tracked.includes(p)) problems.push(`${p}: ファイルが存在しません`);
      } else if (prefix !== "" && !existsSync(join(repoRoot, prefix))) {
        problems.push(`${p}: ${prefix} が存在しません(移動・改名?)`);
      }
    }
    assert.deepEqual(problems, [], problems.join("\n"));
    assert.ok(
      tracked.some((f) => paths.some((p) => matchesGlob(f, p))),
      `どの paths も追跡中のファイルに当たりません: ${paths.join(", ")}`,
    );
  });

  test(`${coreDir}/${file}: CLAUDE.md から参照されている`, () => {
    assert.ok(claudeMd.includes(`${coreDir}/${file}`), `CLAUDE.md に ${coreDir}/${file} への案内行がありません`);
  });
}

test(`CLAUDE.md が参照する ${coreDir}/*.md が実在する`, () => {
  const refs = [...claudeMd.matchAll(/\.claude\/rules\/core\/([\w-]+\.md)/g)].map((m) => m[1]);
  const missing = [...new Set(refs)].filter((f) => !ruleFiles.includes(f));
  assert.deepEqual(missing, []);
});

test("staticPrefix / parsePaths の部品", () => {
  assert.equal(staticPrefix("src/features/*/room/**"), "src/features");
  assert.equal(staticPrefix("**/stores/**"), "");
  assert.equal(staticPrefix("src/proxy.ts"), null);
  assert.deepEqual(parsePaths('---\npaths:\n  - "a/**"\n  - "b.ts"\n---\n# x\n'), ["a/**", "b.ts"]);
  assert.equal(parsePaths("# no frontmatter\n"), null);
});
