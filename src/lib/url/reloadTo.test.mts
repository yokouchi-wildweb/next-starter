// src/lib/url/reloadTo.ts の試し: 自サイトの道だけを location.replace に渡す
import assert from "node:assert/strict";
import { test } from "node:test";

import { reloadTo } from "./reloadTo";

const fakeWin = () => {
  const calls: string[] = [];
  return { calls, win: { location: { replace: (to: string) => calls.push(to) } } as unknown as Pick<Window, "location"> };
};

test("reloadTo: 自サイトの道を location.replace に渡す(読み直し)", () => {
  const { calls, win } = fakeWin();
  reloadTo("/mypage?tab=1", win);
  assert.deepEqual(calls, ["/mypage?tab=1"]);
});

test("reloadTo: 外の道・// で始まる道・空は / に", () => {
  const { calls, win } = fakeWin();
  reloadTo("https://evil.example/", win);
  reloadTo("//evil.example/", win);
  reloadTo("", win);
  assert.deepEqual(calls, ["/", "/", "/"]);
});
