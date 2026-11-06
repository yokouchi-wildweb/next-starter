// src/lib/sortableList/reorderGuard.test.ts — pnpm test src/lib/sortableList/reorderGuard.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { REORDER_GUARD_REASON, runReorder } from "./reorderGuard";
import type { ReorderResult } from "./types";

const result: ReorderResult = { itemId: "b", afterItemId: null, beforeItemId: "a", newIndex: 0, oldIndex: 1 };

test("並べ替え: 使い手の onReorder の戻り値(保存待ちの Promise か void)をそのまま守りに数えさせる。理由は「未保存」", async () => {
  const tracked: unknown[] = [];
  const tasks = { track: <T,>(task: T) => (tracked.push(task), task) };
  const saving = Promise.resolve();
  const received: ReorderResult[] = [];
  runReorder((r) => (received.push(r), saving), result, tasks);
  runReorder((r) => void received.push(r), result, tasks);
  assert.deepEqual(received, [result, result]);
  assert.deepEqual(tracked, [saving, undefined]);
  assert.equal(REORDER_GUARD_REASON, "unsaved");
  await saving;
});
