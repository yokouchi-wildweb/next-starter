// scripts/workflow/rules/ruleRenames.test.mjs — 名の対応表と古い名指しの探し方(lib.ruleRenames.mjs)の検査
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isStaleRefTarget, staleRefsIn } from "./lib.ruleRenames.mjs";

const entries = JSON.parse(readFileSync(join(import.meta.dirname, "renames.json"), "utf8"));

test("対応表: 1 件 = kind・old・new・order、old は重ならない", () => {
  for (const entry of entries) {
    assert.ok(["rule-key", "claude-section", "core-file", "readme-heading"].includes(entry.kind), entry.old);
    assert.ok(entry.old && entry.new && Number.isInteger(entry.order), entry.old);
  }
  assert.equal(new Set(entries.map((entry) => entry.old)).size, entries.length);
});

test("対応表: 古い core のファイルは今の木に無く、新しい置き場のファイルはある", () => {
  const root = join(import.meta.dirname, "../../..");
  for (const entry of entries.filter((e) => e.kind === "core-file")) {
    assert.ok(!existsSync(join(root, entry.old)), entry.old);
    assert.ok(existsSync(join(root, entry.new.split(" ")[0])), entry.new);
  }
});

test("古い名指しを挙げ、新しい名指しは挙げない", () => {
  const text = [
    "see CLAUDE.md UNCONFIGURED_BACKENDS for the guard",
    "see CLAUDE.md BACKENDS unconfigured for the guard",
    "rules: .claude/rules/core/crud-service.md",
    "README: src/featureGate/README.md「依存の検査」",
    "README: src/featureGate/Internals.md「依存の検査」",
    "take it with CLAUDE.md DOWNSTREAM_NOTICES intake",
  ].join("\n");
  const hits = staleRefsIn("x.md", text, entries).map((hit) => `${hit.line} ${hit.kind}`);
  // 6 行目は節の名(DOWNSTREAM_NOTICES → REPO_LINK)と鍵(intake → take_in)の両方の古い名指し
  assert.deepEqual(hits, ["1 claude-section", "3 core-file", "4 readme-heading", "6 rule-key", "6 claude-section"]);
});

test("対象: 記録と上流の決まりのファイルは見ない", () => {
  assert.equal(isStaleRefTarget(".notices/20260101-x.md"), false);
  assert.equal(isStaleRefTarget("docs/journal/2026-01-01--x.md"), false);
  assert.equal(isStaleRefTarget(".claude/rules/core/design.md"), false);
  assert.equal(isStaleRefTarget(".claude/rules/project.md"), true);
  assert.equal(isStaleRefTarget("src/features/shop/README.md"), true);
});
