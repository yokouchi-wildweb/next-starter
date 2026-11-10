// src/features/core/wallet/services/server/notification/renderNoticeText.test.ts
//
// 失効通知の文面の差し込み(renderNoticeText)の検査。書式は lib/structuredDocument の差し込み 1 本。
// - 上流の既定の文面(config.ts の preExpiryNoticeCopy・expiredNoticeCopy と同じ文字列)に
//   コメントの名前(currencyLabel・amount・expiresOn・daysBefore・expiredOn・balanceAfter)を差し込んだ結果
// - 知らない名前・点を含む名前はそのまま残す
// (fork が書き換える config の値に依らないよう、文面はテストの中に書く)
// 実行: pnpm test src/features/core/wallet/services/server/notification/renderNoticeText.test.ts
// (package.json に type: module が無いので tsx は CJS として読む → before() で import)
import { before, mock, test } from "node:test";
import assert from "node:assert/strict";

// 送信の部品は使わないので、DB・messaging・wallet の設定を読まない偽物にする
mock.module("@/lib/drizzle", { namedExports: { db: {} } });
mock.module("@/features/core/user/entities/drizzle", { namedExports: { UserTable: {} } });
mock.module("@/features/core/messaging/services/server/messagingService", {
  namedExports: { messagingService: {} },
});
mock.module("@/features/wallet/config", { namedExports: { walletConfig: {} } });

let renderNoticeText: typeof import("./expirationNoticeSender").renderNoticeText;

before(async () => {
  ({ renderNoticeText } = await import("./expirationNoticeSender"));
});

const preExpiry = {
  emailSubject: "{{currencyLabel}}の有効期限が近づいています",
  emailBody:
    "{{amount}} が {{expiresOn}} に有効期限を迎えます。\n期限を過ぎた分は失効しますので、お早めにご利用ください。",
  notificationBody: "{{amount}} が {{expiresOn}} に失効します。",
};

const expired = {
  emailBody: "有効期限切れにより {{amount}} が失効しました。\n失効後の残高: {{balanceAfter}}",
  notificationBody: "有効期限切れにより {{amount}} が失効しました。（残高: {{balanceAfter}}）",
};

test("予告の文面に名前を差し込む", () => {
  const vars = {
    currencyLabel: "コイン",
    amount: "1,000 コイン",
    expiresOn: "2026年10月1日",
    daysBefore: "7",
  };
  assert.equal(renderNoticeText(preExpiry.emailSubject, vars), "コインの有効期限が近づいています");
  assert.equal(
    renderNoticeText(preExpiry.emailBody, vars),
    "1,000 コイン が 2026年10月1日 に有効期限を迎えます。\n期限を過ぎた分は失効しますので、お早めにご利用ください。",
  );
  assert.equal(
    renderNoticeText(preExpiry.notificationBody, vars),
    "1,000 コイン が 2026年10月1日 に失効します。",
  );
  assert.equal(renderNoticeText("あと {{daysBefore}} 日", vars), "あと 7 日");
});

test("本通知の文面に名前を差し込む", () => {
  const vars = {
    currencyLabel: "コイン",
    amount: "500 コイン",
    expiredOn: "2026年10月1日",
    balanceAfter: "0 コイン",
  };
  assert.equal(
    renderNoticeText(expired.emailBody, vars),
    "有効期限切れにより 500 コイン が失効しました。\n失効後の残高: 0 コイン",
  );
  assert.equal(
    renderNoticeText(expired.notificationBody, vars),
    "有効期限切れにより 500 コイン が失効しました。（残高: 0 コイン）",
  );
  assert.equal(renderNoticeText("{{expiredOn}} に失効", vars), "2026年10月1日 に失効");
});

test("知らない名前と点を含む名前はそのまま残す", () => {
  assert.equal(
    renderNoticeText("{{amount}} / {{unknown}} / {{a.b}}", { amount: "1" }),
    "1 / {{unknown}} / {{a.b}}",
  );
});
