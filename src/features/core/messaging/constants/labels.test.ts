// 管理の画面の表示名の表の検査。
// - 種別の表示名(config の kindLabels)= lib の MESSAGE_KINDS と同じ 7 つ・同じ順(送信の一覧の種別の絞りがこの順で出す)。管理画面は adminLabel、無ければ label
// - 送信チャンネルの表示名 MESSAGE_CHANNEL_LABELS = 上流の送信チャンネルの受け口の label と同じ(送る・一括送信のモーダルと同じ言葉)
// 実行: pnpm test src/features/core/messaging/constants/labels.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { MESSAGE_KINDS } from "@/lib/messaging";

import { createInAppChannel } from "../channels/inApp/createInAppChannel";
import { createLineChannel } from "../channels/line/createLineChannel";
import { MESSAGE_CHANNEL_LABELS, messageChannelLabel } from "./channelLabels";
import { messagingConfig } from "../config";
import { messageKindAdminLabel, messageKindAdminOptions, messageKindLabel } from "../presenters";

test("種別の表示名は MESSAGE_KINDS と同じ 7 つ・同じ順、管理画面は adminLabel ?? label、知らない種別は鍵のまま", () => {
  assert.deepEqual(Object.keys(messagingConfig.kindLabels), [...MESSAGE_KINDS]);
  assert.deepEqual(messageKindAdminOptions().map((option) => option.value), [...MESSAGE_KINDS]);
  assert.equal(messageKindLabel("transactional"), "手続き通知");
  assert.equal(messageKindAdminLabel("transactional"), messagingConfig.kindLabels.transactional.adminLabel ?? "手続き通知");
  assert.equal(messageKindLabel("nope"), "nope");
  assert.equal(messageKindAdminLabel("nope"), "nope");
});

test("送信チャンネルの表示名は受け口の label と同じ、知らない送信チャンネルは鍵のまま", () => {
  assert.equal(MESSAGE_CHANNEL_LABELS.inApp, createInAppChannel({} as never).label);
  assert.equal(MESSAGE_CHANNEL_LABELS.line, createLineChannel({} as never).label);
  assert.equal(messageChannelLabel("push"), "push");
});
