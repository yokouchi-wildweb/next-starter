// .notices/20261122-180722-district-stage1.domains-rename.test.mjs
// 実行: pnpm test .notices(一時フォルダの fixture。--base の例だけ一時フォルダに git の木を作る)

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { applyRename, headOnlyForkFiles, mergeBaseReader, parseArgs, planRename, rewriteText } from "./20261122-180722-district-stage1.domains-rename.mjs";

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "domains-rename-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

const read = (root, path) => readFileSync(join(root, path), "utf8");
const NAMES = new Set(["core", "auth", "wallet", "sample", "_template"]);

test("書き換えの形: src/features・@/features・config/features・正規表現の字面・bare・lint 名。語としての feature は触らない", () => {
  const text = [
    'import { a } from "@/features/auth/x";',
    'import o from "@/config/features/wallet.config";',
    'const dir = "src/features/core/wallet";',
    "const re = /^src\\/features\\/(core\\/)?[^/]+\\//;",
    "// 置き場は features/<domain>/hooks、core は features/core/、表は `features/`",
    "/* eslint-disable import-boundaries/lib-no-features, import-boundaries/hooks-utils-no-features, import-boundaries/features-index-no-server-reexport */",
    'const gate = "pnpm ops features list"; // src/featureGate・scripts/operations/features/set.ts・items/features/wallet.md',
  ].join("\n");
  const { text: out, counts, stops } = rewriteText("src/lib/x/a.ts", text, NAMES);
  assert.match(out, /"@\/domains\/auth\/x"/);
  assert.match(out, /"@\/config\/domains\/wallet\.config"/);
  assert.match(out, /"src\/domains\/core\/wallet"/);
  assert.match(out, /\^src\\\/domains\\\//);
  assert.match(out, /domains\/<domain>\/hooks、core は domains\/core\/、表は `domains\/`/);
  assert.match(out, /lib-no-domains, import-boundaries\/hooks-utils-no-domains, import-boundaries\/domains-index-no-server-reexport/);
  assert.match(out, /pnpm ops features list"; \/\/ src\/featureGate・scripts\/operations\/features\/set\.ts・items\/domains\/wallet\.md/);
  assert.deepEqual(counts, { srcPath: 2, alias: 1, config: 1, card: 1, bare: 3, lintName: 3 });
  assert.deepEqual(stops, []);
});

test("相対の指定子: 解いた先が src/features・src/config/features なら書き換え、違えば止める", () => {
  assert.equal(rewriteText("src/lib/storage/README.md", "[a](../../features/core/auth/README.md)\n", NAMES).text, "[a](../../domains/core/auth/README.md)\n");
  assert.equal(rewriteText("src/config/proxies/README.md", "[d](../features/demo.config.ts)\n", NAMES).text, "[d](../domains/demo.config.ts)\n");
  const fixtureSpec = rewriteText("eslint-rules/x.test.mjs", 'code: `import { x } from "../features/sample/x";`\n', NAMES);
  assert.equal(fixtureSpec.text, 'code: `import { x } from "../features/sample/x";`\n');
  assert.equal(fixtureSpec.stops.length, 1);
  assert.equal(fixtureSpec.stops[0].kind, "relative");
});

test("止める物: \"features\" 1 語・知らない名前の bare・残った features/", () => {
  const { text, stops } = rewriteText(
    "scripts/x.mjs",
    'const d = join(root, "src", "features");\n// 例 features/userOpinion/components\nconst m = s.match(/features\\/(\\w+)\\//);\n',
    NAMES,
  );
  assert.match(text, /"features"/);
  assert.match(text, /features\/userOpinion/);
  assert.deepEqual(stops.map((s) => [s.kind, s.line]), [["bare", 2], ["lone", 1], ["leftover", 3]]);
});

test("計画と当て: 3 つのフォルダ(ドメイン・設定値・札)を動かし、見ない物は触らず、2 回目は何も変えない", () => {
  const root = fixture({
    "tsconfig.json": '{ "compilerOptions": { "paths": { "@/features/auth/*": ["./src/features/core/auth/*"] } } }\n',
    "src/features/core/auth/a.ts": 'import { b } from "@/features/auth/b";\nexport const a = b;\n',
    "src/features/core/auth/b.ts": "export const b = 1;\n",
    "src/features/sample/README.md": "置き場 `src/features/sample/`\n",
    "src/config/features/auth.config.ts": 'import type { X } from "@/features/auth/config";\nexport default {};\n',
    "src/lib/x/README.md": "[auth](../../features/core/auth/README.md)\n",
    "eslint.config.mjs": '"import-boundaries/lib-no-features": "error",\n',
    ".fork-ownership/acme.permits.txt": "src/features/core/auth/a.ts upreq:20261101-000000-x\n",
    ".claude/rules/items/features/auth.md": "paths: src/features/core/auth/**\n# features/auth\n",
    "src/features/core/auth/README.md": "決まりは札 .claude/rules/items/features/auth.md\n",
    "scripts/workflow/rules/renames.json": '[\n {\n  "kind": "readme-heading",\n  "old": "src/features/README.md「A」",\n  "new": "src/features/README.md「B」"\n }\n]\n',
    ".notices/20261101-000000-old.md": "src/features/core/auth\n",
    ".notices/20261101-000000-old.tool.mjs": 'const P = "src/features";\n',
    ".notices/applied/acme.md": "src/features\n",
    ".notices/shipped/acme.md": "src/features\n",
    ".notices/done/20261101-x.md": "src/features\n",
    ".notices/README.md": "移行は src/features/<domain>/scripts/migrations/\n",
    "docs/journal/2026-01-01--acme--x.md": "src/features/core/auth\n",
    "scripts/workflow/terms/terms.json": "src/features --gate gate.json\n",
    "public/logo.png": "src/features\0binary",
  });
  const plan = planRename(root);
  assert.deepEqual(plan.moves.map((m) => [m.from, m.to, m.files]), [
    ["src/features", "src/domains", 4],
    ["src/config/features", "src/config/domains", 1],
    [".claude/rules/items/features", ".claude/rules/items/domains", 1],
  ]);
  assert.deepEqual(plan.stops, []);
  assert.equal(plan.skipped["shipped-notice"], 2);
  assert.equal(plan.skipped["notices-record"], 3);
  assert.equal(plan.skipped.journal, 1);
  assert.equal(plan.skipped.terms, 1);
  assert.equal(plan.skipped.binary, 1);

  applyRename(root, plan);
  assert.ok(!existsSync(join(root, "src/features")));
  assert.ok(!existsSync(join(root, "src/config/features")));
  assert.equal(read(root, "src/domains/core/auth/a.ts"), 'import { b } from "@/domains/auth/b";\nexport const a = b;\n');
  assert.equal(read(root, "src/domains/sample/README.md"), "置き場 `src/domains/sample/`\n");
  assert.equal(read(root, "src/config/domains/auth.config.ts"), 'import type { X } from "@/domains/auth/config";\nexport default {};\n');
  assert.equal(read(root, "tsconfig.json"), '{ "compilerOptions": { "paths": { "@/domains/auth/*": ["./src/domains/core/auth/*"] } } }\n');
  assert.equal(read(root, "src/lib/x/README.md"), "[auth](../../domains/core/auth/README.md)\n");
  assert.equal(read(root, "eslint.config.mjs"), '"import-boundaries/lib-no-domains": "error",\n');
  assert.equal(read(root, ".fork-ownership/acme.permits.txt"), "src/domains/core/auth/a.ts upreq:20261101-000000-x\n");
  assert.ok(!existsSync(join(root, ".claude/rules/items/features")));
  assert.equal(read(root, ".claude/rules/items/domains/auth.md"), "paths: src/domains/core/auth/**\n# domains/auth\n");
  assert.equal(read(root, "src/domains/core/auth/README.md"), "決まりは札 .claude/rules/items/domains/auth.md\n");
  // 改名の記録: "old" は当時の名のまま、"new" は今の置き場
  assert.equal(read(root, "scripts/workflow/rules/renames.json"), '[\n {\n  "kind": "readme-heading",\n  "old": "src/features/README.md「A」",\n  "new": "src/domains/README.md「B」"\n }\n]\n');
  assert.equal(read(root, ".notices/README.md"), "移行は src/domains/<domain>/scripts/migrations/\n");
  // 見ない物
  assert.equal(read(root, ".notices/20261101-000000-old.md"), "src/features/core/auth\n");
  assert.equal(read(root, ".notices/20261101-000000-old.tool.mjs"), 'const P = "src/features";\n');
  assert.equal(read(root, ".notices/applied/acme.md"), "src/features\n");
  assert.equal(read(root, ".notices/shipped/acme.md"), "src/features\n");
  assert.equal(read(root, ".notices/done/20261101-x.md"), "src/features\n");
  assert.equal(read(root, "docs/journal/2026-01-01--acme--x.md"), "src/features/core/auth\n");
  assert.equal(read(root, "scripts/workflow/terms/terms.json"), "src/features --gate gate.json\n");

  const again = planRename(root);
  assert.deepEqual(again.moves, []);
  assert.deepEqual(again.edits, []);
});

test("移す先に既にファイルがあれば、無いファイルだけをファイルごとに移す(書き換えは移す前に)", () => {
  const root = fixture({
    "src/features/sample/a.ts": 'export const p = "src/features/sample";\n',
    "src/domains/sample/b.ts": "export const b = 1;\n",
  });
  const plan = planRename(root);
  assert.deepEqual(plan.moves.map((m) => [m.from, m.mode, m.items.map((i) => [i.from, i.to, i.how])]), [
    ["src/features", "files", [["src/features/sample/a.ts", "src/domains/sample/a.ts", "move"]]],
  ]);
  assert.deepEqual(plan.stops, []);
  assert.equal(plan.edits.length, 1);
  applyRename(root, plan);
  assert.ok(!existsSync(join(root, "src/features")));
  assert.equal(read(root, "src/domains/sample/a.ts"), 'export const p = "src/domains/sample";\n');
  assert.equal(read(root, "src/domains/sample/b.ts"), "export const b = 1;\n");
});

test("lineage.md: fork は自分の節だけを書き換え、前書きと祖先の節は書かない / Tier1 は全体", () => {
  const lineage = (body) => `# lineage\n> 前書き src/features/a\n\n## parent\n- k: src/features/a\n<!-- end parent -->\n\n## acme\n- k: ${body}\n<!-- end acme -->\n`;
  const fork = fixture({ "repo.json": '{ "repo_id": "acme", "tier": "middle" }\n', ".claude/rules/lineage.md": lineage("src/features/a") });
  applyRename(fork, planRename(fork));
  assert.equal(read(fork, ".claude/rules/lineage.md"), lineage("src/domains/a"));
  const leafNoSection = fixture({ "repo.json": '{ "repo_id": "leafy", "tier": "leaf" }\n', ".claude/rules/lineage.md": lineage("src/features/a") });
  assert.deepEqual(planRename(leafNoSection).edits, []);
  const tier1 = fixture({ "repo.json": '{ "repo_id": "next-starter", "tier": "root" }\n', ".claude/rules/lineage.md": "# lineage\n> 前書き src/features/a\n" });
  applyRename(tier1, planRename(tier1));
  assert.equal(read(tier1, ".claude/rules/lineage.md"), "# lineage\n> 前書き src/domains/a\n");
});

test("取り込みの後(移す先がある): ファイルごとに移し、両方にあるファイルは基準との 3 方向の merge、食い違えば止める", () => {
  const root = fixture({
    "src/domains/core/auth/a.ts": "export const a = 1;\n",
    "src/config/domains/auth.config.ts": '// src/config/domains/auth.config.ts\nimport type { X } from "@/domains/auth/config";\nexport default { up: 1 } satisfies X;\n',
    "src/config/domains/wallet.config.ts": "export default { w: 2 };\n",
    "src/features/mine/b.ts": 'import { a } from "@/features/auth/a";\nexport const b = a;\n',
    "src/config/features/auth.config.ts": '// src/config/features/auth.config.ts\nimport type { X } from "@/features/auth/config";\nexport default { fork: 1 } satisfies X;\n',
    "src/config/features/wallet.config.ts": "export default { w: 3 };\n",
  });
  const base = {
    "src/config/features/auth.config.ts": '// src/config/features/auth.config.ts\nimport type { X } from "@/features/auth/config";\nexport default {} satisfies X;\n',
    "src/config/features/wallet.config.ts": "export default { w: 1 };\n",
  };
  const baseText = (p) => base[p] ?? null;
  const plan = planRename(root, { baseText });
  const items = Object.fromEntries(plan.moves.flatMap((m) => m.items ?? []).map((i) => [i.from, i.how]));
  assert.deepEqual(plan.moves.map((m) => m.mode), ["files", "files"]);
  assert.equal(items["src/features/mine/b.ts"], "move");
  assert.equal(items["src/config/features/auth.config.ts"], undefined, "上流も fork も同じ行を変えた: 止める");
  assert.deepEqual(plan.stops.filter((s) => s.kind !== "lone").map((s) => [s.kind, s.path]), [
    ["merge-conflict", "src/config/features/auth.config.ts"],
    ["merge-conflict", "src/config/features/wallet.config.ts"],
  ]);

  // 上流が値の行を変えていなければ merge で fork の値が新しい道に乗る
  const root2 = fixture({
    "src/domains/core/auth/a.ts": "export const a = 1;\n",
    "src/config/domains/auth.config.ts": '// src/config/domains/auth.config.ts\nimport type { X } from "@/domains/auth/config";\nexport default {} satisfies X;\n// a\n// b\n// c\n// upstream note\n',
    "src/config/features/auth.config.ts": '// src/config/features/auth.config.ts\nimport type { X } from "@/features/auth/config";\nexport default { fork: 1 } satisfies X;\n// a\n// b\n// c\n',
    "src/config/features/same.config.ts": "export default {};\n",
    "src/config/domains/same.config.ts": "export default {};\n",
  });
  const base2 = { "src/config/features/auth.config.ts": '// src/config/features/auth.config.ts\nimport type { X } from "@/features/auth/config";\nexport default {} satisfies X;\n// a\n// b\n// c\n' };
  const baseText2 = (p) => base2[p] ?? null;
  const plan2 = planRename(root2, { baseText: baseText2 });
  assert.deepEqual(plan2.stops.filter((s) => s.kind !== "lone"), []);
  applyRename(root2, plan2, { baseText: baseText2 });
  assert.ok(!existsSync(join(root2, "src/config/features")));
  assert.equal(read(root2, "src/config/domains/auth.config.ts"), '// src/config/domains/auth.config.ts\nimport type { X } from "@/domains/auth/config";\nexport default { fork: 1 } satisfies X;\n// a\n// b\n// c\n// upstream note\n');
  assert.equal(read(root2, "src/config/domains/same.config.ts"), "export default {};\n");

  // 基準が無く中身が違う: both-exist で止める
  const root3 = fixture({ "src/domains/x/a.ts": "1\n", "src/features/x/a.ts": "2\n" });
  assert.deepEqual(planRename(root3, { baseText: () => null }).stops.map((s) => s.kind), ["both-exist"]);
});

test("brace: src/ か config/ の直後の波かっこの並びの要素 features だけ domains に", () => {
  const { text, counts } = rewriteText("eslint.config.mjs", 'files: ["src/config/{lib,features,layout}/*.config.ts", "src/{features,lib}/**"]\n// {a,features} は並びの頭が道でないので触らない\n', NAMES);
  assert.equal(text, 'files: ["src/config/{lib,domains,layout}/*.config.ts", "src/{domains,lib}/**"]\n// {a,features} は並びの頭が道でないので触らない\n');
  assert.equal(counts.brace, 2);
});

test("文字のファイルは NUL を含んでも書き換える(ソースに直に書いた NUL)、拡張子がバイナリの物は見ない", () => {
  const root = fixture({
    "src/domains/core/auth/a.ts": 'import { b } from "@/features/auth/b";\nconst key = [1, 2].join("\0");\n',
    "public/x.png": "src/features\0",
  });
  const plan = planRename(root);
  assert.deepEqual(plan.edits.map((e) => e.path), ["src/domains/core/auth/a.ts"]);
  assert.equal(plan.skipped.binary, 1);
});

// --base: 取り込みの merge を先に commit した木(鉄道・艦隊の取り込み)でも、merge の途中と同じ 3 方向の merge にする
const CFG_OLD = "src/config/features/auth.config.ts";
const CFG_NEW = "src/config/domains/auth.config.ts";
// a と c の間に変わらない行を挟む(git merge-file が隣り合う変更を 1 つの食い違いにまとめないように)
const cfg = (dir, a, c) => `// src/config/${dir}/auth.config.ts\nexport default {\n  a: ${a},\n  b1: 2,\n  b2: 2,\n  b3: 2,\n  c: ${c},\n};\n`;

function git(root, ...args) {
  return execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false", ...args], { cwd: root, encoding: "utf8" }).trim();
}
function put(root, path, text) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
}

/**
 * 基準 B(features の値)・fork F(c を変える)・上流 U(domains へ移して a を変える)の木。
 * committed = 取り込みの merge を commit した後の木(両方の道が残る: 小さいファイルは git が改名と見ず modify/delete になる形)
 * open = merge の途中(HEAD = F、MERGE_HEAD = U)で同じ作業ツリー
 * forkA = fork も a を変える(上流と食い違う)
 */
function takeIn({ open = false, forkA = 1 } = {}) {
  const root = mkdtempSync(join(tmpdir(), "domains-rename-base-"));
  git(root, "init", "-q", "-b", "main");
  put(root, "src/features/core/auth/index.ts", "export {};\n");
  put(root, CFG_OLD, cfg("features", 1, 3));
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "B");
  const B = git(root, "rev-parse", "HEAD");
  git(root, "switch", "-q", "-c", "upstream");
  rmSync(join(root, CFG_OLD));
  rmSync(join(root, "src/features"), { recursive: true });
  put(root, "src/domains/core/auth/index.ts", "export {};\n");
  put(root, CFG_NEW, cfg("domains", 10, 3));
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "U");
  const U = git(root, "rev-parse", "HEAD");
  git(root, "switch", "-q", "main");
  put(root, CFG_OLD, cfg("features", forkA, 30));
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "F");
  // 取り込みの後の作業ツリー: 上流の分は src/domains に、fork が値を変えたファイルは古い道に残る
  rmSync(join(root, "src/features/core/auth"), { recursive: true });
  put(root, "src/domains/core/auth/index.ts", "export {};\n");
  put(root, CFG_NEW, cfg("domains", 10, 3));
  if (open) writeFileSync(join(root, ".git/MERGE_HEAD"), `${U}\n`);
  else {
    git(root, "add", "-A");
    git(root, "commit", "-q", "-m", "take-in (merge committed)");
  }
  return { root, B, U };
}

test("--base: merge を commit した後でも merge の途中と同じ 3 方向の merge(両方の変更が新しい道に入り、古い道は消える)", () => {
  const committed = takeIn();
  const open = takeIn({ open: true });
  try {
    const withBase = { baseText: mergeBaseReader(committed.root, { base: committed.B }) };
    const plan = planRename(committed.root, withBase);
    assert.deepEqual(plan.stops, []);
    assert.deepEqual(plan.moves.find((m) => m.to === "src/config/domains")?.items, [{ from: CFG_OLD, to: CFG_NEW, how: "merge" }]);
    applyRename(committed.root, plan, withBase);
    assert.equal(read(committed.root, CFG_NEW), cfg("domains", 10, 30));
    assert.equal(existsSync(join(committed.root, CFG_OLD)), false);

    // merge の途中(MERGE_HEAD)は --base なしで同じ結果
    const openReader = { baseText: mergeBaseReader(open.root) };
    const openPlan = planRename(open.root, openReader);
    assert.deepEqual(openPlan.stops, []);
    applyRename(open.root, openPlan, openReader);
    assert.equal(read(open.root, CFG_NEW), read(committed.root, CFG_NEW));
  } finally {
    rmSync(committed.root, { recursive: true, force: true });
    rmSync(open.root, { recursive: true, force: true });
  }
});

test("--base なしで merge を commit した木は今までどおり both-exist で止まる。本当の食い違いは --base でも merge-conflict で止まる", () => {
  const plain = takeIn();
  const clash = takeIn({ forkA: 2 });
  try {
    assert.deepEqual(planRename(plain.root, { baseText: mergeBaseReader(plain.root) }).stops.map((s) => s.kind), ["both-exist"]);
    const stops = planRename(clash.root, { baseText: mergeBaseReader(clash.root, { base: clash.B }) }).stops;
    assert.deepEqual(stops.map((s) => [s.kind, s.path]), [["merge-conflict", CFG_OLD]]);
    assert.equal(read(clash.root, CFG_OLD), cfg("features", 2, 30), "止めた物は書かない");
  } finally {
    rmSync(plain.root, { recursive: true, force: true });
    rmSync(clash.root, { recursive: true, force: true });
  }
});

test("MERGE_HEAD があれば --base より MERGE_HEAD の merge-base が勝つ。解けない --base は投げる。引数の読み", () => {
  const open = takeIn({ open: true });
  const committed = takeIn();
  try {
    // 間違った基準(上流 U)を渡しても、merge の途中は MERGE_HEAD との merge-base(B)で読む
    const reader = mergeBaseReader(open.root, { base: open.U });
    assert.equal(reader(CFG_OLD), cfg("features", 1, 3));
    // merge の途中でない木で解けない --base は投げる(打ち間違いで黙って both-exist に落とさない)
    assert.throws(() => mergeBaseReader(committed.root, { base: "deadbeef" }), /--base deadbeef は commit に解けません/);
  } finally {
    rmSync(open.root, { recursive: true, force: true });
    rmSync(committed.root, { recursive: true, force: true });
  }
  assert.deepEqual(parseArgs(["--apply", "--base", "abc123"]), { apply: true, json: false, base: "abc123" });
  assert.deepEqual(parseArgs(["--base=abc123", "--json"]), { apply: false, json: true, base: "abc123" });
  assert.deepEqual(parseArgs([]), { apply: false, json: false, base: null });
  assert.throws(() => parseArgs(["--base", "--apply"]), /--base には/);
});

// merge の途中の modify/delete(UD): 小さい設定ファイルは git が改名と見ず、fork が変えた古い道の版が作業の木から消えることがある
// (oripa-do の段 1 の取り込みで 10 ファイル)。HEAD の fork の版を自分として 3 方向の merge に入れ、fork の行を落とさない
// 小さいファイル: 上流が変える 2 行(道の注釈・a)を長くして、似ている割合を git の改名の線(50%)の下にする(cfg の形では改名と見られ UD にならない)
const udCfg = (dir, a, c) =>
  `// src/config/${dir}: 認証の設定の値(この行は道の書き換えで変わる長い注釈 0123456789 abcdefghij)\nexport const a = ${a}; // 上流が変える長い値の行 0123456789 abcdefghij klmnopqrst\nexport const keep = 0;\nexport const c = ${c};\n`;
function openUdMerge({ gitRm = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), "domains-rename-ud-"));
  git(root, "init", "-q", "-b", "main");
  put(root, "src/features/core/auth/index.ts", "export {};\n");
  put(root, CFG_OLD, udCfg("features", 1, 3));
  put(root, "src/config/features/plain.config.ts", "export default { p: 1 };\n");
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "B");
  git(root, "switch", "-q", "-c", "upstream");
  git(root, "mv", "src/features", "src/domains");
  mkdirSync(join(root, "src/config/domains"), { recursive: true }); // git mv は移す先のフォルダを作らない
  git(root, "mv", "src/config/features/plain.config.ts", "src/config/domains/plain.config.ts");
  rmSync(join(root, CFG_OLD));
  put(root, CFG_NEW, udCfg("domains", 10, 3));
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "U");
  git(root, "switch", "-q", "main");
  put(root, CFG_OLD, udCfg("features", 1, 30));
  git(root, "commit", "-q", "-am", "F");
  try {
    git(root, "merge", "-q", "upstream");
  } catch {
    // 衝突で止まる(modify/delete)のが期待どおり
  }
  assert.match(git(root, "status", "--porcelain", "--", CFG_OLD), /^UD /);
  if (gitRm) git(root, "rm", "-q", "--", CFG_OLD);
  else rmSync(join(root, CFG_OLD));
  return root;
}

test("merge の途中の modify/delete で古い道の fork の版が木から消えていても、HEAD の版で 3 方向の merge して fork の行を残す", () => {
  for (const gitRm of [false, true]) {
    const root = openUdMerge({ gitRm });
    try {
      const reader = { baseText: mergeBaseReader(root) };
      const headOnly = headOnlyForkFiles(root, reader.baseText);
      assert.deepEqual([...headOnly.keys()], [CFG_OLD], "fork が変えていない物(plain・auth/index.ts)は拾わない");
      const plan = planRename(root, { ...reader, headOnly });
      assert.deepEqual(plan.stops, []);
      assert.deepEqual(plan.moves.find((m) => m.to === "src/config/domains")?.items, [{ from: CFG_OLD, to: CFG_NEW, how: "merge", head: true }]);
      applyRename(root, plan, { ...reader, headOnly });
      assert.equal(read(root, CFG_NEW), udCfg("domains", 10, 30), "上流の a と fork の c が両方入る");
      assert.match(git(root, "status", "--porcelain", "--", CFG_OLD), /^D  /, "古い道の衝突は解け、消す形で索引に載る(HEAD にはあるので D)");
      assert.equal(git(root, "ls-files", "-u"), "");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

test("木に無い fork の版で上流と食い違えば merge-conflict で止め、移す先は書かない", () => {
  const root = openUdMerge();
  try {
    put(root, CFG_NEW, udCfg("domains", 10, 4)); // 上流も c を変えた形
    const plan = planRename(root, { baseText: mergeBaseReader(root) });
    assert.deepEqual(plan.stops.map((s) => [s.kind, s.path]), [["merge-conflict", CFG_OLD]]);
    assert.match(plan.stops[0].suggest, /git show HEAD:src\/config\/features\/auth\.config\.ts/);
    assert.equal(read(root, CFG_NEW), udCfg("domains", 10, 4));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
