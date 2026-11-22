// src/lib/startup/createStartup.test.mts
// 起動時の処理: 項目ごとに独立に走り、遅れ・throw・読み込みの失敗は別の 1 行で、ほかの項目を止めないこと。runtime の合わない項目は走らない。
// 実行: pnpm test src/lib/startup (node:test)
import { test } from "node:test";
import assert from "node:assert/strict";

import { createStartup } from "./createStartup.ts";
import type { StartupTask, StartupTaskLoader } from "./types.ts";

function setup(items: StartupTask[], extra: StartupTaskLoader[] = [], runtime: "nodejs" | "edge" = "nodejs") {
  const lines: Record<string, unknown>[] = [];
  const loaders = [...items.map((item) => ({ name: item.name, load: async () => item })), ...extra];
  const startup = createStartup(loaders, { runtime, timeoutMs: 50, write: (line) => lines.push(JSON.parse(line)) });
  return { startup, lines };
}

test("register: 項目ごとに独立、遅れ・throw・読み込みの失敗は別の 1 行", async () => {
  let ran = 0;
  const { startup, lines } = setup(
    [
      { name: "slow", run: () => new Promise(() => {}) },
      { name: "bad", run: () => { throw new Error("init failed"); } },
      { name: "good", run: () => void ran++ },
    ],
    [{ name: "broken", load: async () => { throw new Error("no module"); } }],
  );
  await startup.register();
  assert.equal(ran, 1);
  assert.deepEqual(lines.map((l) => `${l.task}:${l.phase}`).sort(), ["bad:run", "broken:load", "slow:run"]);
  assert.equal(lines.find((l) => l.task === "slow")?.reason, "timeout");
  assert.ok(lines.every((l) => l.level === "error" && l.scope === "startup"));
});

test("runtime: 既定は nodejs だけ、both はどちらでも、合わない項目は走らない", async () => {
  const got: string[] = [];
  const items: StartupTask[] = [
    { name: "node", run: () => void got.push("node") },
    { name: "both", runtime: "both", run: () => void got.push("both") },
    { name: "edge", runtime: "edge", run: () => void got.push("edge") },
  ];
  await setup(items, [], "edge").startup.register();
  assert.deepEqual(got.sort(), ["both", "edge"]);
});

test("項目が無ければ何もしない(上流の既定)", async () => {
  const { startup, lines } = setup([]);
  await startup.register();
  assert.deepEqual(lines, []);
});
