// src/lib/toast/config.test.ts
// toast の設定の上書きが表示の値に効くことのテスト。実行: pnpm test src/lib/toast (node:test)
import { test } from "node:test";
import assert from "node:assert/strict";

import { toastConfig, toastConfigDef } from "./config";
import { createToastStore } from "./stores/internalStore";

test("上流の空の上書き(@lib-config/toast)では既定のまま", () => {
  assert.deepEqual(toastConfig, { duration: 3000, position: "bottom-center", size: "md", ariaLabel: "通知" });
});

test("上書きの値が show の既定の表示時間・位置・大きさに効く", () => {
  const store = createToastStore(toastConfigDef.compose({ duration: 5000, position: "top-center", size: "lg" }));
  store.getState().show({ message: "保存しました" });
  const toast = store.getState().toast;
  assert.equal(toast?.duration, 5000);
  assert.equal(toast?.position, "top-center");
  assert.equal(toast?.size, "lg");
});

test("show の options は設定より優先する", () => {
  const store = createToastStore(toastConfigDef.compose({ duration: 5000 }));
  store.getState().show({ message: "x", duration: 800, position: "center", size: "sm" });
  const toast = store.getState().toast;
  assert.equal(toast?.duration, 800);
  assert.equal(toast?.position, "center");
  assert.equal(toast?.size, "sm");
});

test("上書きの無いキーは既定のまま、読み上げの名前も上書きできる", () => {
  const config = toastConfigDef.compose({ ariaLabel: "お知らせ" });
  assert.equal(config.ariaLabel, "お知らせ");
  assert.equal(config.duration, 3000);
});
