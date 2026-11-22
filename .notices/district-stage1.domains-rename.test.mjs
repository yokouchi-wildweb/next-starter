// .notices/district-stage1.domains-rename.test.mjs
// 実行: pnpm test .notices(一時フォルダの fixture。git は使わない)

import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { applyRename, planRename, rewriteText } from "./district-stage1.domains-rename.mjs";

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
