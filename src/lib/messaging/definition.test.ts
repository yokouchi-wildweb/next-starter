// src/lib/messaging/definition.test.ts
//
// 連絡の定義の型と読み手の検査(validateMessageDefinition・applyMessageOverride)。
// - 正しい定義が通る / 止める物(required の守り・欄・adminEditable・{{鍵}}・throttle・鍵の形)が止まる
// - 上書きを重ねた結果も同じ関数で検査する / 型の絞りは @ts-expect-error で固定
// - category は categories を渡した時だけ受け口と照らす(取引は省ける)
// - authored の定義(文面を送るたびに受け取る)の守り
// 実行: pnpm test src/lib/messaging/definition.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

import {
  CHANNEL_ERROR_KINDS,
  ChannelError,
  MESSAGE_KINDS,
  MESSAGE_KIND_TRAITS,
  applyMessageOverride,
  createDefineMessage,
  defineMessage,
  extensionPoints,
  kindTraits,
  kindsWhere,
  resolveMessageDefinition,
  validateMessageCategories,
  validateMessageDefinition,
  type MessageCategory,
  type MessageContent,
  type MessageOverride,
} from "./index";

const verification = defineMessage({
  key: "auth.verification",
  category: "account",
  vars: z.object({ verificationUrl: z.string().url() }),
  required: true,
  record: "meta",
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
  category: "chat",
  vars: z.object({ roomId: z.string(), senderName: z.string() }),
  adminEditable: ["inApp.title", "email.subject"],
  throttle: { by: ["roomId"], mode: "untilRead", seconds: 600 },
  content: {
    inApp: { title: "{{senderName}} さんから返信", body: "ほか {{collapsedCount}} 件", link: "{{appBaseUrl}}/rooms/{{roomId}}" },
    email: { subject: "{{senderName}} さんから返信がありました" },
    line: { text: "{{senderName}} さんから返信" },
  },
});

const codes = (problems: { code: string }[]) => problems.map((p) => p.code).sort();

/** テストの種類(種別と経路は種類から引く) */
const CATEGORIES: Record<string, MessageCategory> = {
  account: { key: "account", label: "アカウント", kind: "functional", channels: ["email"] },
  accountInApp: { key: "accountInApp", label: "アカウント(お知らせ)", kind: "transactional", channels: ["inApp"] },
  chat: { key: "chat", label: "チャット", kind: "activity", channels: ["inApp", "email"] },
  chatLine: { key: "chatLine", label: "チャット(LINE も)", kind: "activity", channels: ["inApp", "email", "line"] },
  push: { key: "push", label: "プッシュ", kind: "activity", channels: ["push"] },
  order: { key: "order", label: "注文", kind: "transactional", channels: ["push"] },
  alert: { key: "alert", label: "警告", kind: "security", channels: ["email"] },
};
const validate = (definition: Parameters<typeof validateMessageDefinition>[0], options: Partial<Parameters<typeof validateMessageDefinition>[1]> = {}) =>
  validateMessageDefinition(definition, { categories: CATEGORIES, ...options });

test("正しい定義は問題なし", () => {
  assert.deepEqual(validate(verification), []);
  assert.deepEqual(validate(reply), []);
});

test("required の守り: email の除外・adminEditable・throttle を止める", () => {
  const def = defineMessage({
    ...verification,
    category: "accountInApp",
    adminEditable: ["inApp.title"],
    throttle: { by: ["verificationUrl"], mode: "window", seconds: 60 },
    content: { ...verification.content, inApp: { title: "確認", body: "" } },
  });
  assert.deepEqual(codes(validate(def)), [
    "required_admin_editable",
    "required_throttle",
    "required_without_email",
  ]);
});

test("上書きを重ねた結果を検査: required への enabled:false・email の除外・adminEditable の付与を止める", () => {
  const override: MessageOverride = {
    enabled: false,
    adminEditable: ["email.subject"],
    content: { inApp: { title: "確認", body: "" } },
  };
  // 経路は種類が決めるので上書きで email を外せない(required_without_email は種類の経路で見る)。functional の種類は文言の上書きも不可
  assert.deepEqual(codes(validate(verification, { override })), [
    "kind_admin_editable",
    "required_admin_editable",
    "required_disabled",
  ]);
});

test("上書きで key・kind・vars・required・category・defaultChannels は変えられない", () => {
  const override = { required: false, key: "auth.other", category: "chat", defaultChannels: ["email"] } as never;
  assert.deepEqual(codes(validate(verification, { override })), [
    "override_forbidden_key",
    "override_forbidden_key",
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
  assert.deepEqual(codes(validate(reply, { override: { throttle: null } })), [
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
  const problems = validate(def);
  assert.deepEqual(codes(problems), ["unknown_variable", "unknown_variable"]);
  assert.ok(problems.some((p) => p.message.includes("{{unknownKey}}")));
  assert.ok(problems.some((p) => p.message.includes("{{collapsedCount}}")));
});

test("variableKeys で足した鍵(enrichers の provides)は {{鍵}} で許す", () => {
  const def = defineMessage({
    ...verification,
    content: { email: { subject: "{{points}} {{unknownKey}}" } },
  });
  assert.deepEqual(codes(validate(def)), ["unknown_variable", "unknown_variable"]);
  const problems = validate(def, { variableKeys: ["points"] });
  assert.deepEqual(codes(problems), ["unknown_variable"]);
  assert.ok(problems[0].message.includes("{{unknownKey}}"));
});

test("欄の検査: 欄の zod に合わない・種類の経路に欄が無い・知らない経路・定義に無い adminEditable", () => {
  const def = defineMessage({
    ...reply,
    category: "chatLine",
    adminEditable: ["inApp.title", "email.subject"],
    content: {
      inApp: { title: "", body: "本文" },
      email: { subject: "件名" },
    },
  });
  assert.deepEqual(codes(validate(def)), ["invalid_content", "missing_content"]);

  const unknownChannel = { ...reply, category: "push", adminEditable: [], content: { push: { text: "x" } } } as never;
  assert.deepEqual(codes(validate(unknownChannel)), ["unknown_channel", "unknown_channel"]);

  const unknownField = { ...reply, adminEditable: ["email.subjectLine", "line.text"], content: { inApp: reply.content.inApp, email: reply.content.email } } as never;
  assert.deepEqual(codes(validate(unknownField)), [
    "unknown_admin_editable",
    "unknown_admin_editable",
  ]);

  const extraField = { ...reply, content: { ...reply.content, email: { subject: "件名", title: "欄の名前は変えられない" } } } as never;
  assert.deepEqual(codes(validate(extraField)), ["invalid_content"]);
});

test("throttle の検査と鍵の形", () => {
  const def = { ...reply, key: "ChatReply", throttle: { by: ["nope"], mode: "window", seconds: 0 } } as never;
  assert.deepEqual(codes(validate(def)), [
    "invalid_key",
    "invalid_throttle",
    "invalid_throttle",
  ]);
});

test("種類の検査: 受け口に無い鍵は誤り、種別の性質で文言の上書き・間引きを止める", () => {
  assert.deepEqual(codes(validate({ ...verification, category: "nope" })), ["unknown_category"]);
  // security は間引けない、functional は文言を直せない(required でなくても)
  const alert = defineMessage({ ...verification, category: "alert", required: false, throttle: { by: ["verificationUrl"], mode: "window", seconds: 60 } });
  assert.deepEqual(codes(validate(alert)), ["kind_throttle"]);
  const functional = defineMessage({ ...verification, required: false, adminEditable: ["email.subject"] });
  assert.deepEqual(codes(validate(functional)), ["kind_admin_editable"]);
  // 種別と経路は種類から付く
  const resolved = resolveMessageDefinition(reply, undefined, CATEGORIES.chat);
  assert.equal(resolved.kind, "activity");
  assert.deepEqual(resolved.channels, ["inApp", "email"]);
});

test("authored(文面を送るたびに受け取る): 空の content は通り、文面・adminEditable・throttle・上書きは止める", () => {
  const authored = defineMessage({ key: "admin.free", category: "chat", authored: true, vars: z.object({}), content: {} });
  assert.deepEqual(validate(authored), [], "種類の経路の文面が無くても通る");
  assert.deepEqual(codes(validate({ ...authored, content: { inApp: { title: "t", body: "b" } } })), ["authored_content"]);
  assert.deepEqual(codes(validate({ ...authored, adminEditable: ["inApp.title"] } as typeof authored)), ["authored_field", "unknown_admin_editable"]);
  assert.deepEqual(codes(validate(authored, { override: { extras: { x: 1 } } })), ["authored_override"]);
  // 送る口が受けた文面で埋めた定義(authored を外す)は普通に検査する: 種類の経路の文面が要る
  const filled = { ...authored, authored: undefined, content: { inApp: { title: "{{displayName}}", body: "b" } } };
  assert.deepEqual(codes(validate(filled, { variableKeys: ["displayName"] })), ["missing_content"]);
});

test("種類の受け口の検査: 種別・経路・グループ(同じ種別だけ)", () => {
  const groups = { social: { key: "social", label: "交流", order: 1 } };
  assert.deepEqual(
    validateMessageCategories(
      {
        like: { key: "like", label: "いいね", kind: "activity", channels: ["inApp"], group: "social" },
        follow: { key: "follow", label: "フォロー", kind: "activity", channels: ["inApp"], group: "social" },
      },
      groups,
    ),
    [],
  );
  const problems = validateMessageCategories(
    {
      like: { key: "like", label: "いいね", kind: "activity", channels: ["inApp"], group: "social" },
      promo: { key: "promo", label: "宣伝", kind: "marketing", channels: ["email"], group: "social" },
      lost: { key: "lost", label: "迷子", kind: "activity", channels: [], group: "nope" },
      odd: { key: "odd", label: "変", kind: "weird" as never, channels: ["email"] },
    },
    groups,
  );
  assert.deepEqual(problems.map((p) => p.code).sort(), ["empty_channels", "group_kind_mismatch", "unknown_group", "unknown_kind"]);
});

test("種別の性質の表(D80)", () => {
  assert.deepEqual([...MESSAGE_KINDS], ["functional", "transactional", "security", "announcement", "direct", "activity", "marketing"]);
  assert.deepEqual(kindsWhere((t) => t.userStoppable), ["activity", "marketing"]);
  assert.deepEqual(kindsWhere((t) => !t.upstreamDisable), ["functional"]);
  assert.deepEqual(kindsWhere((t) => t.addressStop === "hardBounce"), ["functional", "security"]);
  assert.deepEqual(kindsWhere((t) => t.adminFreeText.length > 0), ["announcement", "direct", "marketing"]);
  assert.deepEqual(kindsWhere((t) => !t.throttle), ["functional", "security"]);
  assert.deepEqual(kindsWhere((t) => !t.adminTextOverride), ["functional"]);
  assert.deepEqual(kindsWhere((t) => t.emailFixed), ["functional", "security"]);
  assert.deepEqual(kindsWhere((t) => t.sendInEntry), ["security"]);
  assert.equal(MESSAGE_KIND_TRAITS.direct.recordDefault, "full");
  assert.equal(MESSAGE_KIND_TRAITS.security.recordDefault, "meta");
  assert.equal(kindTraits("transactional")?.recordDefault, "vars");
  assert.equal(kindTraits("nope"), null);
});

test("fork の経路を足した束(createDefineMessage と channels)", () => {
  const channels = {
    email: z.object({ subject: z.string() }).strict(),
    push: z.object({ title: z.string(), body: z.string() }).strict(),
  };
  const define = createDefineMessage<typeof channels>();
  const def = define({
    key: "shop.orderShipped",
    category: "order",
    vars: z.object({ orderId: z.string() }),
    adminEditable: ["push.title"],
    content: { push: { title: "発送しました", body: "注文 {{orderId}}" } },
  });
  assert.deepEqual(validate(def, { channels }), []);
  // 上流の束で読むと push は知らない経路
  assert.ok(codes(validate(def as never)).includes("unknown_channel"));
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
    category: "x",
    vars,
    content: { email: { subject: "s" } },
  });
  defineMessage({
    key: "x.y",
    category: "x",
    vars,
    // @ts-expect-error 欄の名前は <経路>.<欄>
    adminEditable: ["email.title"],
    content: { email: { subject: "s" } },
  });
  defineMessage({
    key: "x.y",
    category: "x",
    vars,
    // @ts-expect-error throttle.by は vars の鍵
    throttle: { by: ["b"], mode: "window", seconds: 1 },
    content: { email: { subject: "s" } },
  });
  defineMessage({
    key: "x.y",
    category: "x",
    vars,
    // @ts-expect-error 登録されていない経路
    content: { push: { text: "s" } },
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
    "content",
    "enabled",
    "extras",
    "record",
    "throttle",
  ]);
});
