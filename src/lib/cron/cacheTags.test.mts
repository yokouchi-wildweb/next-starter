// cron の入口(createCronRoute)がタスクを cacheTags の範囲で包み、タスクの中で積んだキャッシュタグを終わりに 1 回
// revalidateTag(tag, { expire: 0 })へ渡すこと。実行: pnpm test src/lib/cron/cacheTags.test.mts
import assert from "node:assert/strict";
import { after, mock, test } from "node:test";

import nextServer from "next/server";

import { setAppEnv } from "@/lib/appEnv";

const revalidated: Array<{ tag: string; profile: unknown }> = [];
mock.module("next/server", { namedExports: { ...nextServer, connection: async () => {} } });
mock.module("next/cache", { namedExports: { revalidateTag: (tag: string, profile: unknown) => void revalidated.push({ tag, profile }) } });

const { createCronRoute } = await import("./createCronRoute.ts");
const { markCacheTags } = await import("@/lib/cacheTags/server");

const restoreAppEnv = setAppEnv("development");
after(restoreAppEnv);

test("cron の入口: タスクの中の印を終わりに消す", async () => {
  revalidated.length = 0;
  const route = createCronRoute({
    name: "cache-tags-probe",
    handler: async () => {
      markCacheTags("order");
      return { done: true };
    },
  });
  const original = console.log;
  console.log = () => {};
  try {
    const res = await route(new Request("http://localhost/api/cron/cache-tags-probe"));
    assert.equal(res.status, 200);
  } finally {
    console.log = original;
  }
  assert.deepEqual(revalidated.map((r) => r.tag), ["order"]);
});
