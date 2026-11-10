// src/lib/mail/errors.test.ts
//
// メールの送信の失敗の分類(MailSendErrorKind)が、連絡の経路の失敗の分類(lib/messaging の ChannelErrorKind)と
// 同じ語彙であることの検査(経路 email は MailSendError の kind をそのまま ChannelError に渡す)。
// 実行: pnpm test src/lib/mail/errors.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { CHANNEL_ERROR_KINDS, type ChannelErrorKind } from "@/lib/messaging";

import { classifyNetworkError, classifyStatus, type MailSendErrorKind } from "./errors";

// 型で双方向に代入できる = 同じ語彙(どちらかに足すと型検査で落ちる)
const toChannel = (kind: MailSendErrorKind): ChannelErrorKind => kind;
const toMail = (kind: ChannelErrorKind): MailSendErrorKind => kind;

test("MailSendErrorKind と ChannelErrorKind は同じ語彙", () => {
  const produced = new Set<MailSendErrorKind>([
    classifyStatus(429),
    classifyStatus(400),
    classifyStatus(null),
    classifyNetworkError(Object.assign(new Error("x"), { code: "ECONNREFUSED" })),
  ]);
  assert.deepEqual([...produced].sort(), [...CHANNEL_ERROR_KINDS].sort());
  for (const kind of CHANNEL_ERROR_KINDS) assert.equal(toChannel(toMail(kind)), kind);
});
