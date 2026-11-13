// src/features/core/auth/hooks/registration/submitFlow.test.ts
//
// 本登録の送信の流れ（submitFlow）の単体テスト。依存はすべて偽物を渡す。
// 実行: pnpm test src/features/core/auth/hooks/registration/submitFlow.test.ts

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { HttpError } from "@/lib/errors";
import type { RegistrationInput, RegistrationOptions } from "@/features/core/auth/hooks/useRegistration";

import {
  emailRegistrationVariant,
  oauthRegistrationVariant,
  REGISTRATION_COMPLETE_PATH,
  REGISTRATION_FAILED_MESSAGE,
  retryRegistrationWithV2,
  submitRegistration,
  type RegistrationAuthUser,
  type RegistrationFormValuesBase,
  type RegistrationSubmitDeps,
} from "./submitFlow";

const V2_ERROR = { v2: true };

type Calls = string[];

function makeUser(overrides: Partial<RegistrationAuthUser> = {}): RegistrationAuthUser {
  return {
    uid: "uid-1",
    email: "a@example.com",
    providerData: [{ providerId: "google.com" }],
    getIdToken: async () => "id-token",
    ...overrides,
  };
}

function makeDeps<TValues extends RegistrationFormValuesBase>(
  values: TValues,
  opts: {
    user?: RegistrationAuthUser | null;
    registerImpl?: (payload: RegistrationInput, options?: RegistrationOptions) => Promise<unknown>;
    submittable?: boolean;
  } = {},
) {
  const calls: Calls = [];
  const registered: Array<{ payload: RegistrationInput; options?: RegistrationOptions }> = [];
  const deps: RegistrationSubmitDeps<TValues> = {
    getCurrentUser: () => (opts.user === undefined ? makeUser() : opts.user),
    assertInviteCodeSubmittable: () => opts.submittable ?? true,
    resolveInviteCodePayload: (code) => (code ? code : undefined),
    getRecaptchaToken: async () => "v3-token",
    register: async (payload, options) => {
      calls.push("register");
      registered.push({ payload, options });
      return opts.registerImpl ? opts.registerImpl(payload, options) : {};
    },
    refreshSession: async () => {
      calls.push("refreshSession");
    },
    navigate: (path) => {
      calls.push(`navigate:${path}`);
    },
    isV2ChallengeRequired: (error) => error === V2_ERROR,
    getFormValues: () => values,
  };
  return { deps, calls, registered };
}

const emailValues = {
  email: "A@example.com ",
  name: "taro",
  password: "password123",
  role: "user",
  profileData: {},
  inviteCode: "",
};

const oauthValues = {
  email: "a@example.com",
  name: "taro",
  role: "user",
  profileData: {},
  inviteCode: "INV1",
};

describe("submitRegistration (email)", () => {
  it("成功: v3 で register → refreshSession → 完了画面", async () => {
    const { deps, calls, registered } = makeDeps(emailValues);
    const outcome = await submitRegistration(emailValues, emailRegistrationVariant, deps);
    assert.deepEqual(outcome, { kind: "success" });
    assert.deepEqual(calls, ["register", "refreshSession", `navigate:${REGISTRATION_COMPLETE_PATH}`]);
    assert.deepEqual(registered[0].options, { recaptchaToken: "v3-token" });
    assert.deepEqual(registered[0].payload, {
      providerType: "email",
      providerUid: "uid-1",
      idToken: "id-token",
      email: emailValues.email,
      name: "taro",
      password: "password123",
      role: "user",
      profileData: {},
      inviteCode: undefined,
    });
  });

  it("宣伝の同意: フォームに項目がある時だけ送る(false も送る、保留 payload にも入る)", async () => {
    const values = { ...emailValues, marketingConsent: false };
    const { deps, registered } = makeDeps(values, {
      registerImpl: async () => {
        throw V2_ERROR;
      },
    });
    const outcome = await submitRegistration(values, emailRegistrationVariant, deps);
    assert.equal(registered[0].payload.marketingConsent, false);
    const pending = (outcome as { pendingPayload: RegistrationInput | null }).pendingPayload;
    assert.equal(pending?.marketingConsent, false);
    // 項目の無い上流のフォームは鍵ごと送らない
    const plain = makeDeps(emailValues);
    await submitRegistration(emailValues, emailRegistrationVariant, plain.deps);
    assert.ok(!("marketingConsent" in plain.registered[0].payload));
  });

  it("セッション無し = 401 の文言で root エラー、送信しない", async () => {
    const { deps, calls } = makeDeps(emailValues, { user: null });
    const outcome = await submitRegistration(emailValues, emailRegistrationVariant, deps);
    assert.deepEqual(outcome, { kind: "error", message: emailRegistrationVariant.missingUserMessage });
    assert.deepEqual(calls, []);
  });

  it("メール不一致 = 400 の文言、送信しない", async () => {
    const { deps, calls } = makeDeps(emailValues, { user: makeUser({ email: "b@example.com" }) });
    const outcome = await submitRegistration(emailValues, emailRegistrationVariant, deps);
    assert.equal(outcome.kind, "error");
    assert.match((outcome as { message: string }).message, /一致しません/);
    assert.deepEqual(calls, []);
  });

  it("未適用の招待コード = blocked、送信しない", async () => {
    const { deps, calls } = makeDeps(emailValues, { submittable: false });
    const outcome = await submitRegistration(emailValues, emailRegistrationVariant, deps);
    assert.deepEqual(outcome, { kind: "blocked" });
    assert.deepEqual(calls, []);
  });

  it("v2 要求 → 保留 payload（form の値から取り直す）→ v2 トークンで再送 → 成功", async () => {
    let first = true;
    const { deps, calls, registered } = makeDeps(emailValues, {
      registerImpl: async () => {
        if (first) {
          first = false;
          throw V2_ERROR;
        }
        return {};
      },
    });
    const outcome = await submitRegistration(emailValues, emailRegistrationVariant, deps);
    assert.equal(outcome.kind, "v2Required");
    const pending = (outcome as { pendingPayload: RegistrationInput | null }).pendingPayload;
    assert.ok(pending);
    assert.equal(pending.providerType, "email");
    assert.equal(pending.password, "password123");
    assert.deepEqual(calls, ["register"]);

    const retried = await retryRegistrationWithV2(pending, "v2-token", deps);
    assert.deepEqual(retried, { kind: "success" });
    assert.deepEqual(registered[1].options, { recaptchaV2Token: "v2-token" });
    assert.deepEqual(registered[1].payload, pending);
    assert.deepEqual(calls, ["register", "register", "refreshSession", `navigate:${REGISTRATION_COMPLETE_PATH}`]);
  });

  it("429 silent = root エラー（サーバーの文言）", async () => {
    const { deps } = makeDeps(emailValues, {
      registerImpl: async () => {
        throw new HttpError({ message: "しばらくお待ちください", status: 429, responseData: { silent: true } });
      },
    });
    const outcome = await submitRegistration(emailValues, emailRegistrationVariant, deps);
    assert.deepEqual(outcome, { kind: "rateLimitSilent", message: "しばらくお待ちください" });
  });

  it("429 非 silent = 警告モーダル", async () => {
    const { deps, calls } = makeDeps(emailValues, {
      registerImpl: async () => {
        throw new HttpError({ message: "too many", status: 429, responseData: { silent: false } });
      },
    });
    const outcome = await submitRegistration(emailValues, emailRegistrationVariant, deps);
    assert.deepEqual(outcome, { kind: "rateLimitWarning" });
    assert.deepEqual(calls, ["register"]);
  });

  it("他のエラー = root エラー（HttpError の文言 / 既定の文言）", async () => {
    const http = makeDeps(emailValues, {
      registerImpl: async () => {
        throw new HttpError({ message: "サーバーの文言", status: 500 });
      },
    });
    assert.deepEqual(await submitRegistration(emailValues, emailRegistrationVariant, http.deps), {
      kind: "error",
      message: "サーバーの文言",
    });
    const unknown = makeDeps(emailValues, {
      registerImpl: async () => {
        throw "boom";
      },
    });
    assert.deepEqual(await submitRegistration(emailValues, emailRegistrationVariant, unknown.deps), {
      kind: "error",
      message: REGISTRATION_FAILED_MESSAGE,
    });
  });

  it("v2 再送の 429 / 他のエラーも同じに分ける", async () => {
    const pending = { providerType: "email" } as RegistrationInput;
    const silent = makeDeps(emailValues, {
      registerImpl: async () => {
        throw new HttpError({ message: "wait", status: 429, responseData: { silent: true } });
      },
    });
    assert.deepEqual(await retryRegistrationWithV2(pending, "t", silent.deps), {
      kind: "rateLimitSilent",
      message: "wait",
    });
    const other = makeDeps(emailValues, {
      registerImpl: async () => {
        throw "boom";
      },
    });
    assert.deepEqual(await retryRegistrationWithV2(pending, "t", other.deps), {
      kind: "error",
      message: REGISTRATION_FAILED_MESSAGE,
    });
    assert.deepEqual(other.calls, ["register"]);
  });
});

describe("submitRegistration (oauth)", () => {
  it("成功: providerType = provider、password なし", async () => {
    const { deps, calls, registered } = makeDeps(oauthValues);
    const outcome = await submitRegistration(oauthValues, oauthRegistrationVariant, deps);
    assert.deepEqual(outcome, { kind: "success" });
    assert.deepEqual(calls, ["register", "refreshSession", `navigate:${REGISTRATION_COMPLETE_PATH}`]);
    assert.deepEqual(registered[0].payload, {
      providerType: "google.com",
      providerUid: "uid-1",
      idToken: "id-token",
      email: "a@example.com",
      name: "taro",
      role: "user",
      profileData: {},
      inviteCode: "INV1",
    });
  });

  it("セッション無し = 401 の文言", async () => {
    const { deps, calls } = makeDeps(oauthValues, { user: null });
    const outcome = await submitRegistration(oauthValues, oauthRegistrationVariant, deps);
    assert.deepEqual(outcome, { kind: "error", message: oauthRegistrationVariant.missingUserMessage });
    assert.deepEqual(calls, []);
  });

  it("provider 不正 = 400 の文言、送信しない", async () => {
    for (const providerData of [[], [{ providerId: "unknown.example" }]]) {
      const { deps, calls } = makeDeps(oauthValues, { user: makeUser({ providerData }) });
      const outcome = await submitRegistration(oauthValues, oauthRegistrationVariant, deps);
      assert.equal(outcome.kind, "error");
      assert.match((outcome as { message: string }).message, /サードパーティの認証情報/);
      assert.deepEqual(calls, []);
    }
  });

  it("v2 要求で provider が取れなければ保留しない", async () => {
    let user: RegistrationAuthUser | null = makeUser();
    const { deps } = makeDeps(oauthValues, {
      registerImpl: async () => {
        user = null;
        throw V2_ERROR;
      },
    });
    deps.getCurrentUser = () => user;
    const outcome = await submitRegistration(oauthValues, oauthRegistrationVariant, deps);
    assert.deepEqual(outcome, { kind: "v2Required", error: V2_ERROR, pendingPayload: null });
  });
});
