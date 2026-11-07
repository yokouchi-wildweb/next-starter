// src/lib/appEnv/appEnv.test.ts
//
// 段階の読み手の検査: 3 つの値・値なし・空・知らない値(→ production)・前後の空白、withAppEnv / setAppEnv の差し替えと復元。
// 実行: pnpm test:app-env
import { test } from "node:test";
import assert from "node:assert/strict";

import { getAppEnv, isDevelopment, isProduction, isStaging, parseAppEnv, setAppEnv, withAppEnv } from "./index";

test("3 つの値はそのまま読む", () => {
  for (const value of ["development", "staging", "production"] as const) {
    withAppEnv(value, () => assert.equal(getAppEnv(), value));
  }
  withAppEnv("development", () => {
    assert.equal(isDevelopment(), true);
    assert.equal(isStaging(), false);
    assert.equal(isProduction(), false);
  });
  withAppEnv("staging", () => {
    assert.equal(isDevelopment(), false);
    assert.equal(isStaging(), true);
    assert.equal(isProduction(), false);
  });
});

test("値が無い・空・知らない値は production", () => {
  withAppEnv(undefined, () => {
    assert.equal(getAppEnv(), "production");
    assert.equal(isProduction(), true);
    assert.equal(isDevelopment(), false);
  });
  for (const value of ["", "dev", "Development", "test", ".env.development", "prod"]) {
    withAppEnv(value, () => assert.equal(getAppEnv(), "production", JSON.stringify(value)));
  }
});

test("前後の空白は除く", () => {
  assert.equal(parseAppEnv(" staging "), "staging");
  assert.equal(parseAppEnv(null), "production");
});

test("withAppEnv は終わったら元に戻す(例外・Promise でも)", async () => {
  const before = process.env.APP_ENV;
  assert.throws(() => withAppEnv("staging", () => { throw new Error("x"); }));
  assert.equal(process.env.APP_ENV, before);
  await withAppEnv("staging", async () => {
    await Promise.resolve();
    assert.equal(getAppEnv(), "staging");
  });
  assert.equal(process.env.APP_ENV, before);
});

test("setAppEnv は差し替える前に戻す関数を返す", () => {
  const before = process.env.APP_ENV;
  const restoreOuter = setAppEnv("staging");
  const restoreInner = setAppEnv(undefined);
  assert.equal(getAppEnv(), "production");
  restoreInner();
  assert.equal(getAppEnv(), "staging");
  restoreOuter();
  assert.equal(process.env.APP_ENV, before);
});
