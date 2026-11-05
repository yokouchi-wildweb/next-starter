// src/lib/tableSuite/EditableGridTable/utils/editGuard.test.ts — pnpm test:unsaved-guard
import { test } from "node:test";
import assert from "node:assert/strict";

import { createDraftCells, editUnsavedGuard } from "./editGuard";

test("表: 書きかけのセルを数え、数が変わった時だけ知らせる(同じセルの 2 回目は数えない)", () => {
  const counts: number[] = [];
  const cells = createDraftCells((n) => counts.push(n));
  cells.set("1-name", true);
  cells.set("1-name", true);
  cells.set("2-name", true);
  cells.set("1-name", false);
  cells.set("3-name", false);
  cells.set("2-name", false);
  assert.deepEqual(counts, [1, 2, 1, 0]);
});

test("表: 書きかけが 1 つでもあれば「未保存」で守り、無ければ外す。guardUnsaved = false なら守らない", () => {
  assert.deepEqual(editUnsavedGuard({ draftCount: 1, guardUnsaved: true }), { when: true, reason: "unsaved" });
  assert.equal(editUnsavedGuard({ draftCount: 0, guardUnsaved: true }).when, false);
  assert.equal(editUnsavedGuard({ draftCount: 2, guardUnsaved: false }).when, false);
});
