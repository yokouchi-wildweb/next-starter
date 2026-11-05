// src/components/Form/backgroundFailure.test.ts
// 裏の処理が失敗した欄で送信を止める判定のテスト。実行: pnpm test:form-background-failure
import assert from "node:assert/strict";
import { test } from "node:test";

import { hasBackgroundFailure } from "./backgroundFailure";

test("失敗したままの欄が 1 つでもあれば止める", () => {
  assert.equal(hasBackgroundFailure([{ hasFailed: false }, { hasFailed: true }]), true);
});

test("やり直し・取り消しで全部 false に戻れば止めない", () => {
  assert.equal(hasBackgroundFailure([{ hasFailed: false }, { hasFailed: false }]), false);
});

test("hasFailed の無い古い登録・FieldRenderer の状態が無いときは止めない", () => {
  assert.equal(hasBackgroundFailure([null, undefined, {}]), false);
  assert.equal(hasBackgroundFailure([]), false);
});
