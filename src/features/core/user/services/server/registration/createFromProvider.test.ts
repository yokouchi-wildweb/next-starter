// src/features/core/user/services/server/registration/createFromProvider.test.ts
//
// 外部の認証の身元から利用者を引く・作る口 (createFromProvider) の検査 (DB なし)。
// db・名前の判定・状態の履歴・監査・ログインの記録・base を差し替える。
// - 新規: 名前の規則 → insert(active・email null・signupIp)→ 状態の履歴 → 監査 user.registered を同じ tx、tx の後に signup
// - 既存 active はそのまま / pending → user.registered / withdrawn → user.rejoined・signupIp・signup
// - 名前: 空なら既定名、unique 有効で使用中なら suffix、無効なら判定しない
// - (provider_type, provider_uid) の unique 違反は引き直して既存として返す。他のエラーはそのまま
// - tx を渡せばその中 (savepoint) で、渡さなければ自分で 1 つ開く
// 実行: pnpm test src/features/core/user/services/server/registration/createFromProvider.test.ts
// (package.json に type: module が無いので tsx は CJS として読む → before() で import)
import { before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";

type Row = Record<string, unknown> & { id: string; status: string };

const calls: string[] = [];
const state = {
  lookups: [] as Row[][],
  insertError: null as unknown,
  inserted: [] as Record<string, unknown>[],
  updated: [] as Array<{ id: string; data: Record<string, unknown> }>,
  takenNames: new Set<string>(),
  transitions: [] as Array<Record<string, unknown>>,
  audits: [] as Array<Record<string, unknown>>,
  loginEvents: [] as Array<Record<string, unknown>>,
};

const makeTx = (label: string): Record<string, unknown> => {
  const tx: Record<string, unknown> = {
    label,
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => {
            calls.push(`select:${label}`);
            return state.lookups.shift() ?? [];
          },
        }),
      }),
    }),
    insert: () => ({
      values: (values: Record<string, unknown>) => ({
        returning: async () => {
          calls.push(`insert:${label}`);
          if (state.insertError) throw state.insertError;
          state.inserted.push(values);
          return [{ id: "new-user", ...values }];
        },
      }),
    }),
    transaction: async (fn: (sp: unknown) => Promise<unknown>) => {
      calls.push(`savepoint:${label}`);
      return fn(makeTx(`${label}.sp`));
    },
  };
  return tx;
};

mock.module("@/lib/drizzle", {
  namedExports: {
    db: {
      transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
        calls.push("db.transaction");
        return fn(makeTx("own"));
      },
    },
  },
});
mock.module("@/features/core/user/services/server/helpers/nameAvailability", {
  namedExports: {
    lockUserName: async (executor: { label: string }, name: string) => {
      calls.push(`lock:${executor.label}:${name}`);
    },
    isUserNameTaken: async (name: string, params: { excludeUserId?: string }) => {
      calls.push(`taken?:${name}:${params.excludeUserId ?? "-"}`);
      return state.takenNames.has(name);
    },
    findAvailableSuffixedUserName: async (name: string, params: { lockCandidates?: boolean }) => {
      calls.push(`suffix:${name}:${params.lockCandidates}`);
      return `${name}_2`;
    },
  },
});
mock.module("@/features/core/user/services/server/statusHistory", {
  namedExports: {
    recordStatusTransition: async (input: Record<string, unknown> & { tx?: { label: string } }) => {
      calls.push(`transition:${input.tx?.label ?? "-"}`);
      state.transitions.push(input);
    },
  },
});
mock.module("@/features/core/auditLog/services/server", {
  namedExports: {
    auditLogger: {
      record: async (input: Record<string, unknown> & { tx?: { label: string } }) => {
        calls.push(`audit:${input.action}:${input.tx?.label ?? "-"}`);
        state.audits.push(input);
      },
    },
  },
});
mock.module("@/features/core/userLoginEvent/services/server", {
  namedExports: {
    recordLoginEvent: async (input: Record<string, unknown>) => {
      calls.push("loginEvent");
      state.loginEvents.push(input);
    },
  },
});
mock.module("@/features/core/user/services/server/drizzleBase", {
  namedExports: {
    base: {
      update: async (id: string, data: Record<string, unknown>, tx: { label: string }) => {
        calls.push(`update:${tx.label}`);
        state.updated.push({ id, data });
        return { id, ...data, providerType: "line" };
      },
      invalidateRequestMemo: () => {
        calls.push("invalidate");
      },
    },
  },
});

let m: typeof import("./createFromProvider");
/** 表示名の設定(合成済みの userConfig.name を書き換えて一意性の入切を切り替える) */
let nameConfig: { unique: { enabled: boolean } };
before(async () => {
  m = await import("./createFromProvider");
  nameConfig = (await import("@/features/user/config")).userConfig.name;
});

beforeEach(() => {
  calls.length = 0;
  state.lookups = [];
  state.insertError = null;
  state.inserted = [];
  state.updated = [];
  state.takenNames = new Set();
  state.transitions = [];
  state.audits = [];
  state.loginEvents = [];
  nameConfig.unique.enabled = false;
});

const input = (extra: Record<string, unknown> = {}) => ({
  providerType: "line" as const,
  providerUid: "U123",
  displayName: "たろう",
  ip: "203.0.113.1",
  ...extra,
});

const uniqueViolation = () => Object.assign(new Error("duplicate key"), { code: "23505" });

test("新規: active・email null・signupIp で作り、状態の履歴と監査は同じ tx、signup は tx の後", async () => {
  const result = await m.createFromProvider(input());

  assert.equal(result.isNewUser, true);
  assert.equal(result.isRejoin, false);
  assert.equal(result.user.id, "new-user");
  const values = state.inserted[0];
  assert.equal(values.status, "active");
  assert.equal(values.role, "user");
  assert.equal(values.email, null);
  assert.equal(values.isDemo, false);
  assert.equal(values.signupIp, "203.0.113.1");
  assert.equal(values.name, "たろう");
  assert.deepEqual(state.transitions[0], {
    userId: "new-user",
    fromStatus: null,
    toStatus: "active",
    trigger: "signup_activate",
    tx: state.transitions[0].tx,
  });
  assert.equal(state.audits[0].action, "user.registered");
  assert.deepEqual(state.audits[0].actorOverride, { actorType: "user", actorId: "new-user" });
  assert.deepEqual(calls, [
    "db.transaction",
    "savepoint:own",
    "select:own.sp",
    "insert:own.sp",
    "transition:own.sp",
    "audit:user.registered:own.sp",
    "invalidate",
    "loginEvent",
  ]);
  assert.equal(state.loginEvents[0].eventType, "signup");
  assert.equal(state.loginEvents[0].ip, "203.0.113.1");
});

test("既存 active: 作らず状態も変えずに返す", async () => {
  state.lookups.push([{ id: "u1", status: "active", name: "既存" }]);
  const result = await m.createFromProvider(input());

  assert.deepEqual(result, { user: { id: "u1", status: "active", name: "既存" }, isNewUser: false, isRejoin: false });
  assert.equal(state.inserted.length, 0);
  assert.equal(state.updated.length, 0);
  assert.equal(state.audits.length, 0);
  assert.equal(state.loginEvents.length, 0);
});

test("既存 security_locked・suspended なども返すだけ (判断は establishSession)", async () => {
  for (const status of ["security_locked", "suspended", "inactive"]) {
    state.lookups.push([{ id: "u1", status }]);
    const result = await m.createFromProvider(input());
    assert.equal(result.user.status, status);
  }
  assert.equal(state.updated.length, 0);
});

test("pending: active にして user.registered、signup は記録しない", async () => {
  state.lookups.push([{ id: "u2", status: "pending", email: null }]);
  const result = await m.createFromProvider(input());

  assert.equal(result.isNewUser, false);
  assert.equal(result.isRejoin, false);
  assert.equal(state.updated[0].data.status, "active");
  assert.equal(state.updated[0].data.name, "たろう");
  assert.equal(state.updated[0].data.deletedAt, null);
  assert.equal("signupIp" in state.updated[0].data, false);
  assert.equal(state.transitions[0].fromStatus, "pending");
  assert.equal(state.transitions[0].trigger, "signup_activate");
  assert.equal(state.audits[0].action, "user.registered");
  assert.equal(state.loginEvents.length, 0);
});

test("withdrawn: 再登録の規則で active に、user.rejoined・signupIp・signup", async () => {
  state.lookups.push([{ id: "u3", status: "withdrawn", email: "a@example.com" }]);
  const result = await m.createFromProvider(input());

  assert.equal(result.isNewUser, false);
  assert.equal(result.isRejoin, true);
  assert.equal(state.updated[0].data.signupIp, "203.0.113.1");
  assert.equal(state.updated[0].data.email, "a@example.com");
  assert.equal(state.transitions[0].fromStatus, "withdrawn");
  assert.equal(state.audits[0].action, "user.rejoined");
  assert.deepEqual(state.audits[0].before, { status: "withdrawn" });
  assert.equal(state.loginEvents.length, 1);
});

test("名前: 空・使えない文字だけなら既定名", async () => {
  await m.createFromProvider(input({ displayName: "​\n " }));
  await m.createFromProvider(input({ displayName: null }));
  assert.equal(state.inserted[0].name, m.PROVIDER_USER_DEFAULT_NAME);
  assert.equal(state.inserted[1].name, m.PROVIDER_USER_DEFAULT_NAME);
});

test("名前: unique 無効なら判定もロックもしない (重複のまま)", async () => {
  state.takenNames.add("たろう");
  await m.createFromProvider(input());
  assert.equal(state.inserted[0].name, "たろう");
  assert.equal(calls.some((c) => c.startsWith("lock:") || c.startsWith("taken?:")), false);
});

test("名前: unique 有効で使用中 (予約名を含む) なら lock の後に suffix", async () => {
  nameConfig.unique.enabled = true;
  state.takenNames.add("たろう");
  await m.createFromProvider(input());
  assert.equal(state.inserted[0].name, "たろう_2");
  assert.deepEqual(
    calls.filter((c) => /^(lock|taken\?|suffix):/.test(c)),
    ["lock:own.sp:たろう", "taken?:たろう:-", "suffix:たろう:true"],
  );
});

test("名前: unique 有効で空いていればそのまま。有効化のときは自分を除いて判定", async () => {
  nameConfig.unique.enabled = true;
  await m.createFromProvider(input());
  assert.equal(state.inserted[0].name, "たろう");

  state.lookups.push([{ id: "u2", status: "pending", email: null }]);
  await m.createFromProvider(input());
  assert.ok(calls.includes("taken?:たろう:u2"));
});

test("unique 違反 (同時の作成): 引き直して既存として返す", async () => {
  state.insertError = uniqueViolation();
  state.lookups.push([], [{ id: "u9", status: "active" }]);
  const result = await m.createFromProvider(input());

  assert.deepEqual(result, { user: { id: "u9", status: "active" }, isNewUser: false, isRejoin: false });
  assert.equal(state.loginEvents.length, 0);
  assert.deepEqual(calls.filter((c) => c.startsWith("select:")), ["select:own.sp", "select:own"]);
});

test("unique 違反で引き直しても無い・他の DB エラー: そのまま投げる", async () => {
  state.insertError = uniqueViolation();
  state.lookups.push([], []);
  await assert.rejects(m.createFromProvider(input()), /duplicate key/);

  state.insertError = Object.assign(new Error("boom"), { code: "57014" });
  await assert.rejects(m.createFromProvider(input()), /boom/);
});

test("tx を渡せば自分で開かずその中 (savepoint) で行う", async () => {
  const callerTx = makeTx("caller");
  await m.createFromProvider(input({ tx: callerTx }));

  assert.equal(calls.includes("db.transaction"), false);
  assert.equal(calls[0], "savepoint:caller");
  assert.ok(calls.includes("insert:caller.sp"));
  assert.ok(calls.includes("transition:caller.sp"));
  assert.ok(calls.includes("audit:user.registered:caller.sp"));
});

test("role: 省略 = 既定のロール、無いロールは 400 で何も書かない", async () => {
  await assert.rejects(
    m.createFromProvider(input({ role: "no-such-role" })),
    (error: unknown) => (error as { status?: number }).status === 400,
  );
  assert.equal(calls.length, 0);
});
