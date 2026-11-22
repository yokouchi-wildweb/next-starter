// scripts/workflow/rules/ruleCoverage.test.mjs
// paths の覆い(lib.ruleCoverage.mjs)の振る舞いと、今の木の外す場所の一覧の形。実行: pnpm test scripts/workflow/rules/ruleCoverage.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { coverageGaps, isForkPlace, parseIntakeRows, parseUncovered, representativePath } from "./lib.ruleCoverage.mjs";

const repoRoot = join(import.meta.dirname, "../../..");

test("覆い: 決まりの paths か外す一覧に当たるファイルは穴でない", () => {
  const gaps = coverageGaps({
    files: ["src/lib/a/x.ts", "src/app/p/page.tsx", "public/logo.png", "eslint-rules/r.mjs"],
    intake: [],
    rulePaths: ["src/lib/**", "src/app/**"],
    uncovered: ["public/**"],
  });
  assert.deepEqual(gaps.files, ["eslint-rules/r.mjs"]);
});

test("覆い: 書き場所の一覧の行は glob そのものか代表のパスで照らす", () => {
  const intake = parseIntakeRows("# 注釈\nedit src/config/**  # 値\nadd src/domains/core/setting/fields/*\n!edit src/config/x.ts\nedit firebase.json  # 設定\n");
  assert.deepEqual(intake.map((r) => r.glob), ["src/config/**", "src/domains/core/setting/fields/*", "firebase.json"]);
  const gaps = coverageGaps({ files: [], intake, rulePaths: ["src/config/**", "src/domains/**"], uncovered: [] });
  assert.deepEqual(gaps.intake, ["edit firebase.json"]);
  assert.equal(representativePath("src/**/x/*.ts"), "src/x/x/x.ts");
});

test("fork にだけある場所: 所有の道具の場所と書き場所の一覧の場所", () => {
  const intake = parseIntakeRows("generated vercel.json\nedit src/config/**\n");
  assert.ok(isForkPlace(".fork-ownership/**", intake));
  assert.ok(isForkPlace(".notices/applied/**", intake));
  assert.ok(isForkPlace("vercel.json", intake));
  assert.ok(isForkPlace("src/config/lib/x.config.ts", intake));
  assert.ok(!isForkPlace("src/gone/**", intake));
});

test("外す場所の一覧: 理由の無い行は失敗", () => {
  assert.throws(() => parseUncovered("public/**\n"));
  assert.deepEqual(parseUncovered("# x\npublic/**  # 画像\n"), [{ glob: "public/**", reason: "画像" }]);
});

test("今の木: .claude/rules/core/uncovered.txt の全行に理由がある", () => {
  const rows = parseUncovered(readFileSync(join(repoRoot, ".claude/rules/core/uncovered.txt"), "utf8"));
  assert.ok(rows.length > 0);
});

test("matchesLoad: Claude Code の読み込みと同じく ** と * は点で始まる名・フォルダにも当たる(D225、注文 59 の claude -p の確かめ)", async () => {
  const { matchesLoad } = await import("./lib.rulePaths.mjs");
  assert.equal(matchesLoad("src/domains/core/analytics/entities/.gitkeep", "src/domains/**/entities/**"), true);
  assert.equal(matchesLoad("servers/room/.npmrc", "servers/**"), true);
  assert.equal(matchesLoad(".codex/README.md", "**/README*.md"), true);
  assert.equal(matchesLoad(".notices/README.md", ".notices/**"), true);
  assert.equal(matchesLoad("src/a.ts", "src/b/**"), false);
  assert.equal(matchesLoad("drizzle/.gitkeep", "src/**"), false);
});

test("coverageVerdict: Tier1 は穴で止める、fork は知らせだけ、基準が読めない fork は 1 行(D223)", async () => {
  const { coverageVerdict } = await import("./lib.ruleCoverage.mjs");
  const gaps = { files: ["src/x.ts"], intake: ["add src/y/*.ts"] };
  const none = { files: [], intake: [] };
  assert.deepEqual(coverageVerdict({ isTier1: true, baseNote: null, gaps }).exitCode, 1);
  assert.equal(coverageVerdict({ isTier1: true, baseNote: null, gaps }).level, "fail");
  assert.deepEqual(coverageVerdict({ isTier1: false, baseNote: null, gaps }), { exitCode: 0, level: "notify", lines: ["src/x.ts にどの決まりのファイルの paths も当たらない", "書き場所の一覧の add src/y/*.ts にどの決まりのファイルの paths も当たらない"] });
  assert.deepEqual(coverageVerdict({ isTier1: false, baseNote: "台帳が無い", gaps }), { exitCode: 0, level: "unverified", lines: ["覆いを確かめられない(台帳が無い)"] });
  assert.equal(coverageVerdict({ isTier1: true, baseNote: null, gaps: none }).level, "ok");
});
