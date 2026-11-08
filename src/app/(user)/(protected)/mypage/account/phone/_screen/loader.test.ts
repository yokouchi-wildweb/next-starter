// /mypage/account/phone の loader の行き先の検査(挙動の固定。guard・next/navigation・config・userService は偽物)。
// - 電話番号認証が無効 → /mypage/account(レコードの取得より前)/ 有効 → 番号と認証日時、レコード取得の行き先は /login
// 実行: pnpm test "src/app/(user)/(protected)/mypage/account/phone/_screen/loader.test.ts"
import { before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

// guard の createLoader は偽物: access の評価を飛ばし、key → load({ user }, ...key) を直に呼ぶ
let currentUser: Record<string, unknown> | null = null;
type Def = { key?: (props: unknown) => Promise<unknown[]>; load: (ctx: unknown, ...keys: unknown[]) => unknown };
const createLoader = (def: Def) => async (props: unknown) => {
  const keys = def.key ? await def.key(props) : [];
  return def.load({ user: currentUser }, ...keys);
};
mock.module("@/app/(user)/(protected)/guard", { namedExports: { createLoader } });

// redirect / notFound は投げる偽物(Next と同じく以降を実行しない)。行き先を記録する
class Redirected extends Error {
  constructor(readonly to: string) {
    super(`redirect ${to}`);
  }
}
class NotFound extends Error {}
mock.module(pathToFileURL(require.resolve("next/navigation")).href, {
  namedExports: {
    redirect: (to: string) => {
      throw new Redirected(to);
    },
    notFound: () => {
      throw new NotFound();
    },
  },
});

/** loader を呼び、redirect なら行き先、notFound なら "notFound"、それ以外は返り値 */
const outcome = async (run: () => Promise<unknown>) => {
  try {
    return { value: await run() };
  } catch (e) {
    if (e instanceof Redirected) return { redirect: e.to };
    if (e instanceof NotFound) return { notFound: true };
    throw e;
  }
};

const features = { user: { phoneVerificationEnabled: true } };
mock.module("@/config/app/app-features.config", { namedExports: { APP_FEATURES: features } });
const recordRedirects: string[] = [];
const verifiedAt = new Date("2026-11-01T00:00:00Z");
mock.module("@/features/core/user/services/server/userService", {
  namedExports: {
    requireUserRecord: async (_user: unknown, redirectTo: string) => {
      recordRedirects.push(redirectTo);
      return { phoneNumber: "+81000", phoneVerifiedAt: verifiedAt };
    },
  },
});

let load: typeof import("./loader").loadMyPageAccountPhoneScreen;
before(async () => {
  ({ loadMyPageAccountPhoneScreen: load } = await import("./loader"));
});
beforeEach(() => {
  currentUser = { userId: "u1", status: "active" };
  features.user.phoneVerificationEnabled = true;
  recordRedirects.length = 0;
});
const run = () => outcome(() => load({} as never));

test("無効 → /mypage/account、レコードは取らない", async () => {
  features.user.phoneVerificationEnabled = false;
  assert.deepEqual(await run(), { redirect: "/mypage/account" });
  assert.deepEqual(recordRedirects, []);
});

test("有効 → 番号と認証日時。レコードが無いときの行き先は /login", async () => {
  assert.deepEqual(await run(), { value: { phoneNumber: "+81000", phoneVerifiedAt: verifiedAt } });
  assert.deepEqual(recordRedirects, ["/login"]);
});
