// src/lib/storage/client/pickerAccept.test.ts
// pickerAcceptFor（ファイル選択の accept を用途の metadata に合わせる）の単体テスト。
// 実行: pnpm test:storage-client

import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { pickerAcceptFor } from "./pickerAccept";

const STRIP_LIST = "image/jpeg,image/png,image/webp,image/gif,image/avif";

describe("pickerAcceptFor", () => {
  test("strip（省略を含む）では image/* を受け付ける画像の型の列挙にする", () => {
    assert.equal(pickerAcceptFor("image/*", "strip"), STRIP_LIST);
    assert.equal(pickerAcceptFor("image/*", undefined), STRIP_LIST);
    assert.equal(pickerAcceptFor(" Image/* ", undefined), STRIP_LIST);
  });

  test("画像以外の型と拡張子はそのまま残す", () => {
    assert.equal(pickerAcceptFor("image/*,video/*", "strip"), `${STRIP_LIST},video/*`);
    assert.equal(pickerAcceptFor("image/*,.heic,application/pdf", "strip"), `${STRIP_LIST},.heic,application/pdf`);
  });

  test("strip で受け付けない画像の型は外し、重複はまとめる", () => {
    assert.equal(pickerAcceptFor("image/png,image/heic,image/svg+xml", "strip"), "image/png");
    assert.equal(pickerAcceptFor("image/png,image/*", "strip"), "image/png,image/jpeg,image/webp,image/gif,image/avif");
  });

  test("外した結果が空なら、空（何でも選べる）にせず受け付ける画像の型にする", () => {
    assert.equal(pickerAcceptFor("image/heic", "strip"), STRIP_LIST);
  });

  test("keep と accept なしは変えない", () => {
    assert.equal(pickerAcceptFor("image/*", "keep"), "image/*");
    assert.equal(pickerAcceptFor("image/heic,image/*", "keep"), "image/heic,image/*");
    assert.equal(pickerAcceptFor(undefined, "strip"), undefined);
    assert.equal(pickerAcceptFor("", "strip"), "");
  });
});
