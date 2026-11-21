// src/lib/firebase/server/credential.test.ts
// サービスアカウントの鍵が壊れているときの誤りの文に、鍵の値もその一部も出ないことの検査(Firebase に接続しない)。
// 設定を偽物に差し替え、鍵に目印の文字列を混ぜて getServerApp を呼ぶ。文は誤りの種類と設定の場所の案内だけを持つ。
// (package.json に type: module が無いので tsx は CJS として読む → before() で import)
import { before, mock, test } from "node:test";
import assert from "node:assert/strict";

const MARKER = "SECRET_MARKER_9f3a";
let key: string | undefined;

mock.module("../config", {
  namedExports: {
    firebaseConfig: {
      apiKey: "",
      authDomain: "",
      projectId: "",
      storageBucket: "",
      messagingSenderId: "",
      appId: "",
      measurementId: "",
      serviceAccountKey: () => key,
    },
  },
});

let server: typeof import("./app");
let errors: typeof import("../errors");
before(async () => {
  server = await import("./app");
  errors = await import("../errors");
});

/** getServerApp が投げた文を取り、目印も鍵の断片も無く、種類と案内があることを確かめる */
function assertSafeMessage(kind: RegExp) {
  let message = "";
  assert.throws(
    () => server.getServerApp(),
    (error: unknown) => {
      message = error instanceof Error ? error.message : String(error);
      return true;
    },
  );
  assert.ok(!message.includes(MARKER), `鍵の値が文に出ている: ${message}`);
  assert.ok(!message.includes("SECRET"), `鍵の断片が文に出ている: ${message}`);
  assert.match(message, kind);
  assert.match(message, /src\/config\/lib\/firebase\.config\.ts/);
  assert.match(message, /値は表示しません/);
}

test("JSON でない鍵: 「JSON として読めません」だけを言う", () => {
  key = `not-json ${MARKER}`;
  assertSafeMessage(/JSON として読めません/);
  key = `{"private_key": "${MARKER}", broken`;
  assertSafeMessage(/JSON として読めません/);
});

test("オブジェクトでない JSON: 種類だけを言う", () => {
  key = JSON.stringify([MARKER]);
  assertSafeMessage(/オブジェクトではありません/);
});

test("欄が欠けている鍵: 欠けている欄の名前だけを言う", () => {
  key = JSON.stringify({ type: "service_account", project_id: "demo", client_email: `${MARKER}@x.test` });
  assertSafeMessage(/欄が足りません\(private_key\)/);
});

test("private_key の形が正しくない鍵: 証明書を作れないことだけを言う", () => {
  key = JSON.stringify({
    type: "service_account",
    project_id: "demo",
    client_email: "svc@demo.iam.gserviceaccount.com",
    private_key: `-----BEGIN PRIVATE KEY-----\n${MARKER}\n-----END PRIVATE KEY-----\n`,
  });
  assertSafeMessage(/証明書を作れません/);
});

test("空の鍵は今までどおり FirebaseNotConfiguredError(server) のまま", () => {
  key = "  ";
  assert.throws(
    () => server.getServerApp(),
    (error: unknown) => error instanceof errors.FirebaseNotConfiguredError && error.side === "server",
  );
});
