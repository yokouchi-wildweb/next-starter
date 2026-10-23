// scripts/storage/iamGrant.test.ts
//
// storage:setup の 403 の案内（付与の 1 行）の組み立てを確かめる。pnpm test:storage-setup

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatIamGrantGuide, iamConsoleUrl, iamGrantCommand, resolveIamGrantTarget } from "./iamGrant";

const KEY = JSON.stringify({
  type: "service_account",
  project_id: "key-project",
  client_email: "firebase-adminsdk-fbsvc@key-project.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n",
});

describe("resolveIamGrantTarget", () => {
  it("キーからプロジェクトとサービスアカウントを取る", () => {
    assert.deepEqual(resolveIamGrantTarget({ MY_SERVICE_ACCOUNT_KEY: KEY }), {
      projectId: "key-project",
      clientEmail: "firebase-adminsdk-fbsvc@key-project.iam.gserviceaccount.com",
    });
  });

  it("改行や前後の空白を含むキーも読める", () => {
    const pretty = `\n  ${JSON.stringify(JSON.parse(KEY), null, 2).replace(/\n/g, "\r\n")}  \n`;
    assert.equal(resolveIamGrantTarget({ MY_SERVICE_ACCOUNT_KEY: pretty }).projectId, "key-project");
  });

  it("NEXT_PUBLIC_FIREBASE_PROJECT_ID をキーの project_id より優先する（firebase-admin と同じ）", () => {
    const target = resolveIamGrantTarget({ MY_SERVICE_ACCOUNT_KEY: KEY, NEXT_PUBLIC_FIREBASE_PROJECT_ID: " env-project " });
    assert.equal(target.projectId, "env-project");
  });

  it("キーが空・壊れているときは null", () => {
    assert.deepEqual(resolveIamGrantTarget({}), { projectId: null, clientEmail: null });
    assert.deepEqual(resolveIamGrantTarget({ MY_SERVICE_ACCOUNT_KEY: "{not json" }), { projectId: null, clientEmail: null });
    assert.deepEqual(resolveIamGrantTarget({ MY_SERVICE_ACCOUNT_KEY: "{not json", NEXT_PUBLIC_FIREBASE_PROJECT_ID: "p" }), {
      projectId: "p",
      clientEmail: null,
    });
  });
});

describe("案内の文", () => {
  const target = { projectId: "my-proj", clientEmail: "sa@my-proj.iam.gserviceaccount.com" };

  it("値を埋めた gcloud の 1 行", () => {
    assert.equal(
      iamGrantCommand(target),
      "gcloud projects add-iam-policy-binding my-proj --member=serviceAccount:sa@my-proj.iam.gserviceaccount.com --role=roles/storage.admin",
    );
  });

  it("コンソールの URL はプロジェクトを指す", () => {
    assert.equal(iamConsoleUrl(target), "https://console.cloud.google.com/iam-admin/iam?project=my-proj");
    assert.equal(iamConsoleUrl({ projectId: null, clientEmail: null }), "https://console.cloud.google.com/iam-admin/iam");
  });

  it("案内に 1 行と URL が入り、取れた値ならプレースホルダの注記は出ない", () => {
    const guide = formatIamGrantGuide(target);
    assert.ok(guide.includes(`  ${iamGrantCommand(target)}`));
    assert.ok(guide.includes(iamConsoleUrl(target)));
    assert.ok(!guide.includes("読み取れなかった"));
  });

  it("値が取れないときはプレースホルダと注記", () => {
    const guide = formatIamGrantGuide({ projectId: null, clientEmail: null });
    assert.ok(guide.includes("add-iam-policy-binding <project-id> --member=serviceAccount:<サービスアカウントのメール>"));
    assert.ok(guide.includes("読み取れなかった"));
  });
});
