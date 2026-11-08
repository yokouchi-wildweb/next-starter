// scripts/operations/business/business.test.ts — 初期化の道具(pnpm ops business from-example | blank)の書き出し。実行: pnpm test scripts/operations/business
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { EXAMPLE_BUSINESS } from "@/lib/business";

import { BUSINESS_FILE, blankValues, ownFileText, writeOwnFile } from "./lib";

const root = mkdtempSync(path.join(tmpdir(), "business-init-"));
after(() => rmSync(root, { recursive: true, force: true }));
mkdirSync(path.join(root, "src/business"), { recursive: true });

test("例を写す: own と例の値を書き、型の満たし方の行を持つ", () => {
  const text = ownFileText(EXAMPLE_BUSINESS);
  assert.match(text, /export default \{\n {2}source: "own",\n {2}values: \{/);
  assert.match(text, /serviceName: "next-starter",/);
  assert.match(text, /\} satisfies BusinessFile;\n$/);
});

test("空の欄: 文字の欄は空、ロゴの既定の種類は名前のまま", () => {
  const blank = blankValues(EXAMPLE_BUSINESS);
  assert.equal(blank.serviceName, "");
  assert.equal(blank.company.email, "");
  assert.equal(blank.logo.variants.default, "");
  assert.equal(blank.logo.defaultVariant, "default");
});

test("既に own なら --force が無い限り書かない", () => {
  const file = path.join(root, BUSINESS_FILE);
  writeFileSync(file, `export default { source: "sample" };\n`);
  assert.equal(writeOwnFile(root, ownFileText(EXAMPLE_BUSINESS), false).written, true);
  const result = writeOwnFile(root, "x", false);
  assert.equal(result.written, false);
  assert.match(result.reason ?? "", /--force/);
  assert.match(readFileSync(file, "utf8"), /source: "own"/);
  assert.equal(writeOwnFile(root, "x", true).written, true);
});
