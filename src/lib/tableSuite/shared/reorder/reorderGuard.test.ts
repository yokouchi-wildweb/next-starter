// src/lib/tableSuite/shared/reorder/reorderGuard.test.ts — pnpm test:unsaved-guard
import { test } from "node:test";
import assert from "node:assert/strict";

import type { ReorderResult } from "@/lib/sortableList";

import { TABLE_REORDER_GUARD_REASON, runTableReorder } from "./reorderGuard";

const result: ReorderResult = { itemId: "b", afterItemId: null, beforeItemId: "a", newIndex: 0, oldIndex: 1 };

test("表の並べ替え: 使い手の onReorder の戻り値(保存待ちの Promise か void)をそのまま守りに数えさせる。理由は「未保存」", async () => {
  const tracked: unknown[] = [];
  const tasks = { track: <T,>(task: T) => (tracked.push(task), task) };
  const saving = Promise.resolve();
  const received: ReorderResult[] = [];
  runTableReorder((r) => (received.push(r), saving), result, tasks);
  runTableReorder((r) => void received.push(r), result, tasks);
  assert.deepEqual(received, [result, result]);
  assert.deepEqual(tracked, [saving, undefined]);
  assert.equal(TABLE_REORDER_GUARD_REASON, "unsaved");
  await saving;
});
