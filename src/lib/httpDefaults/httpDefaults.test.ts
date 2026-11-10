// src/lib/httpDefaults/httpDefaults.test.ts — 既定のタイムアウトの付け方(設定の議会 D62)。実行: pnpm test src/lib/httpDefaults
import { after, test } from "node:test";
import assert from "node:assert/strict";
import axios, { type InternalAxiosRequestConfig } from "axios";

import { applyDefaultTimeout, httpDefaultsConfig, httpDefaultsConfigDef, installHttpDefaults } from "./index";

const seen: InternalAxiosRequestConfig[] = [];
const adapter = async (config: InternalAxiosRequestConfig) => {
  seen.push(config);
  return { data: null, status: 200, statusText: "OK", headers: {}, config };
};
after(() => installHttpDefaults(axios, null));

// 上流の既定は compose({}) で見る(読み込んだ httpDefaultsConfig は fork が src/config/lib/httpDefaults.config.ts に書いた値で変わる)
test("既定は付けない(上流の空の上書き)、上書きで値が入る", () => {
  assert.deepEqual(httpDefaultsConfigDef.compose({}), { timeoutMs: null });
  assert.deepEqual(Object.keys(httpDefaultsConfig), ["timeoutMs"]);
  assert.deepEqual(httpDefaultsConfigDef.compose({ timeoutMs: 30_000 }), { timeoutMs: 30_000 });
});

test("applyDefaultTimeout: 未設定なら何もしない・呼び出しの値と defaultTimeout: false はそのまま・無い(0)なら付ける", () => {
  assert.equal(applyDefaultTimeout({ timeout: 0 }, null).timeout, 0);
  assert.equal(applyDefaultTimeout({ timeout: 0 }, 30_000).timeout, 30_000);
  assert.equal(applyDefaultTimeout<{ timeout?: number }>({}, 30_000).timeout, 30_000);
  assert.equal(applyDefaultTimeout({ timeout: 60_000 }, 30_000).timeout, 60_000);
  assert.equal(applyDefaultTimeout({ timeout: 0, defaultTimeout: false }, 30_000).timeout, 0);
});

test("installHttpDefaults: 既定のインスタンスだけに付き、axios.create と axios.defaults は変わらない。二重に登録しない", async () => {
  seen.length = 0;
  installHttpDefaults(axios, 30_000);
  installHttpDefaults(axios, 30_000);
  await axios.get("/x", { adapter });
  await axios.get("/x", { adapter, timeout: 5_000 });
  await axios.get("/x", { adapter, defaultTimeout: false });
  await axios.create().get("/x", { adapter });
  assert.deepEqual(seen.map((c) => c.timeout), [30_000, 5_000, 0, 0]);
  assert.equal(axios.defaults.timeout, 0);
  assert.equal((axios.interceptors.request as unknown as { handlers: unknown[] }).handlers.filter(Boolean).length, 1);
});

test("installHttpDefaults(null) は前の登録を外す", async () => {
  seen.length = 0;
  installHttpDefaults(axios, 30_000);
  installHttpDefaults(axios, null);
  await axios.get("/x", { adapter });
  assert.equal(seen.at(-1)?.timeout, 0);
});
