// src/features/core/auth/hooks/signup/sendFlow.test.ts
//
// メール認証の送信・事前登録の送信の流れ（sendFlow）の単体テスト。依存はすべて偽物を渡す。
// 実行: pnpm test:auth-registration-flow

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { HttpError } from "@/lib/errors";

import {
  EMAIL_ALREADY_REGISTERED_MESSAGE,
  EMAIL_SEND_FAILED_MESSAGE,
  retryEmailSendWithV2,
  submitEmailSend,
  type EmailSendDeps,
  type EmailSendOptions,
} from "./sendFlow";

const V2_ERROR = { v2: true };

function makeDeps(opts: {
  exists?: boolean;
  sendImpl?: (email: string, options?: EmailSendOptions) => Promise<unknown>;
  recaptcha?: boolean;
  pendingEmail?: string;
} = {}) {
  const calls: string[] = [];
  const sent: Array<{ email: string; options?: EmailSendOptions }> = [];
  const deps: EmailSendDeps = {
    checkExists: async (email) => {
      calls.push(`check:${email}`);
      return { exists: opts.exists ?? false };
    },
    send: async (email, options) => {
      calls.push("send");
      sent.push({ email, options });
      return opts.sendImpl ? opts.sendImpl(email, options) : undefined;
    },
    saveEmail: (email) => {
      calls.push(`save:${email}`);
    },
    navigate: () => {
      calls.push("navigate");
    },
  };
  if (opts.recaptcha !== false) {
    deps.getRecaptchaToken = async () => "v3-token";
    deps.isV2ChallengeRequired = (error) => error === V2_ERROR;
    deps.getPendingEmail = () => opts.pendingEmail ?? " typed@example.com ";
  }
  return { deps, calls, sent };
}

describe("submitEmailSend (メール認証)", () => {
  it("登録済み = root エラー、保存も送信もしない", async () => {
    const { deps, calls } = makeDeps({ exists: true });
    const outcome = await submitEmailSend(" a@example.com ", deps);
    assert.deepEqual(outcome, { kind: "error", message: EMAIL_ALREADY_REGISTERED_MESSAGE });
    assert.deepEqual(calls, ["check:a@example.com"]);
  });

  it("成功: v3 で送信 → メール保存 → 遷移", async () => {
    const { deps, calls, sent } = makeDeps();
    const outcome = await submitEmailSend(" a@example.com ", deps);
    assert.deepEqual(outcome, { kind: "sent" });
    assert.deepEqual(calls, ["check:a@example.com", "save:a@example.com", "send", "navigate"]);
    assert.deepEqual(sent[0], { email: "a@example.com", options: { recaptchaToken: "v3-token" } });
  });

  it("v2 要求 → form の値を取り直して保留 → v2 トークンで再送 → 遷移", async () => {
    let first = true;
    const { deps, calls, sent } = makeDeps({
      sendImpl: async () => {
        if (first) {
          first = false;
          throw V2_ERROR;
        }
      },
    });
    const outcome = await submitEmailSend("a@example.com", deps);
    assert.deepEqual(outcome, { kind: "v2Required", error: V2_ERROR, pendingEmail: "typed@example.com" });
    assert.ok(!calls.includes("navigate"));

    const retried = await retryEmailSendWithV2("typed@example.com", "v2-token", deps);
    assert.deepEqual(retried, { kind: "sent" });
    assert.deepEqual(sent[1], { email: "typed@example.com", options: { recaptchaV2Token: "v2-token" } });
    assert.equal(calls.at(-1), "navigate");
  });

  it("失敗 = root エラー（HttpError の文言 / 既定の文言）、遷移しない", async () => {
    const http = makeDeps({
      sendImpl: async () => {
        throw new HttpError({ message: "送れません", status: 500 });
      },
    });
    assert.deepEqual(await submitEmailSend("a@example.com", http.deps), { kind: "error", message: "送れません" });
    assert.ok(!http.calls.includes("navigate"));

    const unknown = makeDeps({
      sendImpl: async () => {
        throw "boom";
      },
    });
    assert.deepEqual(await submitEmailSend("a@example.com", unknown.deps), {
      kind: "error",
      message: EMAIL_SEND_FAILED_MESSAGE,
    });
  });

  it("v2 再送の失敗 = root エラー、遷移しない", async () => {
    const { deps, calls } = makeDeps({
      sendImpl: async () => {
        throw "boom";
      },
    });
    assert.deepEqual(await retryEmailSendWithV2("a@example.com", "t", deps), {
      kind: "error",
      message: EMAIL_SEND_FAILED_MESSAGE,
    });
    assert.deepEqual(calls, ["send"]);
  });
});

describe("submitEmailSend (事前登録: reCAPTCHA なし)", () => {
  it("登録済み = root エラー", async () => {
    const { deps, calls } = makeDeps({ exists: true, recaptcha: false });
    assert.deepEqual(await submitEmailSend("a@example.com", deps), {
      kind: "error",
      message: EMAIL_ALREADY_REGISTERED_MESSAGE,
    });
    assert.deepEqual(calls, ["check:a@example.com"]);
  });

  it("成功: 保存 → 送信（options なし）→ 遷移", async () => {
    const { deps, calls, sent } = makeDeps({ recaptcha: false });
    assert.deepEqual(await submitEmailSend(" a@example.com", deps), { kind: "sent" });
    assert.deepEqual(calls, ["check:a@example.com", "save:a@example.com", "send", "navigate"]);
    assert.deepEqual(sent[0], { email: "a@example.com", options: undefined });
  });

  it("失敗 = root エラー（v2 の判定なしでも同じ）", async () => {
    const { deps } = makeDeps({
      recaptcha: false,
      sendImpl: async () => {
        throw V2_ERROR;
      },
    });
    assert.deepEqual(await submitEmailSend("a@example.com", deps), {
      kind: "error",
      message: EMAIL_SEND_FAILED_MESSAGE,
    });
  });
});
