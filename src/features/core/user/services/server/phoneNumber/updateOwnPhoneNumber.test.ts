// src/features/core/user/services/server/phoneNumber/updateOwnPhoneNumber.test.ts
//
// 本人の電話番号を SMS なしで書く口 (updateOwnPhoneNumber) の検査 (DB なし)。base と重複の確認を差し替える。
// - 形式が違えば 400 / 同じ番号なら書かない / 他の利用者の番号は 409 で書かない / 書けば phoneVerifiedAt は null / null で消す(重複の確認なし)
// 実行: pnpm test src/features/core/user/services/server/phoneNumber/updateOwnPhoneNumber.test.ts
// (package.json に type: module が無いので tsx は CJS として読む → before() で import)
import { before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";

import { DomainError } from "@/lib/errors";

const state = {
  current: null as Record<string, unknown> | null,
  updates: [] as Record<string, unknown>[],
  checked: [] as string[],
  taken: new Set<string>(),
};

mock.module("@/features/core/user/services/server/drizzleBase", {
  namedExports: {
    base: {
      get: async () => state.current,
      update: async (_id: string, data: Record<string, unknown>) => {
        state.updates.push(data);
        return { ...state.current, ...data };
      },
    },
  },
});
mock.module("@/features/core/user/services/server/helpers/assertPhoneAvailability", {
  namedExports: {
    assertPhoneAvailability: async ({ phoneNumber }: { phoneNumber: string }) => {
      state.checked.push(phoneNumber);
      if (state.taken.has(phoneNumber)) throw new DomainError("この電話番号は既に使用されています", { status: 409 });
    },
  },
});

let updateOwnPhoneNumber: typeof import("./updateOwnPhoneNumber").updateOwnPhoneNumber;
before(async () => {
  ({ updateOwnPhoneNumber } = await import("./updateOwnPhoneNumber"));
});

const verifiedAt = new Date("2026-11-01T00:00:00Z");
beforeEach(() => {
  state.current = { id: "u1", phoneNumber: "+819011112222", phoneVerifiedAt: verifiedAt };
  state.updates.length = 0;
  state.checked.length = 0;
  state.taken.clear();
});

const statusOf = async (run: () => Promise<unknown>) => {
  try {
    await run();
    return 0;
  } catch (e) {
    assert.ok(e instanceof DomainError);
    return e.status;
  }
};

test("E.164 でない番号は 400、書かない", async () => {
  assert.equal(await statusOf(() => updateOwnPhoneNumber({ userId: "u1", input: { phoneNumber: "090-1111-2222" } })), 400);
  assert.equal(await statusOf(() => updateOwnPhoneNumber({ userId: "u1", input: {} })), 400);
  assert.deepEqual(state.updates, []);
});

test("同じ番号なら書かず、今の値を返す(認証の印は残る)", async () => {
  const result = await updateOwnPhoneNumber({ userId: "u1", input: { phoneNumber: "+819011112222" } });
  assert.deepEqual(result, { phoneNumber: "+819011112222", phoneVerifiedAt: verifiedAt });
  assert.deepEqual(state.updates, []);
  assert.deepEqual(state.checked, []);
});

test("他の利用者の番号は 409、書かない", async () => {
  state.taken.add("+819033334444");
  assert.equal(await statusOf(() => updateOwnPhoneNumber({ userId: "u1", input: { phoneNumber: "+819033334444" } })), 409);
  assert.deepEqual(state.updates, []);
});

test("新しい番号は書き、phoneVerifiedAt は null(未認証)", async () => {
  const result = await updateOwnPhoneNumber({ userId: "u1", input: { phoneNumber: "+819055556666" } });
  assert.deepEqual(state.checked, ["+819055556666"]);
  assert.equal(state.updates.length, 1);
  assert.equal(state.updates[0].phoneNumber, "+819055556666");
  assert.equal(state.updates[0].phoneVerifiedAt, null);
  assert.deepEqual(result, { phoneNumber: "+819055556666", phoneVerifiedAt: null });
});

test("null で番号と認証の印を消す(重複の確認はしない)", async () => {
  const result = await updateOwnPhoneNumber({ userId: "u1", input: { phoneNumber: null } });
  assert.deepEqual(state.checked, []);
  assert.deepEqual(result, { phoneNumber: null, phoneVerifiedAt: null });
});

test("利用者がいなければ 404", async () => {
  state.current = null;
  assert.equal(await statusOf(() => updateOwnPhoneNumber({ userId: "u1", input: { phoneNumber: null } })), 404);
});
