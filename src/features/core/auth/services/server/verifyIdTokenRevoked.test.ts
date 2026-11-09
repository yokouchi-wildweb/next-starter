// src/features/core/auth/services/server/verifyIdTokenRevoked.test.ts
//
// Firebase ID トークンの検証が失効を確かめることの検査（Firebase 不要）。
// 1. src の verifyIdToken 呼び出しはすべて checkRevoked=true を渡す（呼び出しが増えても漏れない）
// 2. 失効したトークン（Admin SDK が auth/id-token-revoked を投げる）は既存の 401 の経路で拒否される
// (package.json に type: module が無いので tsx は CJS として読む → before() で import)
import { before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { DomainError } from "@/lib/errors";

const calls: unknown[][] = [];
let revoked = false;

mock.module("@/lib/firebase/server/app", {
  namedExports: {
    getServerAuth: () => ({
      verifyIdToken: async (...args: unknown[]) => {
        calls.push(args);
        if (revoked) {
          throw Object.assign(new Error("The Firebase ID token has been revoked."), {
            code: "auth/id-token-revoked",
          });
        }
        return { uid: "provider-uid", phone_number: "+819012345678" };
      },
    }),
  },
});
mock.module("@/features/core/user/services/server/userService", {
  namedExports: { userService: { findByProvider: async () => null } },
});
mock.module("@/features/core/user/services/server/registration", {
  namedExports: { preRegisterFromAuth: async () => ({ id: "u1" }) },
});
mock.module("@/features/core/user/services/server/phoneVerification", {
  namedExports: { updatePhoneVerified: async () => ({ phoneVerifiedAt: new Date() }) },
});

let preRegister: typeof import("./preRegistration").preRegister;
let verifyPhoneOtp: typeof import("@/features/core/phoneVerification/services/server/verifyPhoneOtp").verifyPhoneOtp;
before(async () => {
  ({ preRegister } = await import("./preRegistration"));
  ({ verifyPhoneOtp } = await import("@/features/core/phoneVerification/services/server/verifyPhoneOtp"));
});

beforeEach(() => {
  calls.length = 0;
  revoked = false;
  mock.method(console, "error", () => {});
});

const preRegisterInput = { providerType: "email", providerUid: "provider-uid", idToken: "token" };
const phoneInput = { userId: "u1", input: { phoneNumber: "+819012345678", idToken: "token" } };

async function assertRejected401(run: () => Promise<unknown>) {
  await assert.rejects(run, (error: unknown) => {
    assert.ok(error instanceof DomainError);
    assert.equal(error.status, 401);
    return true;
  });
}

test("preRegister は checkRevoked=true で検証し、失効したトークンを 401 で拒否する", async () => {
  revoked = true;
  await assertRejected401(() => preRegister(preRegisterInput));
  assert.deepEqual(calls, [["token", true]]);
});

test("verifyPhoneOtp は checkRevoked=true で検証し、失効したトークンを 401 で拒否する", async () => {
  revoked = true;
  await assertRejected401(() => verifyPhoneOtp(phoneInput));
  assert.deepEqual(calls, [["token", true]]);
});

/** src 以下の .ts / .tsx（テストを除く）を集める */
function listSources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "node_modules") continue;
      listSources(full, out);
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

test("src の Firebase Admin の verifyIdToken 呼び出しはすべて checkRevoked=true を渡す", () => {
  const srcRoot = path.resolve(__dirname, "../../../../..");
  const found: string[] = [];
  const missing: string[] = [];
  for (const file of listSources(srcRoot)) {
    const text = readFileSync(file, "utf8");
    // `auth.verifyIdToken(` の形だけを数える（lib/line の同名の自前関数は対象外）
    for (const match of text.matchAll(/\.verifyIdToken\(([^)]*)\)/g)) {
      const where = `${path.relative(srcRoot, file)}: ${match[0]}`;
      found.push(where);
      if (!/,\s*true\s*$/.test(match[1])) missing.push(where);
    }
  }
  assert.ok(found.length >= 4, `呼び出しが見つからない（検査の正規表現が古い可能性）: ${found.join(", ")}`);
  assert.deepEqual(missing, []);
});
