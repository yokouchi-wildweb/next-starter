// .notices/20261122-180722-district-stage1.phase-rename.test.mjs
// 実行: pnpm test .notices(一時フォルダの fixture。git は使わない)

import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { applyRename, planRename, rewriteText } from "./20261122-180722-district-stage1.phase-rename.mjs";

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "phase-rename-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}
const read = (root, path) => readFileSync(join(root, path), "utf8");

test("書き換えの形: --gate・gate.json・gates.json・runner/gates・相対・門 <段の名前>。門番の語は触らない", () => {
  const text = [
    '"build": "pnpm check --gate=build && next build && pnpm check --gate=build:post",',
    "// 各道具の gate.json(一覧 scripts/runner/gates/gates.json)。usage: [--gate=<段>]",
    'import { scan } from "../gates/scan.mjs";',
    "// pnpm build の門 build と門 ship で回る。門番(featureGate)・門の規則・専門の語は触らない",
  ].join("\n");
  const { text: out, counts, stops } = rewriteText("scripts/runner/test/run.mjs", text);
  assert.match(out, /--phase=build && next build && pnpm check --phase=build:post/);
  assert.match(out, /各道具の phase\.json\(一覧 scripts\/runner\/phases\/phases\.json\)。usage: \[--phase=<段>\]/);
  assert.match(out, /from "\.\.\/phases\/scan\.mjs"/);
  assert.match(out, /段階 build と段階 ship で回る。門番\(featureGate\)・門の規則・専門の語は触らない/);
  assert.deepEqual(counts, { relative: 1, flag: 3, file: 2, dir: 1, ja: 2 });
  assert.deepEqual(stops, []);
});

test("環境変数 env: 子の検査が読む段の名前 GATE → PHASE(GATE_X や別の名前は触らない)", () => {
  const { text, counts } = rewriteText("scripts/structure/mine/check.ts", 'if (process.env.GATE === "build") {}\nconst g = process.env["GATE"];\nconst x = process.env.GATE_X;\n');
  assert.equal(text, 'if (process.env.PHASE === "build") {}\nconst g = process.env["PHASE"];\nconst x = process.env.GATE_X;\n');
  assert.deepEqual(counts, { env: 2 });
});

test("相対の指定子: 解いた先が scripts/runner/gates の物だけ", () => {
  assert.equal(rewriteText("scripts/structure/x/a.mjs", 'import "../../runner/gates/scan.mjs";\n').text, 'import "../../runner/phases/scan.mjs";\n');
  assert.equal(rewriteText("src/lib/x/a.ts", 'import "../gates/thing";\n').text, 'import "../gates/thing";\n');
});

test("段の宣言のキー gates → phases は宣言と一覧の中だけ。外の \"gates\" は段の文脈なら止める", () => {
  assert.equal(rewriteText("scripts/structure/x/gate.json", '{ "check": "check.mjs", "gates": ["ship"] }\n').text, '{ "check": "check.mjs", "phases": ["ship"] }\n');
  assert.equal(rewriteText("scripts/runner/gates/gates.json", '{ "gates": { "ship": {} } }\n').text, '{ "phases": { "ship": {} } }\n');
  const code = rewriteText("scripts/runner/gates/scan.mjs", '// gate.json を読む\nexport const KEYS = ["check", "gates"];\n');
  assert.deepEqual(code.stops.map((s) => [s.kind, s.line]), [["key", 2]]);
  // 段の文脈でないファイル(地区の地図の gates = 門番の規則)は止めない
  assert.deepEqual(rewriteText("src/registry/district-map.jsonl", '{"gates":["wallet"]}\n').stops, []);
});

test("止める物 ja: 段の文脈のファイルの、段の名前と組まない門(門番の意味の形と前が漢字の物は数えない)", () => {
  const { stops } = rewriteText("scripts/runner/gates/README.md", "# 門(pnpm check --gate=ship)\n門番の規則と門の入口・専門\n門のランナー\n");
  assert.deepEqual(stops.map((s) => [s.kind, s.line]), [["ja", 1], ["ja", 3]]);
  // 段の文脈でないファイルは止めない
  assert.deepEqual(rewriteText("src/lib/cron/x.md", "機能の門が付く\n").stops, []);
});

test("計画と当て: 宣言・ランナーのフォルダ・一覧とテストのファイル名を動かし、見ない物は触らず、2 回目は何も変えない", () => {
  const root = fixture({
    "package.json": '{ "scripts": { "build": "pnpm check --gate=build && next build" } }\n',
    "scripts/structure/routes/gate.json": '{ "check": "check.ts", "gates": ["ship"], "watch": ["scripts/runner/gates/**"] }\n',
    "scripts/structure/mine/gate.json": '{ "check": "check.mjs", "gates": ["ship"] }\n',
    "scripts/runner/gates/gates.json": '{ "gates": { "ship": { "runs": "/ship" } } }\n',
    "scripts/runner/gates/gates.test.mjs": "// scripts/runner/gates/gates.test.mjs\n",
    "scripts/runner/gates/scan.mjs": 'const p = "runner/gates/gates.json"; // 各 gate.json\n',
    ".notices/20261101-000000-old.md": "pnpm check --gate=ship\n",
    ".notices/applied/acme.md": "--gate\n",
    ".notices/shipped/acme.md": "--gate\n",
    ".notices/done/20261101-x.md": "--gate\n",
    "docs/journal/2026-01-01--acme--x.md": "gate.json\n",
    "scripts/workflow/terms/terms.json": "src/features --gate gate.json\n",
  });
  const plan = planRename(root);
  assert.deepEqual(plan.moves.map((m) => [m.from, m.to]).sort(), [
    ["scripts/structure/routes/gate.json", "scripts/structure/routes/phase.json"],
    ["scripts/structure/mine/gate.json", "scripts/structure/mine/phase.json"],
    ["scripts/runner/gates", "scripts/runner/phases"],
    ["scripts/runner/phases/gates.json", "scripts/runner/phases/phases.json"],
    ["scripts/runner/phases/gates.test.mjs", "scripts/runner/phases/phases.test.mjs"],
  ].sort());
  assert.deepEqual(plan.stops, []);

  applyRename(root, plan);
  assert.ok(!existsSync(join(root, "scripts/runner/gates")));
  assert.equal(read(root, "package.json"), '{ "scripts": { "build": "pnpm check --phase=build && next build" } }\n');
  assert.equal(read(root, "scripts/structure/routes/phase.json"), '{ "check": "check.ts", "phases": ["ship"], "watch": ["scripts/runner/phases/**"] }\n');
  assert.equal(read(root, "scripts/structure/mine/phase.json"), '{ "check": "check.mjs", "phases": ["ship"] }\n');
  assert.equal(read(root, "scripts/runner/phases/phases.json"), '{ "phases": { "ship": { "runs": "/ship" } } }\n');
  assert.equal(read(root, "scripts/runner/phases/phases.test.mjs"), "// scripts/runner/phases/phases.test.mjs\n");
  assert.equal(read(root, "scripts/runner/phases/scan.mjs"), 'const p = "runner/phases/phases.json"; // 各 phase.json\n');
  assert.equal(read(root, ".notices/20261101-000000-old.md"), "pnpm check --gate=ship\n");
  assert.equal(read(root, ".notices/applied/acme.md"), "--gate\n");
  assert.equal(read(root, ".notices/shipped/acme.md"), "--gate\n");
  assert.equal(read(root, ".notices/done/20261101-x.md"), "--gate\n");
  assert.equal(read(root, "docs/journal/2026-01-01--acme--x.md"), "gate.json\n");
  assert.equal(read(root, "scripts/workflow/terms/terms.json"), "src/features --gate gate.json\n");

  const again = planRename(root);
  assert.deepEqual(again.moves, []);
  assert.deepEqual(again.edits, []);
});

test("移す先に既に物があれば移動を止める", () => {
  const root = fixture({
    "scripts/structure/x/gate.json": '{ "gates": ["ship"] }\n',
    "scripts/structure/x/phase.json": '{ "phases": ["ship"] }\n',
  });
  const plan = planRename(root);
  assert.deepEqual(plan.moves, []);
  assert.deepEqual(plan.stops.map((s) => [s.kind, s.path]), [["target-exists", "scripts/structure/x/phase.json"]]);
});

test("file: 正規表現の字面で点をエスケープした gate\\.json・gate\\\\.json も phase に", () => {
  const out = rewriteText("scripts/x/a.mjs", 'const A = /\\/gate\\.json$/;\nconst B = new RegExp(`/${t}/gate\\\\.json$`);\n').text;
  assert.equal(out, 'const A = /\\/phase\\.json$/;\nconst B = new RegExp(`/${t}/phase\\\\.json$`);\n');
});

test("renames.json: 改名の記録の \"old\" は当時の名のまま、\"new\" は書き換える", () => {
  const root = fixture({
    "scripts/workflow/rules/renames.json": '[\n {\n  "kind": "rule-key",\n  "old": "scripts/runner/gates/README.md gates",\n  "new": "scripts/runner/gates/README.md x"\n }\n]\n',
  });
  applyRename(root, planRename(root));
  assert.equal(read(root, "scripts/workflow/rules/renames.json"), '[\n {\n  "kind": "rule-key",\n  "old": "scripts/runner/gates/README.md gates",\n  "new": "scripts/runner/phases/README.md x"\n }\n]\n');
});

test("lineage.md: fork は自分の節だけを書き換え、前書きと祖先の節は書かない / Tier1 は全体", () => {
  const lineage = (body) => `# lineage\n> 前書き pnpm check --gate=ship\n\n## parent\n- k: pnpm check --gate=ship\n<!-- end parent -->\n\n## acme\n- k: ${body}\n<!-- end acme -->\n`;
  const fork = fixture({ "repo.json": '{ "repo_id": "acme", "tier": "middle" }\n', ".claude/rules/lineage.md": lineage("pnpm check --gate=ship") });
  applyRename(fork, planRename(fork));
  assert.equal(read(fork, ".claude/rules/lineage.md"), lineage("pnpm check --phase=ship"));
  const leafNoSection = fixture({ "repo.json": '{ "repo_id": "leafy", "tier": "leaf" }\n', ".claude/rules/lineage.md": lineage("pnpm check --gate=ship") });
  assert.deepEqual(planRename(leafNoSection).edits, []);
  const tier1 = fixture({ "repo.json": '{ "repo_id": "next-starter", "tier": "root" }\n', ".claude/rules/lineage.md": "# lineage\n> 前書き pnpm check --gate=ship\n" });
  applyRename(tier1, planRename(tier1));
  assert.equal(read(tier1, ".claude/rules/lineage.md"), "# lineage\n> 前書き pnpm check --phase=ship\n");
});
