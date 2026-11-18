// scripts/workflow/rules/coreRules.test.mjs
// CLAUDE.md と .claude/rules/core/*.md(パス指定ルール)の契約テスト。実行: pnpm test scripts/workflow/rules/coreRules.test.mjs (node:test)
// ディレクトリの移動・改名で `paths:` がどのファイルにも当たらなくなると、ルールが黙って読み込まれなくなる。それを検出する。
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, matchesGlob } from "node:path";
import { fileURLToPath } from "node:url";
import { nestedBrace, parsePaths, staticPrefix } from "./lib.rulePaths.mjs";
import { isForkPlace, parseIntakeRows } from "./lib.ruleCoverage.mjs";
import { INTAKE_PATH } from "../../../src/lib/forkOwnership/check.mjs";
import { formatProblems, LINEAGE_FILE, parseLineage } from "../../../src/lib/forkOwnership/lineage.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const coreDir = ".claude/rules/core";

const claudeMd = readFileSync(join(repoRoot, "CLAUDE.md"), "utf8");
const designPath = join(repoRoot, coreDir, "design.md");
const designMd = existsSync(designPath) ? readFileSync(designPath, "utf8") : "";
const ruleFiles = readdirSync(join(repoRoot, coreDir)).filter((f) => f.endsWith(".md")).sort();
const intake = parseIntakeRows(readFileSync(join(repoRoot, INTAKE_PATH), "utf8"));
const tracked = execFileSync("git", ["ls-files"], { cwd: repoRoot, encoding: "utf8" }).split("\n").filter(Boolean);

// 大きさ(字数の線)と 1 行 400 字は size.mjs(lib.ruleSize.mjs)が見る

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
        if (!tracked.includes(p) && !isForkPlace(p, intake)) problems.push(`${p}: ファイルが存在しません`);
      } else if (prefix !== "" && !existsSync(join(repoRoot, prefix)) && !isForkPlace(p, intake)) {
        // fork にだけある場所(.fork-ownership/ 等)と書き場所の一覧の場所は、上流の木に無くてよい
        problems.push(`${p}: ${prefix} が存在しません(移動・改名?)`);
      }
    }
    assert.deepEqual(problems, [], problems.join("\n"));
    assert.ok(
      tracked.some((f) => paths.some((p) => matchesGlob(f, p))),
      `どの paths も追跡中のファイルに当たりません: ${paths.join(", ")}`,
    );
  });

  test(`${coreDir}/${file}: CLAUDE.md か ${coreDir}/design.md の地図から参照されている`, () => {
    // core のファイルの地図の持ち手は design.md(CLAUDE.md は設計の時に要る物だけを指す)
    const ref = `${coreDir}/${file}`;
    assert.ok(claudeMd.includes(ref) || designMd.includes(ref), `CLAUDE.md にも ${coreDir}/design.md の地図にも ${ref} がありません`);
  });
}

test(`CLAUDE.md と ${coreDir}/design.md の地図が参照する ${coreDir}/*.md が実在する`, () => {
  const refs = [...`${claudeMd}\n${designMd}`.matchAll(/\.claude\/rules\/core\/([\w-]+\.md)/g)].map((m) => m[1]);
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

test("nestedBrace: 入れ子の波かっこだけを見分ける(Claude Code の paths は入れ子を当てない)", () => {
  assert.equal(nestedBrace("src/features/*/{*.ts,{components,hooks}/**}"), true);
  assert.equal(nestedBrace("src/{a,{b,c}}/**"), true);
  assert.equal(nestedBrace("src/features/**/{domain.json,entities/**,messages/*.ts}"), false);
  assert.equal(nestedBrace("src/styles/{**/gradient,z-layer}.css"), false);
  assert.equal(nestedBrace("src/{a,b}/{c,d}.ts"), false);
  assert.equal(nestedBrace("src/**/*.tsx"), false);
  assert.equal(nestedBrace("src/\\{a,{b}}.ts"), false);
});

test(`${LINEAGE_FILE}: 書式(frontmatter なし・区切り行がちょうど 1 つ・各節は fork の名前の ## 見出しで区切り行で閉じる)`, () => {
  // 並び・鍵・打ち消しは祖先の名前が要るので pnpm workflow ownership check(fork)が見る。ここは全 repo の書式だけ
  const path = join(repoRoot, LINEAGE_FILE);
  assert.ok(existsSync(path), `${LINEAGE_FILE} が無い(Tier1 が前置きを出す)`);
  const problems = formatProblems(parseLineage(readFileSync(path, "utf8")));
  assert.deepEqual(problems, [], problems.join("\n"));
});
