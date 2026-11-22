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
    "/* eslint-disable import-boundaries/lib-no-features, import-boundaries/hooks-utils-no-features */",
    'const gate = "pnpm ops features list"; // src/featureGate・scripts/operations/features/set.ts・items/features/wallet.md',
  ].join("\n");
  const { text: out, counts, stops } = rewriteText("src/lib/x/a.ts", text, NAMES);
  assert.match(out, /"@\/domains\/auth\/x"/);
  assert.match(out, /"@\/config\/domains\/wallet\.config"/);
  assert.match(out, /"src\/domains\/core\/wallet"/);
  assert.match(out, /\^src\\\/domains\\\//);
  assert.match(out, /domains\/<domain>\/hooks、core は domains\/core\/、表は `domains\/`/);
  assert.match(out, /lib-no-domains, import-boundaries\/hooks-utils-no-domains/);
  assert.match(out, /pnpm ops features list"; \/\/ src\/featureGate・scripts\/operations\/features\/set\.ts・items\/features\/wallet\.md/);
  assert.deepEqual(counts, { srcPath: 2, alias: 1, config: 1, bare: 3, lintName: 2 });
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

test("計画と当て: 2 つのフォルダを動かし、見ない物は触らず、2 回目は何も変えない", () => {
  const root = fixture({
    "tsconfig.json": '{ "compilerOptions": { "paths": { "@/features/auth/*": ["./src/features/core/auth/*"] } } }\n',
    "src/features/core/auth/a.ts": 'import { b } from "@/features/auth/b";\nexport const a = b;\n',
    "src/features/core/auth/b.ts": "export const b = 1;\n",
    "src/features/sample/README.md": "置き場 `src/features/sample/`\n",
    "src/config/features/auth.config.ts": 'import type { X } from "@/features/auth/config";\nexport default {};\n',
    "src/lib/x/README.md": "[auth](../../features/core/auth/README.md)\n",
    "eslint.config.mjs": '"import-boundaries/lib-no-features": "error",\n',
    ".fork-ownership/acme.permits.txt": "src/features/core/auth/a.ts upreq:20261101-000000-x\n",
    ".claude/rules/items/features/auth.md": "paths: src/features/core/auth/**\n",
    ".notices/20261101-000000-old.md": "src/features/core/auth\n",
    ".notices/20261101-000000-old.tool.mjs": 'const P = "src/features";\n',
    ".notices/applied/acme.md": "src/features\n",
    ".notices/README.md": "移行は src/features/<domain>/scripts/migrations/\n",
    "docs/journal/2026-01-01--acme--x.md": "src/features/core/auth\n",
    "public/logo.png": "src/features\0binary",
  });
  const plan = planRename(root);
  assert.deepEqual(plan.moves.map((m) => [m.from, m.to, m.files]), [
    ["src/features", "src/domains", 3],
    ["src/config/features", "src/config/domains", 1],
  ]);
  assert.deepEqual(plan.stops, []);
  assert.equal(plan.skipped["shipped-notice"], 2);
  assert.equal(plan.skipped.ledger, 1);
  assert.equal(plan.skipped.journal, 1);
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
  assert.equal(read(root, ".claude/rules/items/features/auth.md"), "paths: src/domains/core/auth/**\n");
  assert.equal(read(root, ".notices/README.md"), "移行は src/domains/<domain>/scripts/migrations/\n");
  // 見ない物
  assert.equal(read(root, ".notices/20261101-000000-old.md"), "src/features/core/auth\n");
  assert.equal(read(root, ".notices/20261101-000000-old.tool.mjs"), 'const P = "src/features";\n');
  assert.equal(read(root, ".notices/applied/acme.md"), "src/features\n");
  assert.equal(read(root, "docs/journal/2026-01-01--acme--x.md"), "src/features/core/auth\n");

  const again = planRename(root);
  assert.deepEqual(again.moves, []);
  assert.deepEqual(again.edits, []);
});

test("移す先に既にファイルがあれば移動を止める(書き換えは計画に残る)", () => {
  const root = fixture({
    "src/features/sample/a.ts": 'export const p = "src/features/sample";\n',
    "src/domains/sample/b.ts": "export const b = 1;\n",
  });
  const plan = planRename(root);
  assert.deepEqual(plan.moves, []);
  assert.deepEqual(plan.stops.map((s) => [s.kind, s.path]), [["target-exists", "src/domains"]]);
  assert.equal(plan.edits.length, 1);
});
