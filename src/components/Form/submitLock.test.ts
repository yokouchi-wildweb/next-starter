// src/components/Form/submitLock.test.ts
// AppForm の二重送信ロックのテスト（送信中の 2 回目を捨てる・成功 / 失敗の後に外れる）。
// 実行: pnpm test src/components/Form/submitLock.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { createSubmitLock } from "./submitLock";

/** 外から resolve / reject できる Promise */
const deferred = () => {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const fakeEvent = () => {
  const event = { prevented: 0, preventDefault: () => void event.prevented++ };
  return event;
};

test("送信中の 2 回目は handler を呼ばず、preventDefault だけする", async () => {
  const lock = createSubmitLock();
  const gate = deferred();
  let calls = 0;
  const submit = lock.wrap(async () => {
    calls++;
    await gate.promise;
  });

  const first = submit(fakeEvent());
  const second = fakeEvent();
  await submit(second);

  assert.equal(calls, 1);
  assert.equal(second.prevented, 1);
  assert.equal(lock.isLocked(), true);

  gate.resolve();
  await first;
  assert.equal(lock.isLocked(), false);
});

test("成功の後はロックが外れ、次の送信が通る", async () => {
  const lock = createSubmitLock();
  let calls = 0;
  const submit = lock.wrap(async () => {
    calls++;
  });

  await submit(fakeEvent());
  await submit(fakeEvent());

  assert.equal(calls, 2);
  assert.equal(lock.isLocked(), false);
});

test("失敗（例外）の後もロックが外れ、例外はそのまま投げる", async () => {
  const lock = createSubmitLock();
  let calls = 0;
  const submit = lock.wrap(async () => {
    calls++;
    if (calls === 1) throw new Error("boom");
  });

  await assert.rejects(submit(fakeEvent()), /boom/);
  assert.equal(lock.isLocked(), false);

  await submit(fakeEvent());
  assert.equal(calls, 2);
});

test("event が無い呼び出しでも動く", async () => {
  const lock = createSubmitLock();
  let calls = 0;
  const submit = lock.wrap(async () => {
    calls++;
  });

  await submit(undefined);
  assert.equal(calls, 1);
});
