// 管理の画面の表示名の表の検査。
// - 種別の表示名 MESSAGE_KIND_LABELS = lib の MESSAGE_KINDS と同じ 7 つ・同じ順(送信の一覧の種別の絞りがこの順で出す)
// - 送信チャンネルの表示名 MESSAGE_CHANNEL_LABELS = 上流の送信チャンネルの受け口の label と同じ(送る・一括送信のモーダルと同じ言葉)
// 実行: pnpm test src/features/core/messaging/constants/labels.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { MESSAGE_KINDS } from "@/lib/messaging";

import { createInAppChannel } from "../channels/inApp/createInAppChannel";
import { createLineChannel } from "../channels/line/createLineChannel";
import { MESSAGE_CHANNEL_LABELS, messageChannelLabel } from "./channelLabels";
import { MESSAGE_KIND_LABELS } from "./kindLabels";

test("種別の表示名は MESSAGE_KINDS と同じ 7 つ・同じ順", () => {
  assert.deepEqual(Object.keys(MESSAGE_KIND_LABELS), [...MESSAGE_KINDS]);
});

test("送信チャンネルの表示名は受け口の label と同じ、知らない送信チャンネルは鍵のまま", () => {
  assert.equal(MESSAGE_CHANNEL_LABELS.inApp, createInAppChannel({} as never).label);
  assert.equal(MESSAGE_CHANNEL_LABELS.line, createLineChannel({} as never).label);
  assert.equal(messageChannelLabel("push"), "push");
});
