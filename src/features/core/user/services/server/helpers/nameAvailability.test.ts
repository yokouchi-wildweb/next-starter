// src/features/core/user/services/server/helpers/nameAvailability.test.ts
// 表示名の一意性ガードのうち DB なしで検証できる部分の単体テスト
// (ガード要否の判定 / サフィックス採番の長さ予算 / isUserNamesTaken の JS 側厳密判定)
// 同時書き込みの直列化と SQL の判定スコープ (退会済み・デモ除外) は実 PostgreSQL が必要なため対象外
// 実行: pnpm test:user-name-availability

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildSuffixedUserName,
  isUserNamesTaken,
  resolveUserNameForGuard,
} from "./nameAvailability";
import type { DbExecutor } from "@/lib/crud/drizzle/types";

/** select().from().where() の結果だけを差し替える executor */
function fakeExecutor(names: (string | null)[]): DbExecutor {
  const rows = names.map((name) => ({ name }));
  return {
    select: () => ({ from: () => ({ where: async () => rows }) }),
  } as unknown as DbExecutor;
}

test("resolveUserNameForGuard: 表示名が変わる場合は新しい名前を返す", () => {
  assert.equal(
    resolveUserNameForGuard({ name: "太郎", isDemo: false }, { name: "花子" }),
    "花子",
  );
});

test("resolveUserNameForGuard: 表示名もデモフラグも変わらない場合は null", () => {
  assert.equal(resolveUserNameForGuard({ name: "太郎", isDemo: false }, {}), null);
  assert.equal(
    resolveUserNameForGuard({ name: "太郎", isDemo: false }, { name: "太郎", isDemo: false }),
    null,
  );
});

test("resolveUserNameForGuard: デモ → 通常は名前が同じでも現在の名前で検証する (回帰: 重複のまま有効化)", () => {
  assert.equal(
    resolveUserNameForGuard({ name: "太郎", isDemo: true }, { isDemo: false }),
    "太郎",
  );
  assert.equal(
    resolveUserNameForGuard({ name: "太郎", isDemo: true }, { name: "花子", isDemo: false }),
    "花子",
  );
});

test("resolveUserNameForGuard: 通常 → デモ、デモのまま名前据え置きはガード不要", () => {
  assert.equal(resolveUserNameForGuard({ name: "太郎", isDemo: false }, { isDemo: true }), null);
  assert.equal(resolveUserNameForGuard({ name: "太郎", isDemo: true }, { isDemo: true }), null);
});

test("buildSuffixedUserName: maxLength に収まるようベース名を切り詰める", () => {
  assert.equal(buildSuffixedUserName("太郎", 2, 20), "太郎_2");
  assert.equal(buildSuffixedUserName("  太郎  ", 3, 20), "太郎_3");
  assert.equal(buildSuffixedUserName("abcdefghij", 2, 8), "abcdef_2");
  assert.equal(buildSuffixedUserName("abcdefghij", 10, 8), "abcde_10");
  // サロゲートペアを途中で切らない
  assert.equal(buildSuffixedUserName("😀😀😀😀", 2, 4), "😀😀_2");
});

test("buildSuffixedUserName: 予算が尽きてもベース名を最低 1 文字残す", () => {
  assert.equal(buildSuffixedUserName("abc", 100, 3), "a_100");
});

test("isUserNamesTaken: 前後空白と大文字小文字を無視して使用中を判定する", async () => {
  const taken = await isUserNamesTaken(["taro", "  TARO ", "Hanako"], {
    executor: fakeExecutor(["Taro", null]),
  });
  assert.deepEqual([...taken].sort(), ["  TARO ", "taro"]);
});

test("isUserNamesTaken: 空・空白のみの名前は DB を引かず使用中にしない", async () => {
  const executor = {
    select: () => {
      throw new Error("空入力で DB を引いてはいけない");
    },
  } as unknown as DbExecutor;
  const taken = await isUserNamesTaken(["", "   "], { executor });
  assert.equal(taken.size, 0);
});
