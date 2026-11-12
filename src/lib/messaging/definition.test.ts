// src/lib/messaging/definition.test.ts
//
// 連絡の定義の型と読み手の検査(validateMessageDefinition・applyMessageOverride)。
// - 正しい定義が通る / 止める物(required の守り・欄・adminEditable・{{鍵}}・throttle・鍵の形)が止まる
// - 上書きを重ねた結果も同じ関数で検査する / 型の絞りは @ts-expect-error で固定
// - category は categories を渡した時だけ受け口と照らす(取引は省ける)
// 実行: pnpm test src/lib/messaging/definition.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

import {
  CHANNEL_ERROR_KINDS,
  ChannelError,
  applyMessageOverride,
  createDefineMessage,
  defineMessage,
  extensionPoints,
  validateMessageDefinition,
  type MessageContent,
  type MessageOverride,
} from "./index";

const verification = defineMessage({
  key: "auth.verification",
  kind: "transactional",
  category: "account",
  vars: z.object({ verificationUrl: z.string().url() }),
  required: true,
  record: "meta",
  defaultChannels: ["email"],
  content: {
    email: {
      subject: "メールアドレスの確認",
      heading: "メールアドレスの確認",
      paragraphs: ["{{recipientName}} 様、{{serviceName}} への登録を受け付けました。"],
      cta: { label: "確認する", url: "{{verificationUrl}}" },
      footer: "心当たりがない場合は無視してください。",
    },
  },
});

const reply = defineMessage({
  key: "chat.reply",
  kind: "activity",
  category: "chat",
  vars: z.object({ roomId: z.string(), senderName: z.string() }),
  adminEditable: ["inApp.title", "email.subject"],
  throttle: { by: ["roomId"], mode: "untilRead", seconds: 600 },
  defaultChannels: ["inApp", "email"],
  content: {
    inApp: { title: "{{senderName}} さんから返信", body: "ほか {{collapsedCount}} 件", link: "{{appBaseUrl}}/rooms/{{roomId}}" },
    email: { subject: "{{senderName}} さんから返信がありました" },
    line: { text: "{{senderName}} さんから返信" },
  },
});

const codes = (problems: { code: string }[]) => problems.map((p) => p.code).sort();

test("正しい定義は問題なし", () => {
  assert.deepEqual(validateMessageDefinition(verification), []);
  assert.deepEqual(validateMessageDefinition(reply), []);
});

test("required の守り: email の除外・adminEditable・throttle を止める", () => {
  const def = defineMessage({
    ...verification,
    adminEditable: ["email.subject"],
    throttle: { by: ["verificationUrl"], mode: "window", seconds: 60 },
    defaultChannels: ["inApp"],
    content: { ...verification.content, inApp: { title: "確認", body: "" } },
  });
  assert.deepEqual(codes(validateMessageDefinition(def)), [
    "required_admin_editable",
    "required_throttle",
    "required_without_email",
  ]);
});

test("上書きを重ねた結果を検査: required への enabled:false・email の除外・adminEditable の付与を止める", () => {
  const override: MessageOverride = {
    enabled: false,
    defaultChannels: ["inApp"],
    adminEditable: ["email.subject"],
    content: { inApp: { title: "確認", body: "" } },
  };
  assert.deepEqual(codes(validateMessageDefinition(verification, { override })), [
    "required_admin_editable",
    "required_disabled",
    "required_without_email",
  ]);
});

test("上書きで key・kind・vars・required は変えられない", () => {
  const override = { required: false, key: "auth.other" } as never;
  assert.deepEqual(codes(validateMessageDefinition(verification, { override })), [
    "override_forbidden_key",
    "override_forbidden_key",
  ]);
});

test("上書きの重ね方: 欄は経路ごとに重ね、throttle: null で外す", () => {
  const resolved = applyMessageOverride(reply, {
    content: { email: { subject: "新しい件名 {{senderName}}" } },
    extras: { badge: "NEW" },
    throttle: null,
  });
  assert.equal(resolved.enabled, true);
  assert.equal(resolved.content.email?.subject, "新しい件名 {{senderName}}");
  assert.equal(resolved.content.inApp?.title, "{{senderName}} さんから返信");
  assert.deepEqual(resolved.extras, { badge: "NEW" });
  assert.equal(resolved.throttle, undefined);
  // 元の定義は変えない
  assert.equal(reply.content.email?.subject, "{{senderName}} さんから返信がありました");
  assert.ok(reply.throttle);
  // throttle を外すと {{collapsedCount}} は差し込めない
  assert.deepEqual(codes(validateMessageDefinition(reply, { override: { throttle: null } })), [
    "unknown_variable",
  ]);
});

test("欄の {{鍵}} は vars ∪ 共通の文脈(∪ throttle の collapsedCount)に在ること", () => {
  const def = defineMessage({
    ...verification,
    content: {
      email: {
        subject: "{{recipient.name}} {{unknownKey}} {{recipientEmail}} {{appBaseUrl}}",
        paragraphs: ["{{collapsedCount}}"],
      },
    },
  });
  const problems = validateMessageDefinition(def);
  assert.deepEqual(codes(problems), ["unknown_variable", "unknown_variable"]);
  assert.ok(problems.some((p) => p.message.includes("{{unknownKey}}")));
  assert.ok(problems.some((p) => p.message.includes("{{collapsedCount}}")));
});

test("variableKeys で足した鍵(enrichers の provides)は {{鍵}} で許す", () => {
  const def = defineMessage({
    ...verification,
    content: { email: { subject: "{{points}} {{unknownKey}}" } },
  });
  assert.deepEqual(codes(validateMessageDefinition(def)), ["unknown_variable", "unknown_variable"]);
  const problems = validateMessageDefinition(def, { variableKeys: ["points"] });
  assert.deepEqual(codes(problems), ["unknown_variable"]);
  assert.ok(problems[0].message.includes("{{unknownKey}}"));
});

test("欄の検査: 欄の zod に合わない・defaultChannels に欄が無い・知らない経路・定義に無い adminEditable", () => {
  const def = defineMessage({
    ...reply,
    defaultChannels: ["inApp", "email", "line"],
    adminEditable: ["inApp.title", "email.subject"],
    content: {
      inApp: { title: "", body: "本文" },
      email: { subject: "件名" },
    },
  });
  assert.deepEqual(codes(validateMessageDefinition(def)), ["invalid_content", "missing_content"]);

  const unknownChannel = { ...reply, adminEditable: [], defaultChannels: ["push"], content: { push: { text: "x" } } } as never;
  assert.deepEqual(codes(validateMessageDefinition(unknownChannel)), ["unknown_channel", "unknown_channel"]);

  const unknownField = { ...reply, adminEditable: ["email.subjectLine", "line.text"], content: { inApp: reply.content.inApp, email: reply.content.email } } as never;
  assert.deepEqual(codes(validateMessageDefinition(unknownField)), [
    "unknown_admin_editable",
    "unknown_admin_editable",
  ]);

  const extraField = { ...reply, content: { ...reply.content, email: { subject: "件名", title: "欄の名前は変えられない" } } } as never;
  assert.deepEqual(codes(validateMessageDefinition(extraField)), ["invalid_content"]);
});

test("throttle の検査と鍵の形", () => {
  const def = { ...reply, key: "ChatReply", throttle: { by: ["nope"], mode: "window", seconds: 0 } } as never;
  assert.deepEqual(codes(validateMessageDefinition(def)), [
    "invalid_key",
    "invalid_throttle",
    "invalid_throttle",
  ]);
});

test("category の検査(categories を渡した時だけ): 受け口の鍵か、取引だけ省ける。上書きの category も照らす", () => {
  const codes = (definition: Parameters<typeof validateMessageDefinition>[0], override?: MessageOverride) =>
    validateMessageDefinition(definition, { categories: ["marketing", "activity"], ...(override ? { override } : {}) }).map((p) => p.code);
  const { category: _omit, ...withoutCategory } = verification;
  void _omit;
  // 取引は省ける・鍵があれば受け口の鍵に限る
  assert.deepEqual(codes(withoutCategory), []);
  assert.deepEqual(codes(verification), ["unknown_category"]);
  assert.deepEqual(codes({ ...withoutCategory, kind: "marketing", required: false }), ["missing_category"]);
  assert.deepEqual(codes({ ...verification, kind: "marketing", required: false, category: "marketing" }), []);
  // 上書きの category も同じ
  assert.deepEqual(codes(withoutCategory, { category: "news" }), ["unknown_category"]);
  assert.deepEqual(codes(withoutCategory, { category: "activity" }), []);
  // 渡さなければ照らさない(今までどおり)
  assert.deepEqual(validateMessageDefinition(verification).map((p) => p.code), []);
});

test("fork の経路を足した束(createDefineMessage と channels)", () => {
  const channels = {
    email: z.object({ subject: z.string() }).strict(),
    push: z.object({ title: z.string(), body: z.string() }).strict(),
  };
  const define = createDefineMessage<typeof channels>();
  const def = define({
    key: "shop.orderShipped",
    kind: "transactional",
    category: "order",
    vars: z.object({ orderId: z.string() }),
    adminEditable: ["push.title"],
    defaultChannels: ["push"],
    content: { push: { title: "発送しました", body: "注文 {{orderId}}" } },
  });
  assert.deepEqual(validateMessageDefinition(def, { channels }), []);
  // 上流の束で読むと push は知らない経路
  assert.ok(codes(validateMessageDefinition(def as never)).includes("unknown_channel"));
});

test("ChannelError は lib/mail と同じ 3 分類を持つ Error", () => {
  assert.deepEqual([...CHANNEL_ERROR_KINDS], ["transient", "permanent", "unknown"]);
  const error = new ChannelError({ message: "届かない", kind: "permanent", channel: "line", reason: "invalid_address" });
  assert.ok(error instanceof Error);
  assert.equal(error.kind, "permanent");
  assert.equal(error.channel, "line");
  assert.equal(error.reason, "invalid_address");
});

test("型の絞り(型検査で固定。実行は何もしない)", () => {
  const vars = z.object({ a: z.string() });
  defineMessage({
    // @ts-expect-error 鍵は <domain>.<name>
    key: "noDot",
    kind: "activity",
    category: "x",
    vars,
    defaultChannels: ["email"],
    content: { email: { subject: "s" } },
  });
  defineMessage({
    key: "x.y",
    kind: "activity",
    category: "x",
    vars,
    // @ts-expect-error 欄の名前は <経路>.<欄>
    adminEditable: ["email.title"],
    defaultChannels: ["email"],
    content: { email: { subject: "s" } },
  });
  defineMessage({
    key: "x.y",
    kind: "activity",
    category: "x",
    vars,
    // @ts-expect-error throttle.by は vars の鍵
    throttle: { by: ["b"], mode: "window", seconds: 1 },
    defaultChannels: ["email"],
    content: { email: { subject: "s" } },
  });
  defineMessage({
    key: "x.y",
    kind: "activity",
    category: "x",
    vars,
    // @ts-expect-error 登録されていない経路
    defaultChannels: ["push"],
    content: { email: { subject: "s" } },
  });
  const content: MessageContent = { line: { text: "t" } };
  assert.ok(content);
});

// 上書きの型の鍵 = 宣言の overrideOf(どちらかに足すと型検査で落ちる)
type DeclaredKeys = (typeof extensionPoints.messages.overrideOf)[number];
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const overrideKeysMatch: Equal<keyof MessageOverride, DeclaredKeys> = true;

test("上書きの型の鍵と宣言の overrideOf は同じ", () => {
  assert.equal(overrideKeysMatch, true);
  assert.deepEqual([...extensionPoints.messages.overrideOf].sort(), [
    "adminEditable",
    "category",
    "content",
    "defaultChannels",
    "enabled",
    "extras",
    "record",
    "throttle",
  ]);
});
